import type { LegacyExecutionContext } from "../engines/types";
import { baseFileName, escapeHtml, parseDelimited, rowsToCsv, toArrayBuffer, zipLevelFromCompression, zipOutputs, type ConversionOutput } from "./conversionHelpers";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";

export const UNIVERSAL_RECIPE_IDS = new Set([
  "file-to-zip",
  "file-to-gzip",
  "file-checksum-manifest",
  "file-metadata-report",
  "file-byte-analysis",
  "file-to-base64",
  "file-to-data-uri",
  "file-to-hex",
  "file-chunk-zip",
  "text-to-html",
  "text-to-markdown",
  "text-to-json",
  "text-to-pdf",
  "text-line-numbered",
  "text-word-frequency",
  "text-case-pack",
  "json-pretty",
  "json-minify",
  "json-to-jsonl",
  "jsonl-to-json",
  "csv-to-tsv",
  "tsv-to-csv",
  "xml-to-json",
  "json-to-xml"
]);

const MAX_TEXT_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_HEX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_DIGEST_INPUT_BYTES = 256 * 1024 * 1024;
const MAX_CHUNK_ZIP_INPUT_BYTES = 256 * 1024 * 1024;
const BYTE_ANALYSIS_SAMPLE_BYTES = 1024 * 1024;
const CHUNK_BYTES = 10 * 1024 * 1024;

export function canConvertUniversalRecipe(recipe: ConversionRecipe) {
  return UNIVERSAL_RECIPE_IDS.has(recipe.id);
}

export async function convertUniversalRecipe(
  file: File,
  inspection: FileInspection,
  recipe: ConversionRecipe,
  settings: ConversionSettings = {},
  execution?: LegacyExecutionContext
): Promise<ConversionOutput[]> {
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 0, total: 1, label: "Preparing local conversion" });
  const output = await convertUniversalRecipeImpl(file, inspection, recipe, settings, execution?.signal);
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 1, total: 1, label: "Local conversion complete" });
  return [output];
}

async function convertUniversalRecipeImpl(
  file: File,
  inspection: FileInspection,
  recipe: ConversionRecipe,
  settings: ConversionSettings,
  signal?: AbortSignal
): Promise<ConversionOutput> {
  const baseName = baseFileName(file.name, "converted-file");
  switch (recipe.id) {
    case "file-to-zip":
      return zipOutputs(`${baseName}.zip`, [{ name: safeOriginalName(file), blob: file }], zipLevelFromCompression(settings.compression));
    case "file-to-gzip":
      return gzipFile(file, baseName);
    case "file-checksum-manifest":
      return checksumManifest(file, inspection, baseName, signal);
    case "file-metadata-report":
      return jsonOutput(`${baseName}-metadata.json`, metadataReport(file, inspection));
    case "file-byte-analysis":
      return byteAnalysis(file, inspection, baseName, signal);
    case "file-to-base64":
      return textOutput(`${baseName}-base64.txt`, await encodeBase64(file, signal));
    case "file-to-data-uri":
      return textOutput(`${baseName}-data-uri.txt`, `data:${file.type || "application/octet-stream"};base64,${await encodeBase64(file, signal)}`);
    case "file-to-hex":
      return textOutput(`${baseName}-hex.txt`, await encodeHex(file, signal));
    case "file-chunk-zip":
      return chunkedZip(file, baseName, settings, signal);
    case "text-to-html":
      return textToHtml(await readUtf8Text(file), baseName);
    case "text-to-markdown":
      return textOutput(`${baseName}.md`, textToMarkdown(await readUtf8Text(file), file.name), "text/markdown;charset=utf-8");
    case "text-to-json":
      return jsonOutput(`${baseName}.json`, textRecord(await readUtf8Text(file), file));
    case "text-to-pdf":
      return textToPdf(await readUtf8Text(file), baseName, file.name);
    case "text-line-numbered":
      return textOutput(`${baseName}-numbered.txt`, addLineNumbers(await readUtf8Text(file)));
    case "text-word-frequency":
      return jsonOutput(`${baseName}-word-frequency.json`, wordFrequency(await readUtf8Text(file), file.name));
    case "text-case-pack":
      return textCasePack(await readUtf8Text(file), baseName, settings);
    case "json-pretty":
      return jsonTextOutput(`${baseName}-pretty.json`, JSON.stringify(parseJson(await readUtf8Text(file)), null, 2));
    case "json-minify":
      return jsonTextOutput(`${baseName}-min.json`, JSON.stringify(parseJson(await readUtf8Text(file))));
    case "json-to-jsonl":
      return jsonTextOutput(`${baseName}.jsonl`, jsonToJsonLines(parseJson(await readUtf8Text(file))), "application/x-ndjson;charset=utf-8");
    case "jsonl-to-json":
      return jsonOutput(`${baseName}.json`, parseJsonLines(await readUtf8Text(file)));
    case "csv-to-tsv":
      return delimitedOutput(file, baseName, ",", "\t", "tsv");
    case "tsv-to-csv":
      return delimitedOutput(file, baseName, "\t", ",", "csv");
    case "xml-to-json":
      return jsonOutput(`${baseName}.json`, xmlToJson(await readUtf8Text(file)));
    case "json-to-xml":
      return xmlOutput(`${baseName}.xml`, jsonToXml(parseJson(await readUtf8Text(file))));
    default:
      throw new Error("This universal converter is not available.");
  }
}

async function gzipFile(file: File, baseName: string): Promise<ConversionOutput> {
  if (!("CompressionStream" in globalThis)) throw new Error("gzip export requires a current browser with CompressionStream support.");
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  return { name: `${baseName}.${extensionOf(file.name) || "bin"}.gz`, blob: await new Response(stream).blob() };
}

async function checksumManifest(file: File, inspection: FileInspection, baseName: string, signal?: AbortSignal) {
  enforceLimit(file, MAX_DIGEST_INPUT_BYTES, "checksum");
  throwIfAborted(signal);
  const bytes = await file.arrayBuffer();
  throwIfAborted(signal);
  const algorithms = ["SHA-256", "SHA-384", "SHA-512"] as const;
  const checksums = Object.fromEntries(await Promise.all(algorithms.map(async (algorithm) => {
    const digest = new Uint8Array(await crypto.subtle.digest(algorithm, bytes));
    return [algorithm.toLowerCase().replace("-", ""), bytesToHex(digest)];
  })));
  return jsonOutput(`${baseName}-checksums.json`, {
    schema: "omni-converter/checksums/v1",
    source: sourceFacts(file, inspection),
    checksums
  });
}

function metadataReport(file: File, inspection: FileInspection) {
  return {
    schema: "omni-converter/metadata/v1",
    generatedAt: new Date().toISOString(),
    source: sourceFacts(file, inspection),
    detected: {
      family: inspection.family,
      exactFormat: inspection.exactFormat ?? "unknown",
      signatureSource: inspection.signatureSource ?? "unknown",
      dimensions: inspection.width && inspection.height ? { width: inspection.width, height: inspection.height } : undefined,
      durationSeconds: inspection.duration,
      pages: inspection.pages,
      sheets: inspection.sheets,
      slides: inspection.slides,
      audio: inspection.sampleRate ? { sampleRate: inspection.sampleRate, channels: inspection.audioChannels, codec: inspection.audioCodec } : undefined,
      video: inspection.videoCodec ? { codec: inspection.videoCodec } : undefined
    },
    safety: { blocked: Boolean(inspection.riskBlocked), reasons: inspection.riskReasons ?? [] },
    notes: inspection.notes
  };
}

async function byteAnalysis(file: File, inspection: FileInspection, baseName: string, signal?: AbortSignal) {
  const bytes = new Uint8Array(await file.slice(0, BYTE_ANALYSIS_SAMPLE_BYTES).arrayBuffer());
  throwIfAborted(signal);
  const histogram = new Array<number>(256).fill(0);
  for (const byte of bytes) histogram[byte] += 1;
  const entropy = bytes.length
    ? histogram.reduce((sum, count) => count ? sum - (count / bytes.length) * Math.log2(count / bytes.length) : sum, 0)
    : 0;
  const printable = bytes.filter((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)).length;
  return jsonOutput(`${baseName}-byte-analysis.json`, {
    schema: "omni-converter/byte-analysis/v1",
    source: sourceFacts(file, inspection),
    sample: {
      bytesAnalyzed: bytes.length,
      sampleCoveragePercent: file.size ? Number(((bytes.length / file.size) * 100).toFixed(4)) : 100,
      entropyBitsPerByte: Number(entropy.toFixed(6)),
      printableAsciiPercent: bytes.length ? Number(((printable / bytes.length) * 100).toFixed(4)) : 0,
      first64BytesHex: bytesToHex(bytes.slice(0, 64)),
      histogram
    }
  });
}

async function encodeBase64(file: File, signal?: AbortSignal) {
  enforceLimit(file, MAX_BASE64_INPUT_BYTES, "Base64");
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
    if (offset % (0x8000 * 64) === 0) throwIfAborted(signal);
  }
  return btoa(binary);
}

async function encodeHex(file: File, signal?: AbortSignal) {
  enforceLimit(file, MAX_HEX_INPUT_BYTES, "hex dump");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = Array.from(chunk, (byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const ascii = Array.from(chunk, (byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".").join("");
    rows.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
    if (offset % (16 * 65_536) === 0) throwIfAborted(signal);
  }
  return rows.join("\n");
}

async function chunkedZip(file: File, baseName: string, settings: ConversionSettings, signal?: AbortSignal) {
  enforceLimit(file, MAX_CHUNK_ZIP_INPUT_BYTES, "split archive");
  const outputs: ConversionOutput[] = [];
  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  for (let index = 0; index < chunks; index += 1) {
    throwIfAborted(signal);
    const start = index * CHUNK_BYTES;
    outputs.push({
      name: `chunks/${baseName}.part-${String(index + 1).padStart(3, "0")}-of-${String(chunks).padStart(3, "0")}.bin`,
      blob: file.slice(start, Math.min(file.size, start + CHUNK_BYTES))
    });
  }
  outputs.push({ name: "manifest.json", blob: jsonBlob({ schema: "omni-converter/chunks/v1", sourceName: file.name, sourceSize: file.size, chunkBytes: CHUNK_BYTES, chunks }) });
  return zipOutputs(`${baseName}-chunks.zip`, outputs, zipLevelFromCompression(settings.compression));
}

function textToHtml(text: string, baseName: string): ConversionOutput {
  const paragraphs = text.split(/\r?\n\r?\n/).map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, "<br>\n")}</p>`).join("\n");
  const title = escapeHtml(baseName);
  const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${title}</title>\n<style>body{max-width:72ch;margin:4rem auto;padding:0 1.25rem;font:18px/1.65 system-ui,sans-serif;color:#151515}p{white-space:normal}</style>\n</head>\n<body>\n<h1>${title}</h1>\n${paragraphs}\n</body>\n</html>\n`;
  return { name: `${baseName}.html`, blob: new Blob([html], { type: "text/html;charset=utf-8" }) };
}

function textToMarkdown(text: string, sourceName: string) {
  const title = baseFileName(sourceName, "Document").replace(/[-_]+/g, " ");
  return `# ${title}\n\n${text.trim()}\n`;
}

function textRecord(text: string, file: File) {
  const lines = text.split(/\r?\n/);
  return { sourceName: file.name, mime: file.type || "text/plain", characters: text.length, lines: lines.length, content: text };
}

async function textToPdf(text: string, baseName: string, sourceName: string): Promise<ConversionOutput> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 612;
  const height = 792;
  const margin = 54;
  const fontSize = 10.5;
  const lineHeight = 15;
  const maxWidth = width - margin * 2;
  const lines = wrapPdfText(text.replace(/\t/g, "    "), font, fontSize, maxWidth);
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  page.drawText(sourceName, { x: margin, y, size: 14, font: bold, color: rgb(0.08, 0.08, 0.08), maxWidth });
  y -= 28;
  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
    if (line) page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.12, 0.12, 0.12), maxWidth });
    y -= lineHeight;
  }
  const bytes = await pdf.save({ useObjectStreams: true });
  return { name: `${baseName}.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

function wrapPdfText(text: string, font: { widthOfTextAtSize(value: string, size: number): number }, fontSize: number, maxWidth: number) {
  const output: string[] = [];
  for (const sourceLine of text.split(/\r?\n/)) {
    if (!sourceLine) {
      output.push("");
      continue;
    }
    let line = "";
    for (const word of sourceLine.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, fontSize) > maxWidth && line.length > 1) {
        let split = Math.max(1, Math.floor(line.length * maxWidth / font.widthOfTextAtSize(line, fontSize)));
        while (split > 1 && font.widthOfTextAtSize(line.slice(0, split), fontSize) > maxWidth) split -= 1;
        output.push(line.slice(0, split));
        line = line.slice(split);
      }
    }
    output.push(line);
  }
  return output;
}

function addLineNumbers(text: string) {
  const lines = text.split(/\r?\n/);
  const digits = String(lines.length).length;
  return lines.map((line, index) => `${String(index + 1).padStart(digits, "0")} | ${line}`).join("\n");
}

function wordFrequency(text: string, sourceName: string) {
  const words = text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return {
    sourceName,
    totalWords: words.length,
    uniqueWords: counts.size,
    topWords: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 500).map(([word, count]) => ({ word, count }))
  };
}

async function textCasePack(text: string, baseName: string, settings: ConversionSettings) {
  const titleCase = text.toLocaleLowerCase().replace(/\b([\p{L}\p{N}])/gu, (match) => match.toLocaleUpperCase());
  return zipOutputs(`${baseName}-case-pack.zip`, [
    { name: `${baseName}-original.txt`, blob: textBlob(text) },
    { name: `${baseName}-lowercase.txt`, blob: textBlob(text.toLocaleLowerCase()) },
    { name: `${baseName}-uppercase.txt`, blob: textBlob(text.toLocaleUpperCase()) },
    { name: `${baseName}-title-case.txt`, blob: textBlob(titleCase) }
  ], zipLevelFromCompression(settings.compression));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function jsonToJsonLines(value: unknown) {
  const records = Array.isArray(value) ? value : [value];
  return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}

function parseJsonLines(text: string) {
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`JSON Lines record ${index + 1} could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

async function delimitedOutput(file: File, baseName: string, sourceDelimiter: string, targetDelimiter: string, extension: "csv" | "tsv") {
  const rows = parseDelimited(await readUtf8Text(file), sourceDelimiter);
  if (!rows.length) throw new Error("The delimited file does not contain any rows.");
  return textOutput(`${baseName}.${extension}`, rowsToCsv(rows, targetDelimiter), `${extension === "csv" ? "text/csv" : "text/tab-separated-values"};charset=utf-8`);
}

function xmlToJson(source: string): unknown {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("XML DTD and entity declarations are not allowed.");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("XML is not well formed.");
  const root = document.documentElement;
  return { [root.nodeName]: xmlElementValue(root) };
}

function xmlElementValue(element: Element): unknown {
  const children = Array.from(element.children);
  const attributes = Object.fromEntries(Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]));
  const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE).map((node) => node.textContent ?? "").join("").trim();
  if (!children.length && !Object.keys(attributes).length) return text;
  const result: Record<string, unknown> = {};
  if (Object.keys(attributes).length) result["@attributes"] = attributes;
  for (const child of children) {
    const value = xmlElementValue(child);
    const existing = result[child.nodeName];
    result[child.nodeName] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  if (text) result["#text"] = text;
  return result;
}

function jsonToXml(value: unknown) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${jsonValueToXml(value, "item")}</root>\n`;
}

function jsonValueToXml(value: unknown, itemName: string): string {
  if (value === null) return `<${itemName} nil="true"/>`;
  if (Array.isArray(value)) return value.map((item) => jsonValueToXml(item, itemName)).join("");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const name = xmlName(key);
      if (Array.isArray(item)) return item.map((entry) => `<${name}>${jsonValueToXmlContent(entry)}</${name}>`).join("");
      return `<${name}>${jsonValueToXmlContent(item)}</${name}>`;
    }).join("");
  }
  return escapeXml(String(value));
}

function jsonValueToXmlContent(value: unknown): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map((item) => `<item>${jsonValueToXmlContent(item)}</item>`).join("");
  if (typeof value === "object") return jsonValueToXml(value, "item");
  return escapeXml(String(value));
}

function xmlName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `field_${cleaned || "value"}`;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

async function readUtf8Text(file: File) {
  enforceLimit(file, MAX_TEXT_INPUT_BYTES, "text conversion");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("This text conversion requires valid UTF-8 input.");
  }
}

function enforceLimit(file: File, limit: number, label: string) {
  if (file.size > limit) throw new Error(`${label} is limited to ${formatMiB(limit)} per file in the browser.`);
}

function formatMiB(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MiB`;
}

function sourceFacts(file: File, inspection: FileInspection) {
  return { name: file.name, size: file.size, mime: file.type || "application/octet-stream", extension: inspection.extension, family: inspection.family, exactFormat: inspection.exactFormat ?? "unknown" };
}

function safeOriginalName(file: File) {
  const extension = extensionOf(file.name);
  const baseName = baseFileName(file.name, "original");
  return extension ? `${baseName}.${extension}` : baseName;
}

function extensionOf(name: string) {
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function textBlob(text: string, type = "text/plain;charset=utf-8") {
  return new Blob([text], { type });
}

function jsonBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
}

function textOutput(name: string, text: string, type = "text/plain;charset=utf-8"): ConversionOutput {
  return { name, blob: textBlob(text, type) };
}

function jsonTextOutput(name: string, text: string, type = "application/json;charset=utf-8"): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return { name, blob: jsonBlob(value) };
}

function xmlOutput(name: string, value: string): ConversionOutput {
  return { name, blob: new Blob([value], { type: "application/xml;charset=utf-8" }) };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
}
