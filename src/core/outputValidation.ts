import { BlobReader, ZipReader } from "@zip.js/zip.js";
import { archivePathKey, normalizeArchivePath } from "./archivePaths";
import {
  MAX_ARCHIVE_ENTRY_COUNT,
  MAX_ARCHIVE_EXPANSION_RATIO,
  MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES
} from "./riskLimits";

export const MAX_OUTPUT_HEADER_BYTES = 4 * 1024;
export const MAX_OUTPUT_TAIL_BYTES = 512;
export const MAX_JSON_VALIDATION_BYTES = 4 * 1024 * 1024;
export const MAX_XML_VALIDATION_BYTES = 4 * 1024 * 1024;
export const MAX_OOXML_XML_BYTES = 1024 * 1024;
export const MAX_JPEG_METADATA_BYTES = 16 * 1024 * 1024;
export const MAX_JPEG_SEGMENT_COUNT = 4_096;
export const MAX_ISO_TOP_LEVEL_BOXES = 4_096;
export const MAX_ISO_FTYP_BYTES = 4 * 1024;

export interface OutputCandidate {
  name: string;
  blob: Blob;
}

export interface OutputValidation {
  name: string;
  expectedFormat: string;
  detectedFormat: string;
  mime: string;
  size: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type ExpectedFormat =
  | "pdf" | "png" | "jpeg" | "gif" | "webp" | "bmp" | "ico" | "svg"
  | "html" | "text" | "markdown" | "csv" | "tsv" | "xml" | "yaml" | "json" | "jsonl"
  | "zip" | "docx" | "xlsx" | "pptx"
  | "mp4" | "mov" | "m4a" | "3gp" | "avif" | "webm" | "mka" | "wav" | "mp3" | "mp2" | "aac" | "flac" | "ogg"
  | "aiff" | "caf" | "ac3" | "eac3" | "asf" | "wavpack" | "tta" | "au" | "wave64" | "pcm"
  | "gzip" | "tar" | "rar" | "7z" | "exe" | "woff" | "woff2" | "ttf" | "otf"
  | "unknown";

type OfficeFamily = "docx" | "xlsx" | "pptx";

interface SignatureDetection {
  format: string;
  valid: boolean;
}

interface XmlElement {
  qualifiedName: string;
  localName: string;
  namespace: string;
  attributes: ReadonlyMap<string, string>;
}

interface XmlDocumentFacts {
  root: XmlElement;
  elements: readonly XmlElement[];
}

const TEXT_FORMATS = new Set<ExpectedFormat>(["html", "text", "markdown", "csv", "tsv", "xml", "yaml"]);
const OOXML_REQUIRED_XML = new Set(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "xl/workbook.xml", "ppt/presentation.xml"]);
const CONTENT_TYPES_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/content-types";
const RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

const OFFICE_FAMILIES: Readonly<Record<OfficeFamily, {
  main: string;
  part: string;
  root: string;
  namespace: string;
  contentType: string;
}>> = {
  docx: {
    main: "word/document.xml",
    part: "/word/document.xml",
    root: "document",
    namespace: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
  },
  xlsx: {
    main: "xl/workbook.xml",
    part: "/xl/workbook.xml",
    root: "workbook",
    namespace: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
  },
  pptx: {
    main: "ppt/presentation.xml",
    part: "/ppt/presentation.xml",
    root: "presentation",
    namespace: "http://schemas.openxmlformats.org/presentationml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
  }
};

const EXTENSION_FORMATS: Readonly<Record<string, ExpectedFormat>> = {
  pdf: "pdf", png: "png", jpg: "jpeg", jpeg: "jpeg", gif: "gif", webp: "webp", bmp: "bmp", ico: "ico", svg: "svg",
  html: "html", htm: "html", txt: "text", md: "markdown", markdown: "markdown", csv: "csv", tsv: "tsv", xml: "xml", yaml: "yaml", yml: "yaml",
  json: "json", jsonl: "jsonl", ndjson: "jsonl", webmanifest: "json", zip: "zip", docx: "docx", xlsx: "xlsx", pptx: "pptx", mp4: "mp4", mov: "mov", m4a: "m4a", m4r: "m4a", "3gp": "3gp", "3gpp": "3gp",
  avif: "avif", webm: "webm", mka: "mka", wav: "wav", mp3: "mp3", mp2: "mp2", aac: "aac", flac: "flac", ogg: "ogg", oga: "ogg", opus: "ogg",
  aif: "aiff", aiff: "aiff", caf: "caf", ac3: "ac3", eac3: "eac3", ec3: "eac3", wma: "asf", asf: "asf", wv: "wavpack", tta: "tta", au: "au", snd: "au", w64: "wave64", pcm: "pcm",
  gz: "gzip", gzip: "gzip", tar: "tar", rar: "rar", "7z": "7z",
  exe: "exe", woff: "woff", woff2: "woff2", ttf: "ttf", otf: "otf"
};

export async function validateOutputs(outputs: readonly OutputCandidate[]): Promise<OutputValidation[]> {
  if (outputs.length === 0) {
    return [{
      name: "",
      expectedFormat: "unknown",
      detectedFormat: "unknown",
      mime: "",
      size: 0,
      valid: false,
      errors: ["Conversion produced no outputs."],
      warnings: []
    }];
  }
  return Promise.all(outputs.map((output) => validateOutput(output)));
}

export async function validateOutput(output: OutputCandidate): Promise<OutputValidation> {
  const expectedFormat = expectedFormatForName(output.name);
  const facts: OutputValidation = {
    name: output.name,
    expectedFormat,
    detectedFormat: "unknown",
    mime: output.blob.type,
    size: output.blob.size,
    valid: false,
    errors: [],
    warnings: []
  };

  if (output.blob.size === 0) {
    facts.errors.push("Output is empty.");
    return facts;
  }

  const [header, tail] = await readOutputEdges(output.blob);
  const signature = detectSignature(header);
  facts.detectedFormat = signature.format;

  if (expectedFormat === "unknown") {
    facts.errors.push("Output extension is missing or not supported for validation.");
    return facts;
  }

  if (isArchiveFormat(expectedFormat)) {
    const archive = await inspectArchive(output.blob, signature.format);
    facts.detectedFormat = archive.format;
    facts.errors.push(...archive.errors);
  } else if (expectedFormat === "json") {
    await validateJson(output.blob, facts);
  } else if (expectedFormat === "jsonl") {
    await validateJsonLines(output.blob, facts);
  } else if (TEXT_FORMATS.has(expectedFormat) || expectedFormat === "svg") {
    await validateTextOutput(output.blob, header, expectedFormat, facts);
  } else {
    await validateBinaryOutput(output.blob, expectedFormat, signature, header, tail, facts);
  }

  if (facts.errors.length === 0 && !isExpectedMatch(expectedFormat, facts.detectedFormat)) {
    facts.errors.push(`Output extension expects ${expectedFormat.toUpperCase()} but bytes identify ${facts.detectedFormat.toUpperCase()}.`);
  }
  facts.valid = facts.errors.length === 0;
  return facts;
}

function expectedFormatForName(name: string): ExpectedFormat {
  const finalName = name.split(/[\\/]/).at(-1) ?? "";
  const match = /^.+\.([a-z0-9]+)$/i.exec(finalName);
  return match ? EXTENSION_FORMATS[match[1].toLowerCase()] ?? "unknown" : "unknown";
}

function isArchiveFormat(format: ExpectedFormat) {
  return format === "zip" || format === "docx" || format === "xlsx" || format === "pptx";
}

async function readOutputEdges(blob: Blob) {
  const header = new Uint8Array(await blob.slice(0, MAX_OUTPUT_HEADER_BYTES).arrayBuffer());
  const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - MAX_OUTPUT_TAIL_BYTES)).arrayBuffer());
  return [header, tail] as const;
}

function detectSignature(header: Uint8Array): SignatureDetection {
  if (matches(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return detected("png");
  if (matches(header, [0xff, 0xd8, 0xff])) return detected("jpeg");
  if (matches(header, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || matches(header, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return detected("gif");
  if (matches(header, asciiBytes("RIFF")) && matches(header, asciiBytes("WEBP"), 8)) return detected("webp");
  if (matches(header, asciiBytes("%PDF-"))) return detected("pdf");
  if (isZipHeader(header)) return detected("zip");
  if (matches(header, asciiBytes("BM"))) return detected("bmp");
  if (matches(header, [0, 0, 1, 0])) return detected("ico");
  if (matches(header, [0x1a, 0x45, 0xdf, 0xa3])) return detectEbmlFormat(header);
  if (matches(header, asciiBytes("riff")) && matches(header, [0x2e, 0x91, 0xcf, 0x11], 4)) return detected("wave64");
  if (matches(header, asciiBytes("RIFF")) && matches(header, asciiBytes("WAVE"), 8)) return detected("wav");
  if (matches(header, asciiBytes("FORM")) && (matches(header, asciiBytes("AIFF"), 8) || matches(header, asciiBytes("AIFC"), 8))) return detected("aiff");
  if (matches(header, asciiBytes("caff"))) return detected("caf");
  if (matches(header, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c])) return detected("asf");
  if (matches(header, asciiBytes("wvpk"))) return detected("wavpack");
  if (matches(header, asciiBytes("TTA1"))) return detected("tta");
  if (matches(header, asciiBytes(".snd"))) return detected("au");
  if (matches(header, [0x0b, 0x77])) return detected(((header[5] ?? 0) >> 3) > 10 ? "eac3" : "ac3");
  if (matches(header, asciiBytes("fLaC"))) return detected("flac");
  if (isAdtsHeader(header)) return detected("aac");
  if (matches(header, asciiBytes("ID3"))) return detected("mp3");
  if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) return detected(((header[1] >> 1) & 0x03) === 0x02 ? "mp2" : "mp3");
  if (matches(header, asciiBytes("OggS"))) return detected("ogg");
  if (matches(header, [0x1f, 0x8b])) return detected("gzip");
  if (matches(header, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return detected("rar");
  if (matches(header, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return detected("7z");
  if (matches(header, asciiBytes("MZ"))) return detected("exe");
  if (matches(header, asciiBytes("wOFF"))) return detected("woff");
  if (matches(header, asciiBytes("wOF2"))) return detected("woff2");
  if (matches(header, [0, 1, 0, 0]) || matches(header, asciiBytes("true"))) return detected("ttf");
  if (matches(header, asciiBytes("OTTO"))) return detected("otf");
  if (matches(header, asciiBytes("ftyp"), 4)) return detectIsoBaseMediaFormat(header);
  if (matches(header, asciiBytes("ustar"), 257)) return detected("tar");
  return { format: "unknown", valid: false };
}

function detected(format: string): SignatureDetection {
  return { format, valid: true };
}

function detectEbmlFormat(header: Uint8Array): SignatureDetection {
  const sample = ascii(header.slice(4)).toLowerCase();
  if (sample.includes("matroska")) return detected("mka");
  if (sample.includes("webm")) return detected("webm");
  return { format: "unknown", valid: false };
}

function detectIsoBaseMediaFormat(header: Uint8Array) {
  const brand = ascii(header.slice(8, 12));
  if (brand === "qt  ") return detected("mov");
  if (brand === "M4A ") return detected("m4a");
  if (brand.startsWith("3g")) return detected("3gp");
  if (brand === "avif" || brand === "avis") return detected("avif");
  return brand ? detected("mp4") : { format: "unknown", valid: false };
}

async function inspectArchive(blob: Blob, initialFormat: string) {
  if (initialFormat !== "zip") return { format: initialFormat, errors: [] as string[] };

  const reader = new ZipReader(new BlobReader(blob), { checkSignature: true, checkOverlappingEntry: true });
  const names = new Set<string>();
  const pathKeys = new Set<string>();
  const xmlEntries = new Map<string, string>();
  let entryCount = 0;
  let totalUncompressedBytes = 0;

  try {
    for await (const entry of reader.getEntriesGenerator()) {
      entryCount += 1;
      if (entryCount > MAX_ARCHIVE_ENTRY_COUNT) {
        throw new Error(`Archive exceeds the ${MAX_ARCHIVE_ENTRY_COUNT} entry limit.`);
      }

      let normalizedPath: string;
      try {
        normalizedPath = normalizeArchivePath(entry.filename, { directory: entry.directory });
      } catch {
        throw new Error(`Archive entry has an unsafe path: ${entry.filename}`);
      }
      const pathKey = archivePathKey(normalizedPath);
      if (pathKeys.has(pathKey)) throw new Error(`Archive contains a duplicate path after normalization: ${entry.filename}`);
      pathKeys.add(pathKey);
      names.add(normalizedPath);
      totalUncompressedBytes += entry.uncompressedSize;
      if (totalUncompressedBytes > MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES) {
        throw new Error(`Archive exceeds the ${MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES} byte uncompressed limit.`);
      }
      if (entry.uncompressedSize > 0 && (entry.compressedSize === 0 || entry.uncompressedSize / entry.compressedSize > MAX_ARCHIVE_EXPANSION_RATIO)) {
        throw new Error(`Archive entry exceeds the ${MAX_ARCHIVE_EXPANSION_RATIO}:1 expansion ratio limit: ${entry.filename}`);
      }
      if (entry.directory) continue;

      const collector = OOXML_REQUIRED_XML.has(normalizedPath) ? createBoundedTextCollector(normalizedPath) : undefined;
      await entry.getData(collector?.writable ?? createDiscardWritable(), {
        checkSignature: true,
        checkOverlappingEntry: true
      });
      if (collector) xmlEntries.set(normalizedPath, collector.text());
    }

    const families = (Object.keys(OFFICE_FAMILIES) as OfficeFamily[]).filter((family) => names.has(OFFICE_FAMILIES[family].main));
    if (families.length === 0) return { format: "zip", errors: [] as string[] };
    if (families.length > 1) return { format: "zip", errors: ["ZIP contains multiple incompatible Office package families."] };

    const family = families[0];
    const errors = validateOfficePackage(family, xmlEntries);
    return { format: family, errors };
  } catch (error) {
    return { format: "zip", errors: [`ZIP payload validation failed: ${errorMessage(error)}`] };
  } finally {
    await reader.close().catch(() => undefined);
  }
}

function createDiscardWritable() {
  return new WritableStream<Uint8Array>({ write() {} });
}

function createBoundedTextCollector(name: string) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  return {
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        size += chunk.byteLength;
        if (size > MAX_OOXML_XML_BYTES) {
          throw new Error(`${name} exceeds the ${MAX_OOXML_XML_BYTES}-byte OOXML validation limit.`);
        }
        chunks.push(chunk.slice());
      }
    }),
    text() {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const text = decodeUtf8Bytes(bytes);
      if (text === undefined) throw new Error(`${name} is not valid UTF-8 XML.`);
      return text;
    }
  };
}

function validateOfficePackage(family: OfficeFamily, xmlEntries: ReadonlyMap<string, string>) {
  const definition = OFFICE_FAMILIES[family];
  const required = ["[Content_Types].xml", "_rels/.rels", definition.main];
  const missing = required.filter((name) => !xmlEntries.has(name));
  if (missing.length) return [`Office package is missing required XML: ${missing.join(", ")}.`];

  try {
    const contentTypes = parseXml(xmlEntries.get("[Content_Types].xml") as string);
    const relationships = parseXml(xmlEntries.get("_rels/.rels") as string);
    const main = parseXml(xmlEntries.get(definition.main) as string);

    if (contentTypes.root.localName !== "Types" || contentTypes.root.namespace !== CONTENT_TYPES_NAMESPACE) {
      throw new Error("[Content_Types].xml has an invalid root namespace.");
    }
    const mainContentTypes = new Set(Object.values(OFFICE_FAMILIES).map((item) => item.contentType));
    const mainOverrides = contentTypes.elements.filter((element) =>
      element.localName === "Override" && element.namespace === CONTENT_TYPES_NAMESPACE && mainContentTypes.has(element.attributes.get("ContentType") ?? "")
    );
    if (mainOverrides.length !== 1 || mainOverrides[0].attributes.get("PartName") !== definition.part || mainOverrides[0].attributes.get("ContentType") !== definition.contentType) {
      throw new Error("[Content_Types].xml does not declare exactly one matching Office main part.");
    }

    if (relationships.root.localName !== "Relationships" || relationships.root.namespace !== RELATIONSHIPS_NAMESPACE) {
      throw new Error("_rels/.rels has an invalid root namespace.");
    }
    const officeRelationships = relationships.elements.filter((element) =>
      element.localName === "Relationship" && element.namespace === RELATIONSHIPS_NAMESPACE && element.attributes.get("Type") === OFFICE_DOCUMENT_RELATIONSHIP
    );
    if (officeRelationships.length !== 1 || officeRelationships[0].attributes.get("Target") !== definition.main) {
      throw new Error("_rels/.rels does not target exactly one matching Office main part.");
    }

    if (main.root.localName !== definition.root || main.root.namespace !== definition.namespace) {
      throw new Error(`${definition.main} has an invalid family root or namespace.`);
    }
    return [] as string[];
  } catch (error) {
    return [`OOXML structure validation failed: ${errorMessage(error)}`];
  }
}

function parseXml(source: string): XmlDocumentFacts {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("DTD and entity declarations are not allowed.");
  const elements: XmlElement[] = [];
  const stack: Array<{ qualifiedName: string; namespaces: Map<string, string> }> = [];
  let root: XmlElement | undefined;
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (index < source.length) {
    const nextTag = source.indexOf("<", index);
    if (nextTag < 0) {
      const text = source.slice(index);
      if (!stack.length && text.trim()) throw new Error("Text appears outside the root element.");
      if (stack.length) decodeXmlEntities(text);
      index = source.length;
      break;
    }
    const text = source.slice(index, nextTag);
    if (!stack.length && text.trim()) throw new Error("Text appears outside the root element.");
    if (stack.length) decodeXmlEntities(text);
    index = nextTag;

    if (source.startsWith("<?", index)) {
      const end = source.indexOf("?>", index + 2);
      if (end < 0) throw new Error("XML declaration is not closed.");
      index = end + 2;
      continue;
    }
    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index + 4);
      if (end < 0) throw new Error("XML comment is not closed.");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", index)) {
      if (!stack.length) throw new Error("CDATA appears outside the root element.");
      const end = source.indexOf("]]>", index + 9);
      if (end < 0) throw new Error("CDATA is not closed.");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<!", index)) throw new Error("Unsupported XML declaration.");

    const end = findXmlTagEnd(source, index + 1);
    const raw = source.slice(index + 1, end).trim();
    index = end + 1;
    if (!raw) throw new Error("Empty XML tag.");

    if (raw.startsWith("/")) {
      const qualifiedName = raw.slice(1).trim();
      if (!isXmlName(qualifiedName) || stack.at(-1)?.qualifiedName !== qualifiedName) throw new Error("XML closing tag does not match.");
      stack.pop();
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const parsed = parseXmlStartTag(selfClosing ? raw.slice(0, -1).trimEnd() : raw);
    const namespaces = new Map(stack.at(-1)?.namespaces ?? [["xml", "http://www.w3.org/XML/1998/namespace"]]);
    for (const [name, value] of parsed.attributes) {
      if (name === "xmlns") namespaces.set("", value);
      else if (name.startsWith("xmlns:")) namespaces.set(name.slice(6), value);
    }

    const [prefix = "", localName] = splitXmlName(parsed.qualifiedName);
    const namespace = namespaces.get(prefix);
    if (prefix && !namespace) throw new Error(`XML prefix ${prefix} is not bound.`);
    for (const name of parsed.attributes.keys()) {
      if (name === "xmlns" || name.startsWith("xmlns:")) continue;
      const [attributePrefix] = splitXmlName(name);
      if (attributePrefix && !namespaces.has(attributePrefix)) throw new Error(`XML attribute prefix ${attributePrefix} is not bound.`);
    }

    const element: XmlElement = {
      qualifiedName: parsed.qualifiedName,
      localName,
      namespace: namespace ?? "",
      attributes: parsed.attributes
    };
    if (!stack.length) {
      if (root) throw new Error("XML has more than one root element.");
      root = element;
    }
    elements.push(element);
    if (!selfClosing) stack.push({ qualifiedName: parsed.qualifiedName, namespaces });
  }

  if (stack.length) throw new Error("XML has unclosed elements.");
  if (!root) throw new Error("XML root element is missing.");
  return { root, elements };
}

function findXmlTagEnd(source: string, start: number) {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  throw new Error("XML tag is not closed.");
}

function parseXmlStartTag(raw: string) {
  let index = 0;
  const qualifiedName = readXmlName(raw, () => index, (value) => { index = value; });
  const attributes = new Map<string, string>();

  while (index < raw.length) {
    while (/\s/.test(raw[index] ?? "")) index += 1;
    if (index >= raw.length) break;
    const name = readXmlName(raw, () => index, (value) => { index = value; });
    if (attributes.has(name)) throw new Error(`Duplicate XML attribute ${name}.`);
    while (/\s/.test(raw[index] ?? "")) index += 1;
    if (raw[index] !== "=") throw new Error(`XML attribute ${name} is missing '='.`);
    index += 1;
    while (/\s/.test(raw[index] ?? "")) index += 1;
    const quote = raw[index];
    if (quote !== '"' && quote !== "'") throw new Error(`XML attribute ${name} is not quoted.`);
    const end = raw.indexOf(quote, index + 1);
    if (end < 0) throw new Error(`XML attribute ${name} is not closed.`);
    attributes.set(name, decodeXmlEntities(raw.slice(index + 1, end)));
    index = end + 1;
  }
  return { qualifiedName, attributes };
}

function readXmlName(source: string, getIndex: () => number, setIndex: (value: number) => void) {
  const index = getIndex();
  const match = /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?/.exec(source.slice(index));
  if (!match) throw new Error("Invalid XML name.");
  setIndex(index + match[0].length);
  return match[0];
}

function isXmlName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/.test(value);
}

function splitXmlName(value: string): [string, string] {
  const separator = value.indexOf(":");
  return separator < 0 ? ["", value] : [value.slice(0, separator), value.slice(separator + 1)];
}

function decodeXmlEntities(value: string) {
  if (/&(?!(?:#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);)/i.test(value)) throw new Error("Invalid XML entity reference.");
  return value.replace(/&(?:#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (entity) => {
    if (entity === "&amp;") return "&";
    if (entity === "&lt;") return "<";
    if (entity === "&gt;") return ">";
    if (entity === "&quot;") return '"';
    if (entity === "&apos;") return "'";
    const numeric = entity.startsWith("&#x") ? Number.parseInt(entity.slice(3, -1), 16) : Number.parseInt(entity.slice(2, -1), 10);
    if (!Number.isFinite(numeric)) throw new Error("Invalid XML entity.");
    return String.fromCodePoint(numeric);
  });
}

async function validateJson(blob: Blob, facts: OutputValidation) {
  facts.detectedFormat = "text";
  if (blob.size > MAX_JSON_VALIDATION_BYTES) {
    facts.errors.push(`JSON output exceeds the ${MAX_JSON_VALIDATION_BYTES}-byte browser validation limit; use the desktop app for large JSON files.`);
    return;
  }
  const text = await decodeUtf8(blob);
  if (text === undefined) {
    facts.errors.push("JSON output is not valid UTF-8 text.");
    return;
  }
  try {
    JSON.parse(text);
    facts.detectedFormat = "json";
  } catch {
    facts.errors.push("JSON output could not be parsed.");
  }
}

async function validateJsonLines(blob: Blob, facts: OutputValidation) {
  facts.detectedFormat = "text";
  if (blob.size > MAX_JSON_VALIDATION_BYTES) {
    facts.errors.push(`JSON Lines output exceeds the ${MAX_JSON_VALIDATION_BYTES}-byte browser validation limit; use the desktop app for large JSON Lines files.`);
    return;
  }
  const text = await decodeUtf8(blob);
  if (text === undefined) {
    facts.errors.push("JSON Lines output is not valid UTF-8 text.");
    return;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    facts.errors.push("JSON Lines output contains no records.");
    return;
  }
  try {
    lines.forEach((line) => JSON.parse(line));
    facts.detectedFormat = "jsonl";
  } catch {
    facts.errors.push("JSON Lines output contains an invalid record.");
  }
}

async function validateTextOutput(blob: Blob, header: Uint8Array, expectedFormat: ExpectedFormat, facts: OutputValidation) {
  if (expectedFormat === "xml") {
    facts.detectedFormat = "text";
    if (blob.size > MAX_XML_VALIDATION_BYTES) {
      facts.errors.push(`XML output exceeds the ${MAX_XML_VALIDATION_BYTES}-byte browser validation limit; use the desktop app for large XML files.`);
      return;
    }
    const source = await decodeUtf8(blob);
    if (source === undefined) {
      facts.errors.push("XML output is not valid UTF-8 text.");
      return;
    }
    try {
      parseXml(source);
      facts.detectedFormat = "xml";
      facts.warnings.push("XML well-formedness was checked; XML semantics were not validated.");
    } catch (error) {
      facts.errors.push(`XML output is not well formed: ${errorMessage(error)}`);
    }
    return;
  }

  const sample = decodeUtf8Bytes(header);
  if (sample === undefined) {
    facts.errors.push("Text output is not valid UTF-8 text.");
    return;
  }
  facts.detectedFormat = "text";
  const trimmed = sample.trimStart().toLowerCase();
  if (expectedFormat === "svg") {
    if (!/^<svg(?:\s|>)/.test(trimmed) && !/^<\?xml[^>]*>\s*<svg(?:\s|>)/.test(trimmed)) {
      facts.errors.push("SVG output does not begin with an SVG root element.");
      return;
    }
    facts.detectedFormat = "svg";
    facts.warnings.push("SVG root markup was checked; SVG semantics and active content were not validated.");
    return;
  }
  if (expectedFormat === "html") {
    if (!/^<!doctype html(?:\s|>)|^<html(?:\s|>)/.test(trimmed)) {
      facts.errors.push("HTML output does not begin with a document root.");
      return;
    }
    facts.detectedFormat = "html";
    facts.warnings.push("HTML structure was checked; active content was not executed or validated.");
    return;
  }
  facts.warnings.push("Text output encoding was checked; semantic content was not validated.");
}

async function validateBinaryOutput(
  blob: Blob,
  expectedFormat: ExpectedFormat,
  signature: SignatureDetection,
  header: Uint8Array,
  tail: Uint8Array,
  facts: OutputValidation
) {
  if (expectedFormat === "pcm") {
    facts.detectedFormat = "pcm";
    if (blob.size < 2) facts.errors.push("Raw PCM output is too small to contain an audio sample.");
    else facts.warnings.push("Raw PCM has no container header; sample representation is validated by the conversion contract.");
    return;
  }
  if (!signature.valid) {
    facts.errors.push(`Output bytes do not contain a recognized ${expectedFormat.toUpperCase()} signature.`);
    return;
  }
  if (isIsoBaseMediaFormat(expectedFormat) && isIsoBaseMediaFormat(signature.format)) {
    const result = await inspectIsoBaseMedia(blob, expectedFormat);
    facts.detectedFormat = result.detectedFormat;
    if (result.error) facts.errors.push(result.error);
    return;
  }
  if (signature.format === "jpeg") {
    if (!await validJpeg(blob, tail)) facts.errors.push("JPEG structure is truncated or inconsistent.");
    return;
  }
  const error = binaryStructureError(signature.format, header, tail, blob.size);
  if (error) facts.errors.push(error);
}

function binaryStructureError(format: string, header: Uint8Array, tail: Uint8Array, size: number): string | undefined {
  switch (format) {
    case "pdf":
      return includesAscii(tail, "%%EOF") ? undefined : "PDF EOF marker is missing from the output tail.";
    case "png":
      return validPng(header, tail, size) ? undefined : "PNG structure is truncated or inconsistent.";
    case "gif":
      return validGif(header, tail, size) ? undefined : "GIF structure is truncated or inconsistent.";
    case "webp":
      return validWebp(header, size) ? undefined : "WebP structure is truncated or inconsistent.";
    case "bmp":
      return validBmp(header, size) ? undefined : "BMP structure is truncated or inconsistent.";
    case "ico":
      return validIco(header, size) ? undefined : "ICO directory is truncated or inconsistent.";
    case "webm":
      return validWebm(header, size) ? undefined : "WebM EBML header is truncated or inconsistent.";
    case "mka":
      return validMka(header, size) ? undefined : "Matroska audio EBML header is truncated or inconsistent.";
    case "wav":
      return validWav(header, size) ? undefined : "WAV chunks are truncated or inconsistent.";
    case "aiff":
      return validAiff(header, size) ? undefined : "AIFF chunks are truncated or inconsistent.";
    case "caf":
      return validCaf(header, size) ? undefined : "CAF header is truncated or inconsistent.";
    case "ac3":
      return validAc3(header, size, false) ? undefined : "AC-3 frame is truncated or inconsistent.";
    case "eac3":
      return validAc3(header, size, true) ? undefined : "E-AC-3 frame is truncated or inconsistent.";
    case "asf":
      return validAsf(header, size) ? undefined : "ASF/WMA header is truncated or inconsistent.";
    case "wavpack":
      return validWavPack(header, size) ? undefined : "WavPack block is truncated or inconsistent.";
    case "tta":
      return validTta(header, size) ? undefined : "TTA header is truncated or inconsistent.";
    case "au":
      return validAu(header, size) ? undefined : "AU header is truncated or inconsistent.";
    case "wave64":
      return validWave64(header, size) ? undefined : "Wave64 header is truncated or inconsistent.";
    case "mp3":
      return validMp3(header, size) ? undefined : "MP3 frame is truncated or inconsistent.";
    case "mp2":
      return validMp2(header, size) ? undefined : "MP2 frame is truncated or inconsistent.";
    case "aac":
      return validAac(header, size) ? undefined : "AAC ADTS frame is truncated or inconsistent.";
    case "flac":
      return validFlac(header, size) ? undefined : "FLAC STREAMINFO block is truncated or inconsistent.";
    case "ogg":
      return validOgg(header, size) ? undefined : "Ogg page is truncated or inconsistent.";
    case "gzip":
      return validGzip(header, size) ? undefined : "gzip header or trailer is truncated or inconsistent.";
    case "tar":
      return validTar(header, size) ? undefined : "tar header is truncated or has an invalid checksum.";
    case "rar":
      return validRar(header, size) ? undefined : "RAR header is truncated or inconsistent.";
    case "7z":
      return valid7z(header, size) ? undefined : "7z start header is truncated or inconsistent.";
    case "exe":
      return validExe(header, size) ? undefined : "EXE header is truncated or inconsistent.";
    case "woff":
      return validWoff(header, size) ? undefined : "WOFF table directory is truncated or inconsistent.";
    case "woff2":
      return validWoff2(header, size) ? undefined : "WOFF2 header is truncated or inconsistent.";
    case "ttf": case "otf":
      return validSfnt(header, size) ? undefined : `${format.toUpperCase()} table directory is truncated or inconsistent.`;
    default:
      return undefined;
  }
}

function validPng(header: Uint8Array, tail: Uint8Array, size: number) {
  return size >= 45 && uint32BE(header, 8) === 13 && ascii(header.slice(12, 16)) === "IHDR" && uint32BE(header, 16) > 0 && uint32BE(header, 20) > 0 &&
    endsWith(tail, [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
}

async function validJpeg(blob: Blob, tail: Uint8Array) {
  if (blob.size < 28 || !endsWith(tail, [0xff, 0xd9])) return false;
  const start = await readBlobSlice(blob, 0, 2);
  if (!matches(start, [0xff, 0xd8])) return false;

  let offset = 2;
  let segmentCount = 0;
  let metadataBytes = 0;
  let hasFrame = false;

  while (offset < blob.size - 2 && segmentCount < MAX_JPEG_SEGMENT_COUNT) {
    segmentCount += 1;
    const markerBytes = await readBlobSlice(blob, offset, 66);
    if (markerBytes[0] !== 0xff) return false;
    let markerOffset = 1;
    while (markerOffset < markerBytes.length && markerBytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= markerBytes.length || markerOffset > 64) return false;
    const marker = markerBytes[markerOffset];
    offset += markerOffset + 1;

    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const lengthBytes = await readBlobSlice(blob, offset, 2);
    if (lengthBytes.length !== 2) return false;
    const length = uint16BE(lengthBytes, 0);
    if (length < 2 || offset + length > blob.size - 2) return false;
    metadataBytes += length;
    if (metadataBytes > MAX_JPEG_METADATA_BYTES) return false;

    if (isJpegStartOfFrame(marker)) {
      const frame = await readBlobSlice(blob, offset, Math.min(length, 8));
      if (frame.length < 8) return false;
      const components = frame[7];
      if (frame[2] === 0 || uint16BE(frame, 3) === 0 || uint16BE(frame, 5) === 0 || components === 0 || length !== 8 + components * 3) return false;
      hasFrame = true;
    }

    if (marker === 0xda) {
      const scan = await readBlobSlice(blob, offset, Math.min(length, 8));
      if (scan.length < 3) return false;
      const components = scan[2];
      return hasFrame && components > 0 && length === 6 + components * 2 && offset + length < blob.size - 2;
    }

    offset += length;
  }
  return false;
}

function isJpegStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function validGif(header: Uint8Array, tail: Uint8Array, size: number) {
  return size >= 14 && uint16LE(header, 6) > 0 && uint16LE(header, 8) > 0 && tail.at(-1) === 0x3b;
}

function validWebp(header: Uint8Array, size: number) {
  if (size < 20 || uint32LE(header, 4) + 8 !== size) return false;
  const chunk = ascii(header.slice(12, 16));
  const chunkSize = uint32LE(header, 16);
  if (20 + chunkSize + (chunkSize % 2) > size) return false;
  if (chunk === "VP8L") return chunkSize >= 5 && header.length >= 25 && header[20] === 0x2f;
  if (chunk === "VP8X") return chunkSize === 10 && header.length >= 30;
  return chunk === "VP8 " && chunkSize >= 10 && header.length >= 30;
}

function validBmp(header: Uint8Array, size: number) {
  if (size < 54 || uint32LE(header, 2) !== size) return false;
  const pixelOffset = uint32LE(header, 10);
  const dibSize = uint32LE(header, 14);
  return dibSize >= 40 && pixelOffset >= 14 + dibSize && pixelOffset <= size && int32LE(header, 18) !== 0 && int32LE(header, 22) !== 0 && uint16LE(header, 26) === 1;
}

function validIco(header: Uint8Array, size: number) {
  if (size < 22 || uint16LE(header, 0) !== 0 || uint16LE(header, 2) !== 1) return false;
  const count = uint16LE(header, 4);
  if (count < 1 || 6 + count * 16 > header.length || 6 + count * 16 > size) return false;
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const payloadSize = uint32LE(header, offset + 8);
    const payloadOffset = uint32LE(header, offset + 12);
    if (!payloadSize || payloadOffset < 6 + count * 16 || payloadOffset + payloadSize > size) return false;
  }
  return true;
}

const ISO_FAMILY_BRANDS: Readonly<Record<"mp4" | "mov" | "m4a" | "3gp" | "avif", ReadonlySet<string>>> = {
  mp4: new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso7", "iso8", "iso9", "mp41", "mp42", "avc1", "dash", "M4V ", "MSNV"]),
  mov: new Set(["qt  "]),
  m4a: new Set(["M4A ", "M4B ", "M4P "]),
  "3gp": new Set(["3gp1", "3gp2", "3gp3", "3gp4", "3gp5", "3gp6", "3gp7", "3ge6", "3ge7", "3gg6"]),
  avif: new Set(["avif", "avis"])
};
const ISO_GENERIC_BRANDS = new Set(["mif1", "miaf"]);
const ISO_RECOGNIZED_MAJOR_BRANDS = new Set([
  ...ISO_FAMILY_BRANDS.mp4,
  ...ISO_FAMILY_BRANDS.mov,
  ...ISO_FAMILY_BRANDS.m4a,
  ...ISO_FAMILY_BRANDS["3gp"],
  ...ISO_FAMILY_BRANDS.avif,
  ...ISO_GENERIC_BRANDS
]);

function isIsoBaseMediaFormat(format: string): format is "mp4" | "mov" | "m4a" | "3gp" | "avif" {
  return format === "mp4" || format === "mov" || format === "m4a" || format === "3gp" || format === "avif";
}

async function inspectIsoBaseMedia(blob: Blob, expectedFormat: "mp4" | "mov" | "m4a" | "3gp" | "avif") {
  const boxTypes = new Set<string>();
  let majorBrand = "";
  let compatibleBrands: string[] = [];
  let offset = 0;
  let boxCount = 0;
  let ftypCount = 0;

  while (offset < blob.size) {
    boxCount += 1;
    if (boxCount > MAX_ISO_TOP_LEVEL_BOXES) return invalidIso(expectedFormat, `ISO base media exceeds the ${MAX_ISO_TOP_LEVEL_BOXES} top-level box limit.`);
    const header = await readBlobSlice(blob, offset, 16);
    if (header.length < 8) return invalidIso(expectedFormat, "ISO base media contains a truncated top-level box header.");

    const declaredSize = uint32BE(header, 0);
    const type = ascii(header.slice(4, 8));
    let headerSize = 8;
    let boxSize: number;
    if (declaredSize === 0) return invalidIso(expectedFormat, `ISO base media box ${type} has a zero size.`);
    if (declaredSize === 1) {
      if (header.length < 16) return invalidIso(expectedFormat, `ISO base media box ${type} has a truncated extended size.`);
      const extendedSize = new DataView(header.buffer, header.byteOffset, header.byteLength).getBigUint64(8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return invalidIso(expectedFormat, `ISO base media box ${type} size overflows safe offsets.`);
      boxSize = Number(extendedSize);
      headerSize = 16;
    } else {
      boxSize = declaredSize;
    }
    if (boxSize < headerSize || !Number.isSafeInteger(offset + boxSize) || offset + boxSize > blob.size) {
      return invalidIso(expectedFormat, `ISO base media box ${type} is truncated or has an invalid declared size.`);
    }

    boxTypes.add(type);
    if (type === "ftyp") {
      ftypCount += 1;
      if (ftypCount > 1 || offset !== 0) return invalidIso(expectedFormat, "ISO base media must contain exactly one leading ftyp box.");
      if (boxSize < headerSize + 8 || boxSize > MAX_ISO_FTYP_BYTES || (boxSize - headerSize - 8) % 4 !== 0) {
        return invalidIso(expectedFormat, "ISO base media ftyp box is truncated or exceeds its validation bound.");
      }
      const ftyp = await readBlobSlice(blob, offset + headerSize, boxSize - headerSize);
      if (ftyp.length !== boxSize - headerSize) return invalidIso(expectedFormat, "ISO base media ftyp payload is truncated.");
      majorBrand = ascii(ftyp.slice(0, 4));
      compatibleBrands = [];
      for (let brandOffset = 8; brandOffset < ftyp.length; brandOffset += 4) {
        compatibleBrands.push(ascii(ftyp.slice(brandOffset, brandOffset + 4)));
      }
    }
    offset += boxSize;
  }

  if (ftypCount !== 1 || !ISO_RECOGNIZED_MAJOR_BRANDS.has(majorBrand)) {
    return invalidIso(expectedFormat, "ISO base media ftyp does not declare a recognized major brand.");
  }
  const allBrands = new Set([majorBrand, ...compatibleBrands]);
  const detectedFormat = detectIsoFamily(allBrands);
  const hasMediaData = boxTypes.has("mdat");
  const hasFragmentedProfile = allBrands.has("iso6") || allBrands.has("dash");
  const hasRequiredStructure = expectedFormat === "avif"
    ? boxTypes.has("meta") && hasMediaData
    : hasMediaData && (boxTypes.has("moov") || (boxTypes.has("moof") && hasFragmentedProfile));
  if (!hasRequiredStructure) {
    const required = expectedFormat === "avif" ? "meta and mdat" : "moov and mdat, or moof and mdat";
    return { detectedFormat, error: `ISO base media is missing required top-level ${required} boxes.` };
  }

  const declaresExpectedFamily = [...ISO_FAMILY_BRANDS[expectedFormat]].some((brand) => allBrands.has(brand)) && detectedFormat === expectedFormat;
  const genericAudioMp4 = expectedFormat === "m4a" && detectedFormat === "mp4" && await isAudioOnlyIsoBaseMedia(blob);
  if (!allBrands.size || (!declaresExpectedFamily && !genericAudioMp4)) {
    return { detectedFormat, error: `ISO base media brands or tracks do not match the expected ${expectedFormat.toUpperCase()} family.` };
  }
  return { detectedFormat: genericAudioMp4 ? "m4a" : detectedFormat, error: undefined as string | undefined };
}

async function isAudioOnlyIsoBaseMedia(blob: Blob) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(blob), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) return false;
    const [audio, video] = await Promise.all([input.getPrimaryAudioTrack(), input.getPrimaryVideoTrack()]);
    return Boolean(audio) && !video;
  } catch {
    return false;
  } finally {
    input.dispose();
  }
}

function detectIsoFamily(brands: ReadonlySet<string>): "mp4" | "mov" | "m4a" | "3gp" | "avif" | "unknown" {
  if ([...ISO_FAMILY_BRANDS.avif].some((brand) => brands.has(brand))) return "avif";
  if ([...ISO_FAMILY_BRANDS.mov].some((brand) => brands.has(brand))) return "mov";
  if ([...ISO_FAMILY_BRANDS.m4a].some((brand) => brands.has(brand))) return "m4a";
  if ([...ISO_FAMILY_BRANDS["3gp"]].some((brand) => brands.has(brand))) return "3gp";
  if ([...ISO_FAMILY_BRANDS.mp4].some((brand) => brands.has(brand))) return "mp4";
  return "unknown";
}

function invalidIso(expectedFormat: "mp4" | "mov" | "m4a" | "3gp" | "avif", error: string) {
  return { detectedFormat: expectedFormat, error };
}

function validWebm(header: Uint8Array, size: number) {
  return validEbml(header, size, "webm");
}

function validMka(header: Uint8Array, size: number) {
  return validEbml(header, size, "matroska");
}

function validEbml(header: Uint8Array, size: number, documentType: "webm" | "matroska") {
  if (size < 12 || header.length < 5) return false;
  const first = header[4];
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8 || 4 + length > header.length) return false;
  let value = first & (0xff >> length);
  for (let index = 1; index < length; index += 1) value = value * 256 + header[4 + index];
  return 4 + length + value <= size && includesAscii(header.slice(4 + length, Math.min(header.length, 4 + length + value)).map((byte) => byte >= 65 && byte <= 90 ? byte + 32 : byte), documentType);
}

function validWav(header: Uint8Array, size: number) {
  if (size < 44 || uint32LE(header, 4) + 8 !== size) return false;
  let offset = 12;
  let hasFormat = false;
  let hasData = false;
  while (offset + 8 <= header.length && offset + 8 <= size) {
    const type = ascii(header.slice(offset, offset + 4));
    const length = uint32LE(header, offset + 4);
    if (offset + 8 + length > size) return false;
    if (type === "fmt ") hasFormat = length >= 16 && offset + 24 <= header.length && uint16LE(header, offset + 10) > 0;
    if (type === "data") hasData = true;
    offset += 8 + length + (length % 2);
    if (hasFormat && hasData) return true;
  }
  return false;
}

function validAiff(header: Uint8Array, size: number) {
  if (size < 54 || header.length < 12 || uint32BE(header, 4) + 8 !== size) return false;
  let offset = 12;
  let hasCommon = false;
  let hasSoundData = false;
  while (offset + 8 <= header.length && offset + 8 <= size) {
    const type = ascii(header.slice(offset, offset + 4));
    const length = uint32BE(header, offset + 4);
    if (offset + 8 + length > size) return false;
    if (type === "COMM") hasCommon = length >= 18;
    if (type === "SSND") hasSoundData = length >= 8;
    if (hasCommon && hasSoundData) return true;
    offset += 8 + length + (length % 2);
  }
  return false;
}

function validCaf(header: Uint8Array, size: number) {
  return size >= 68 && header.length >= 8 && matches(header, asciiBytes("caff")) && uint16BE(header, 4) === 1 &&
    includesAscii(header, "desc") && includesAscii(header, "data");
}

function validAc3(header: Uint8Array, size: number, enhanced: boolean) {
  if (size < 7 || header.length < 7 || !matches(header, [0x0b, 0x77])) return false;
  const bitstreamId = header[5] >> 3;
  return enhanced ? bitstreamId > 10 && bitstreamId <= 16 : bitstreamId <= 10 && (header[4] >> 6) !== 3;
}

function validAsf(header: Uint8Array, size: number) {
  const guid = [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c];
  if (size < 30 || header.length < 30 || !matches(header, guid)) return false;
  const declared = uint64LE(header, 16);
  return declared !== undefined && declared >= 30n && declared <= BigInt(size);
}

function validWavPack(header: Uint8Array, size: number) {
  if (size < 32 || header.length < 32 || !matches(header, asciiBytes("wvpk"))) return false;
  const blockSize = uint32LE(header, 4) + 8;
  const version = uint16LE(header, 8);
  return blockSize >= 32 && blockSize <= size && version >= 0x0400 && version < 0x0500;
}

function validTta(header: Uint8Array, size: number) {
  return size >= 22 && header.length >= 22 && matches(header, asciiBytes("TTA1")) &&
    uint16LE(header, 6) > 0 && uint32LE(header, 10) > 0 && uint32LE(header, 14) > 0;
}

function validAu(header: Uint8Array, size: number) {
  if (size < 24 || header.length < 24 || !matches(header, asciiBytes(".snd"))) return false;
  const dataOffset = uint32BE(header, 4);
  const encoding = uint32BE(header, 12);
  return dataOffset >= 24 && dataOffset <= size && encoding > 0 && uint32BE(header, 16) > 0 && uint32BE(header, 20) > 0;
}

function validWave64(header: Uint8Array, size: number) {
  if (size < 80 || header.length < 40 || !matches(header, asciiBytes("riff")) || !matches(header, [0x2e, 0x91, 0xcf, 0x11], 4)) return false;
  const declared = uint64LE(header, 16);
  return declared !== undefined && declared >= 40n && declared <= BigInt(size) && includesAscii(header, "wave") && includesAscii(header, "fmt ") && includesAscii(header, "data");
}

function validMp3(header: Uint8Array, size: number) {
  let offset = 0;
  if (matches(header, asciiBytes("ID3"))) {
    if (size < 10 || header.length < 10 || [header[6], header[7], header[8], header[9]].some((byte) => byte > 0x7f)) return false;
    offset = 10 + (header[6] << 21) + (header[7] << 14) + (header[8] << 7) + header[9];
  }
  if (offset + 4 > header.length || offset + 4 > size || header[offset] !== 0xff || (header[offset + 1] & 0xe0) !== 0xe0) return false;
  const version = (header[offset + 1] >> 3) & 3;
  const layer = (header[offset + 1] >> 1) & 3;
  const bitrateIndex = (header[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (header[offset + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return false;
  const bitrateTable = version === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const baseRates = [44100, 48000, 32000];
  const sampleRate = baseRates[sampleRateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const frameLength = Math.floor((version === 3 ? 144 : 72) * bitrateTable[bitrateIndex] * 1000 / sampleRate) + ((header[offset + 2] >> 1) & 1);
  return frameLength >= 24 && offset + frameLength <= size;
}

function validMp2(header: Uint8Array, size: number) {
  if (size < 24 || header.length < 4 || header[0] !== 0xff || (header[1] & 0xe0) !== 0xe0) return false;
  const version = (header[1] >> 3) & 3;
  const layer = (header[1] >> 1) & 3;
  const bitrateIndex = (header[2] >> 4) & 0x0f;
  const sampleRateIndex = (header[2] >> 2) & 3;
  if (version === 1 || layer !== 2 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return false;
  const bitrateTable = version === 3
    ? [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384]
    : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const baseRates = [44_100, 48_000, 32_000];
  const sampleRate = baseRates[sampleRateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  const frameLength = Math.floor(144 * bitrateTable[bitrateIndex] * 1000 / sampleRate) + ((header[2] >> 1) & 1);
  return frameLength >= 24 && frameLength <= size;
}

function isAdtsHeader(header: Uint8Array) {
  return header.length >= 2 && header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
}

function validAac(header: Uint8Array, size: number) {
  if (size < 7 || header.length < 7 || !isAdtsHeader(header)) return false;
  const sampleRateIndex = (header[2] >> 2) & 0x0f;
  const channelConfig = ((header[2] & 1) << 2) | (header[3] >> 6);
  const frameLength = ((header[3] & 3) << 11) | (header[4] << 3) | (header[5] >> 5);
  return sampleRateIndex < 13 && channelConfig > 0 && frameLength >= 7 && frameLength <= size;
}

function validFlac(header: Uint8Array, size: number) {
  if (size < 42 || header.length < 42 || !matches(header, asciiBytes("fLaC"))) return false;
  const blockType = header[4] & 0x7f;
  const blockLength = (header[5] << 16) | (header[6] << 8) | header[7];
  const sampleRate = (header[18] << 12) | (header[19] << 4) | (header[20] >> 4);
  return blockType === 0 && blockLength === 34 && uint16BE(header, 8) > 0 && uint16BE(header, 10) > 0 && sampleRate > 0;
}

function validOgg(header: Uint8Array, size: number) {
  if (size < 29 || header[4] !== 0 || header.length < 27) return false;
  const segments = header[26];
  if (segments < 1 || 27 + segments > header.length) return false;
  let payload = 0;
  for (let index = 0; index < segments; index += 1) payload += header[27 + index];
  return 27 + segments + payload <= size;
}

function validGzip(header: Uint8Array, size: number) {
  return size >= 18 && header.length >= 10 && header[2] === 8 && (header[3] & 0xe0) === 0;
}

function validTar(header: Uint8Array, size: number) {
  if (size < 512 || size % 512 !== 0 || header.length < 512) return false;
  const stored = Number.parseInt(ascii(header.slice(148, 156)).trim().replace(/\0/g, ""), 8);
  if (!Number.isFinite(stored)) return false;
  let calculated = 0;
  for (let index = 0; index < 512; index += 1) calculated += index >= 148 && index < 156 ? 0x20 : header[index];
  return stored === calculated;
}

function validRar(header: Uint8Array, size: number) {
  if (matches(header, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])) {
    const mainOffset = 7;
    if (size < mainOffset + 13 || header.length < mainOffset + 7 || header[mainOffset + 2] !== 0x73) return false;
    const headerSize = uint16LE(header, mainOffset + 5);
    return headerSize >= 13 && mainOffset + headerSize <= size && mainOffset + headerSize <= header.length;
  }
  if (!matches(header, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]) || size < 16 || header.length < 16) return false;

  const sizeField = readRarVint(header, 12, header.length);
  if (!sizeField || sizeField.value < 3n || sizeField.value > BigInt(MAX_OUTPUT_HEADER_BYTES)) return false;
  const headerStart = sizeField.nextOffset;
  const headerEndBig = BigInt(headerStart) + sizeField.value;
  if (headerEndBig > BigInt(size) || headerEndBig > BigInt(header.length)) return false;
  const headerEnd = Number(headerEndBig);
  const type = readRarVint(header, headerStart, headerEnd);
  if (!type || type.value !== 1n) return false;
  const flags = readRarVint(header, type.nextOffset, headerEnd);
  if (!flags) return false;
  let offset = flags.nextOffset;
  if ((flags.value & 1n) !== 0n) {
    const extraSize = readRarVint(header, offset, headerEnd);
    if (!extraSize) return false;
    offset = extraSize.nextOffset;
  }
  if ((flags.value & 2n) !== 0n) {
    const dataSize = readRarVint(header, offset, headerEnd);
    if (!dataSize) return false;
    offset = dataSize.nextOffset;
  }
  const archiveFlags = readRarVint(header, offset, headerEnd);
  return Boolean(archiveFlags && archiveFlags.nextOffset <= headerEnd);
}

function readRarVint(bytes: Uint8Array, offset: number, end: number) {
  let value = 0n;
  for (let index = 0; index < 10 && offset + index < end; index += 1) {
    const byte = bytes[offset + index];
    value |= BigInt(byte & 0x7f) << BigInt(index * 7);
    if ((byte & 0x80) === 0) return { value, nextOffset: offset + index + 1 };
  }
  return undefined;
}

function valid7z(header: Uint8Array, size: number) {
  if (size < 32 || header.length < 32 || header[6] !== 0) return false;
  const nextOffset = uint64LE(header, 12);
  const nextSize = uint64LE(header, 20);
  return nextOffset !== undefined && nextSize !== undefined && 32n + nextOffset + nextSize <= BigInt(size);
}

function validExe(header: Uint8Array, size: number) {
  if (size < 64 || header.length < 64) return false;
  const bytesInLastPage = uint16LE(header, 2);
  const pages = uint16LE(header, 4);
  const declaredSize = pages ? (pages - 1) * 512 + (bytesInLastPage || 512) : 0;
  if (declaredSize && (declaredSize < 64 || declaredSize > size)) return false;
  const peOffset = uint32LE(header, 60);
  return peOffset === 0 || (peOffset + 4 <= header.length && peOffset + 4 <= size && matches(header, [0x50, 0x45, 0, 0], peOffset));
}

function validWoff(header: Uint8Array, size: number) {
  if (size < 64 || header.length < 44 || uint32BE(header, 8) !== size) return false;
  const tables = uint16BE(header, 12);
  if (!tables || 44 + tables * 20 > header.length || 44 + tables * 20 > size) return false;
  for (let index = 0; index < tables; index += 1) {
    const offset = 44 + index * 20;
    const tableOffset = uint32BE(header, offset + 4);
    const compressedLength = uint32BE(header, offset + 8);
    const originalLength = uint32BE(header, offset + 12);
    if (!compressedLength || compressedLength > originalLength || tableOffset + compressedLength > size) return false;
  }
  return true;
}

function validWoff2(header: Uint8Array, size: number) {
  if (size < 49 || header.length < 48 || uint32BE(header, 8) !== size) return false;
  const tables = uint16BE(header, 12);
  const totalSfntSize = uint32BE(header, 16);
  const compressedSize = uint32BE(header, 20);
  return tables > 0 && totalSfntSize >= 12 + tables * 16 && compressedSize > 0 && 48 + compressedSize <= size;
}

function validSfnt(header: Uint8Array, size: number) {
  if (size < 32 || header.length < 12) return false;
  const tables = uint16BE(header, 4);
  if (!tables || 12 + tables * 16 > header.length || 12 + tables * 16 > size) return false;
  for (let index = 0; index < tables; index += 1) {
    const offset = 12 + index * 16;
    const tableOffset = uint32BE(header, offset + 8);
    const tableLength = uint32BE(header, offset + 12);
    if (!tableLength || tableOffset < 12 + tables * 16 || tableOffset + tableLength > size) return false;
  }
  return true;
}

function isExpectedMatch(expectedFormat: ExpectedFormat, detectedFormat: string) {
  return expectedFormat === detectedFormat || (TEXT_FORMATS.has(expectedFormat) && detectedFormat === "text");
}

function isZipHeader(bytes: Uint8Array) {
  return matches(bytes, [0x50, 0x4b, 0x03, 0x04]) || matches(bytes, [0x50, 0x4b, 0x05, 0x06]) || matches(bytes, [0x50, 0x4b, 0x07, 0x08]);
}

function matches(bytes: Uint8Array, signature: readonly number[] | Uint8Array, offset = 0) {
  return offset >= 0 && signature.every((byte, index) => bytes[offset + index] === byte);
}

function endsWith(bytes: Uint8Array, signature: readonly number[]) {
  return matches(bytes, signature, bytes.length - signature.length);
}

function includesAscii(bytes: Uint8Array, value: string) {
  return ascii(bytes).includes(value);
}

function ascii(bytes: Uint8Array) {
  return String.fromCharCode(...bytes);
}

function asciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

function uint16LE(bytes: Uint8Array, offset: number) {
  return offset + 2 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true) : 0;
}

function uint16BE(bytes: Uint8Array, offset: number) {
  return offset + 2 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset) : 0;
}

function uint32LE(bytes: Uint8Array, offset: number) {
  return offset + 4 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true) : 0;
}

function uint32BE(bytes: Uint8Array, offset: number) {
  return offset + 4 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset) : 0;
}

function int32LE(bytes: Uint8Array, offset: number) {
  return offset + 4 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true) : 0;
}

function uint64LE(bytes: Uint8Array, offset: number) {
  return offset + 8 <= bytes.length ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, true) : undefined;
}

async function decodeUtf8(blob: Blob) {
  return decodeUtf8Bytes(new Uint8Array(await blob.arrayBuffer()));
}

async function readBlobSlice(blob: Blob, offset: number, length: number) {
  return new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + length)).arrayBuffer());
}

function decodeUtf8Bytes(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
