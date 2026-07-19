import { sanitizeGeneratedHtml } from "../core/sanitize";
import { escapeHtml, escapeMarkdown, zipLevelFromCompression, zipOutputs, type ConversionOutput } from "./conversionHelpers";
import { selectSlideNumbers } from "./presentationOptions";
import { resolveArchiveTarget, withSafeZip, type SafeArchive } from "./safeArchiveReader";
import type { ConversionSettings } from "./types";

const MAX_OFFICE_UNCOMPRESSED_BYTES = 128 * 1024 * 1024;
const RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
type PresentationAssetKind = "all" | "image" | "audio" | "video";

const PRESENTATION_ASSET_EXTENSIONS: Record<Exclude<PresentationAssetKind, "all">, ReadonlySet<string>> = {
  image: new Set(["apng", "avif", "bmp", "dib", "emf", "gif", "heic", "heif", "jfif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp", "wmf"]),
  audio: new Set(["aac", "ac3", "aif", "aiff", "amr", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "wma"]),
  video: new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm", "wmv"])
};

export interface PresentationSlide {
  number: number;
  title: string;
  visibleText: string[];
  notes: string[];
}

export async function convertDocxToMarkdown(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  await validateOfficePackage(file, "word/document.xml");
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.dataUri });
  const sourceHeading = settings.metadata === "Include source filename" ? `# ${escapeMarkdown(file.name)}\n\n` : "";
  const markdown = `${sourceHeading}${htmlToMarkdown(result.value).trim()}\n`;
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
  return textOutput(`${baseName}${suffix}.md`, markdown, "text/markdown;charset=utf-8");
}

export async function convertDocxToHtml(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  await validateOfficePackage(file, "word/document.xml");
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.dataUri });
  const body = settings.metadata === "Omit images" ? removeHtmlImages(result.value) : result.value;
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
  return htmlOutput(`${baseName}${suffix}.html`, file.name, body);
}

export async function extractOfficeAssets(file: File, baseName: string, family: "document" | "presentation", settings: ConversionSettings, assetKind: PresentationAssetKind = "all"): Promise<ConversionOutput> {
  const prefix = family === "document" ? "word/media/" : "ppt/media/";
  const packageRoot = family === "document" ? "word/document.xml" : "ppt/presentation.xml";
  return withSafeZip(file, async (archive) => {
    assertOfficeArchive(archive, packageRoot);
    const packageAssets = archive.entries.filter((entry) => entry.name.toLowerCase().startsWith(prefix));
    const assets = family === "presentation" && assetKind !== "all"
      ? packageAssets.filter((entry) => presentationAssetKind(entry.name) === assetKind)
      : packageAssets;
    if (!assets.length) {
      const qualifier = family === "presentation" && assetKind !== "all" ? `${assetKind} ` : "";
      throw new Error(`This Office package contains no embedded ${qualifier}assets.`);
    }
    const outputDirectory = family === "presentation" && assetKind !== "all" ? assetKind === "image" ? "images" : assetKind : "assets";
    const outputs: ConversionOutput[] = [];
    for (const asset of assets) {
      outputs.push({ name: `${outputDirectory}/${asset.name.slice(prefix.length)}`, blob: await asset.blob(mimeForName(asset.name)) });
    }
    if (settings.metadata !== "Assets only") {
      outputs.push(jsonOutput("manifest.json", {
        source: file.name,
        family,
        ...(family === "presentation" ? { assetKind } : {}),
        assets: assets.map((asset, index) => ({ sourcePath: asset.name, output: outputs[index].name, bytes: asset.uncompressedSize }))
      }));
    }
    const suffix = settings.batchNaming === "Clean filename" ? "" : assetKind === "all" ? "-assets" : assetKind === "image" ? "-images" : `-${assetKind}`;
    return zipOutputs(`${baseName}${suffix}.zip`, outputs, zipLevelFromCompression(settings.bundle));
  });
}

function presentationAssetKind(name: string): Exclude<PresentationAssetKind, "all"> | null {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  for (const kind of ["image", "audio", "video"] as const) {
    if (PRESENTATION_ASSET_EXTENSIONS[kind].has(extension)) return kind;
  }
  return null;
}

export async function convertPptxText(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const slides = await readPptxSlides(file);
  const selected = selectSlideNumbers(slides.length, settings.slideSelection).map((number) => slides[number - 1]);
  const detail = settings.metadata ?? "Visible text + speaker notes";
  const output = settings.outputFormat ?? "Markdown";
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-notes";

  if (output === "JSON outline") return jsonOutput(`${baseName}${suffix}.json`, { source: file.name, slides: selected.map((slide) => selectedSlideValue(slide, detail)) });
  if (output === "TXT") {
    const text = selected.map((slide) => slideTextBlock(slide, detail)).join("\n\n");
    return textOutput(`${baseName}${suffix}.txt`, `${text}\n`, "text/plain;charset=utf-8");
  }
  const markdown = selected.map((slide) => slideMarkdownBlock(slide, detail)).join("\n\n");
  return textOutput(`${baseName}${suffix}.md`, `# ${escapeMarkdown(file.name)}\n\n${markdown}\n`, "text/markdown;charset=utf-8");
}

export async function readPptxSlides(file: File): Promise<PresentationSlide[]> {
  return withSafeZip(file, async (archive) => {
    assertOfficeArchive(archive, "ppt/presentation.xml");
    const presentation = parseXml(await archive.require("ppt/presentation.xml").text());
    const relationships = await relationshipMap(archive, "ppt/_rels/presentation.xml.rels");
    const orderedPaths = Array.from(presentation.getElementsByTagNameNS("*", "sldId")).map((element) => {
      const id = element.getAttributeNS(RELATIONSHIPS_NAMESPACE, "id") ?? element.getAttribute("r:id") ?? "";
      const relationship = relationships.get(id);
      if (!relationship || relationship.external || !relationship.type.endsWith("/slide")) throw new Error(`Presentation slide relationship is missing or invalid: ${id}`);
      return resolveArchiveTarget("ppt/presentation.xml", relationship.target);
    });
    if (!orderedPaths.length) throw new Error("The presentation contains no slides.");

    const slides: PresentationSlide[] = [];
    for (let index = 0; index < orderedPaths.length; index += 1) {
      const path = orderedPaths[index];
      const slide = parseSlideXml(await archive.require(path).text(), index + 1);
      slide.notes = await readSlideNotes(archive, path);
      slides.push(slide);
    }
    return slides;
  });
}

export function htmlToMarkdown(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  const blocks = Array.from(document.body.childNodes).map(renderMarkdownBlock).filter(Boolean);
  return sanitizeMarkdownLinks(blocks.join("\n\n").replace(/\n{3,}/g, "\n\n"));
}

async function validateOfficePackage(file: File, requiredPart: string) {
  await withSafeZip(file, (archive) => assertOfficeArchive(archive, requiredPart));
}

function assertOfficeArchive(archive: SafeArchive, requiredPart: string) {
  if (archive.totalUncompressedBytes > MAX_OFFICE_UNCOMPRESSED_BYTES) throw new Error(`Office package exceeds the ${MAX_OFFICE_UNCOMPRESSED_BYTES} byte browser processing limit.`);
  archive.require("[Content_Types].xml");
  archive.require("_rels/.rels");
  archive.require(requiredPart);
}

async function readSlideNotes(archive: SafeArchive, slidePath: string) {
  const slash = slidePath.lastIndexOf("/");
  const relationshipsPath = `${slidePath.slice(0, slash)}/_rels/${slidePath.slice(slash + 1)}.rels`;
  if (!archive.find(relationshipsPath)) return [];
  const relationships = await relationshipMap(archive, relationshipsPath);
  const notes = Array.from(relationships.values()).find((relationship) => !relationship.external && relationship.type.endsWith("/notesSlide"));
  if (!notes) return [];
  const notesPath = resolveArchiveTarget(slidePath, notes.target);
  return xmlTextValues(parseXml(await archive.require(notesPath).text()));
}

function parseSlideXml(source: string, number: number): PresentationSlide {
  const document = parseXml(source);
  const visibleText = xmlTextValues(document);
  let title = "";
  for (const shape of Array.from(document.getElementsByTagNameNS("*", "sp"))) {
    const placeholder = shape.getElementsByTagNameNS("*", "ph")[0];
    const type = placeholder?.getAttribute("type") ?? "";
    if (type === "title" || type === "ctrTitle") {
      title = xmlTextValues(shape).join(" ").trim();
      break;
    }
  }
  return { number, title: title || visibleText[0] || `Slide ${number}`, visibleText, notes: [] };
}

interface Relationship {
  type: string;
  target: string;
  external: boolean;
}

async function relationshipMap(archive: SafeArchive, path: string) {
  const document = parseXml(await archive.require(path).text());
  return new Map(Array.from(document.getElementsByTagNameNS("*", "Relationship")).map((element) => [
    element.getAttribute("Id") ?? "",
    {
      type: element.getAttribute("Type") ?? "",
      target: element.getAttribute("Target") ?? "",
      external: element.getAttribute("TargetMode") === "External"
    } satisfies Relationship
  ]));
}

function parseXml(source: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Office XML declarations and entities are not supported.");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Office package contains malformed XML.");
  return document;
}

function xmlTextValues(root: Document | Element) {
  return Array.from(root.getElementsByTagNameNS("*", "t")).map((element) => element.textContent?.trim() ?? "").filter(Boolean);
}

function selectedSlideValue(slide: PresentationSlide, detail: string) {
  return {
    number: slide.number,
    title: slide.title,
    ...(detail !== "Speaker notes only" ? { visibleText: slide.visibleText } : {}),
    ...(detail !== "Visible text only" ? { notes: slide.notes } : {})
  };
}

function slideMarkdownBlock(slide: PresentationSlide, detail: string) {
  const sections = [`## Slide ${slide.number}: ${escapeMarkdown(slide.title)}`];
  if (detail !== "Speaker notes only") sections.push(slide.visibleText.map((text) => escapeMarkdown(text)).join("  \n") || "No visible text.");
  if (detail !== "Visible text only") sections.push(`### Speaker notes\n\n${slide.notes.map((text) => escapeMarkdown(text)).join("  \n") || "No speaker notes."}`);
  return sections.join("\n\n");
}

function slideTextBlock(slide: PresentationSlide, detail: string) {
  const lines = [`Slide ${slide.number}: ${slide.title}`];
  if (detail !== "Speaker notes only") lines.push(...slide.visibleText);
  if (detail !== "Visible text only") lines.push("Speaker notes:", ...(slide.notes.length ? slide.notes : ["No speaker notes."]));
  return lines.join("\n");
}

function sanitizeMarkdownLinks(source: string) {
  return source.replace(/\]\(([^)]+)\)/g, (match, target: string) => {
    const compact = target.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
    return /^(?:javascript|vbscript|data|file):/.test(compact) ? "]" : match;
  });
}

function renderMarkdownBlock(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return renderMarkdownText(node.textContent ?? "").trim();
  if (!(node instanceof Element)) return "";
  const tag = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${renderMarkdownInlineChildren(node).trim()}`;
  if (tag === "p") return renderMarkdownInlineChildren(node).trim();
  if (tag === "ul" || tag === "ol") return renderMarkdownList(node, tag === "ol");
  if (tag === "table") return renderMarkdownTable(node);
  if (tag === "blockquote") return renderMarkdownInlineChildren(node).split("\n").map((line) => `> ${line}`).join("\n");
  if (tag === "pre") return `\`\`\`\n${node.textContent ?? ""}\n\`\`\``;
  return Array.from(node.childNodes).map(renderMarkdownBlock).filter(Boolean).join("\n\n");
}

function renderMarkdownInlineChildren(node: Node) {
  return Array.from(node.childNodes).map(renderMarkdownInline).join("").replace(/[ \t]+/g, " ");
}

function renderMarkdownInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return renderMarkdownText(node.textContent ?? "");
  if (!(node instanceof Element)) return "";
  const tag = node.tagName.toLowerCase();
  const content = renderMarkdownInlineChildren(node);
  if (tag === "strong" || tag === "b") return `**${content.trim()}**`;
  if (tag === "em" || tag === "i") return `*${content.trim()}*`;
  if (tag === "s" || tag === "del") return `~~${content.trim()}~~`;
  if (tag === "code") return `\`${(node.textContent ?? "").replace(/`/g, "\\`")}\``;
  if (tag === "br") return "  \n";
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    return href && isSafeLink(href) ? `[${content.trim()}](${href})` : content;
  }
  if (tag === "img") return `![${renderMarkdownText(node.getAttribute("alt") ?? "image")}]`;
  return content;
}

function renderMarkdownList(list: Element, ordered: boolean): string {
  const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === "li");
  return items.map((item, index) => {
    const direct = Array.from(item.childNodes).filter((node) => !(node instanceof Element && /^(ul|ol)$/i.test(node.tagName))).map(renderMarkdownInline).join("").trim();
    const nested: string = Array.from(item.children).filter((child) => /^(ul|ol)$/i.test(child.tagName)).map((child): string => renderMarkdownList(child, child.tagName.toLowerCase() === "ol").split("\n").map((line: string) => `  ${line}`).join("\n")).join("\n");
    return `${ordered ? `${index + 1}.` : "-"} ${direct}${nested ? `\n${nested}` : ""}`;
  }).join("\n");
}

function removeHtmlImages(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  document.querySelectorAll("img").forEach((image) => image.remove());
  return document.body.innerHTML;
}

function renderMarkdownTable(table: Element) {
  const rows = Array.from(table.getElementsByTagName("tr")).map((row) => Array.from(row.children)
    .filter((cell) => /^(td|th)$/i.test(cell.tagName))
    .map((cell) => renderMarkdownInlineChildren(cell).trim().replace(/\|/g, "\\|").replace(/\n/g, "<br>")));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
  return [normalized[0], Array.from({ length: width }, () => "---"), ...normalized.slice(1)]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function renderMarkdownText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/([`*_[\]])/g, "\\$1");
}

function isSafeLink(value: string) {
  const compact = value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  return !/^(?:javascript|vbscript|data|file):/.test(compact);
}

function htmlOutput(name: string, title: string, body: string): ConversionOutput {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:3rem auto;max-width:82ch;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#18120d;background:#fffaf0}img{max-width:100%;height:auto}table{border-collapse:collapse}th,td{border:1px solid #aaa;padding:.4rem}</style></head><body>${body}</body></html>`;
  return textOutput(name, sanitizeGeneratedHtml(html), "text/html;charset=utf-8");
}

function textOutput(name: string, text: string, type: string): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return textOutput(name, JSON.stringify(value, null, 2), "application/json;charset=utf-8");
}

function mimeForName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", oga: "audio/ogg", ogg: "audio/ogg", opus: "audio/ogg", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}
