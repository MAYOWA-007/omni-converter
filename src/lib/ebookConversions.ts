import { normalizeArchivePath } from "../core/archivePaths";
import { sanitizeGeneratedHtml } from "../core/sanitize";
import { escapeHtml, escapeMarkdown, zipLevelFromCompression, zipOutputs, type ConversionOutput } from "./conversionHelpers";
import { htmlToMarkdown } from "./officeConversions";
import { resolveArchiveTarget, withSafeZip, type SafeArchive } from "./safeArchiveReader";
import type { ConversionSettings } from "./types";

const EPUB_MIMETYPE = "application/epub+zip";
const MAX_EPUB_UNCOMPRESSED_BYTES = 128 * 1024 * 1024;

interface EpubChapter {
  number: number;
  sourcePath: string;
  title: string;
  bodyHtml: string;
  markdown: string;
  text: string;
}

interface EpubBook {
  packagePath: string;
  title: string;
  chapters: EpubChapter[];
}

export async function convertEpub(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const book = await readEpub(file);
  const outputFormat = settings.outputFormat ?? "Markdown";
  const includeLabels = settings.metadata !== "Content only";
  const cleanName = settings.batchNaming === "Clean filename";
  const suffix = cleanName ? "" : "-converted";

  if (outputFormat === "TXT") {
    return textOutput(`${baseName}${suffix}.txt`, renderText(book, includeLabels), "text/plain;charset=utf-8");
  }
  if (outputFormat === "Sanitized HTML") {
    return textOutput(`${baseName}${suffix}.html`, renderHtml(book, includeLabels), "text/html;charset=utf-8");
  }
  if (outputFormat === "Text ZIP by chapter" || outputFormat === "HTML ZIP by chapter") {
    const html = outputFormat.startsWith("HTML");
    const extension = html ? "html" : "txt";
    const outputs = book.chapters.map((chapter) => {
      const name = chapterOutputName(chapter, extension, cleanName);
      const content = html ? renderChapterHtml(book.title, chapter, includeLabels) : renderChapterText(chapter, includeLabels);
      return textOutput(`chapters/${name}`, content, html ? "text/html;charset=utf-8" : "text/plain;charset=utf-8");
    });
    outputs.push(jsonOutput("manifest.json", {
      source: file.name,
      title: book.title,
      packagePath: book.packagePath,
      chapters: book.chapters.map((chapter, index) => ({
        number: chapter.number,
        title: chapter.title,
        sourcePath: chapter.sourcePath,
        output: outputs[index].name
      }))
    }));
    const kind = html ? "html" : "text";
    return zipOutputs(`${baseName}-chapters-${kind}.zip`, outputs, zipLevelFromCompression(settings.bundle));
  }

  return textOutput(`${baseName}${suffix}.md`, renderMarkdown(book, includeLabels), "text/markdown;charset=utf-8");
}

async function readEpub(file: File): Promise<EpubBook> {
  return withSafeZip(file, async (archive) => {
    assertEpubArchive(archive);
    const mimetype = (await archive.require("mimetype").text(128)).trim();
    if (mimetype !== EPUB_MIMETYPE) throw new Error("EPUB mimetype entry is missing or invalid.");

    const container = parseXml(await archive.require("META-INF/container.xml").text(), "EPUB container");
    const rootfile = Array.from(container.getElementsByTagNameNS("*", "rootfile"))
      .find((element) => element.getAttribute("media-type") === "application/oebps-package+xml")
      ?? container.getElementsByTagNameNS("*", "rootfile")[0];
    const packagePath = normalizeArchivePath(rootfile?.getAttribute("full-path") ?? "");
    if (!packagePath) throw new Error("EPUB container does not declare a package document.");

    const packageDocument = parseXml(await archive.require(packagePath).text(), "EPUB package");
    const title = firstXmlText(packageDocument, "title") || file.name.replace(/\.epub$/i, "") || "Untitled ebook";
    const manifest = new Map(Array.from(packageDocument.getElementsByTagNameNS("*", "item")).map((item) => [
      item.getAttribute("id") ?? "",
      { href: item.getAttribute("href") ?? "", mediaType: item.getAttribute("media-type") ?? "" }
    ]));
    const orderedItems = Array.from(packageDocument.getElementsByTagNameNS("*", "itemref"));
    if (!orderedItems.length) throw new Error("EPUB package does not contain a reading-order spine.");

    const chapters: EpubChapter[] = [];
    for (const itemref of orderedItems) {
      const idref = itemref.getAttribute("idref") ?? "";
      const item = manifest.get(idref);
      if (!item) throw new Error(`EPUB spine references a missing manifest item: ${idref}`);
      if (!/^(?:application\/xhtml\+xml|text\/html)$/i.test(item.mediaType)) continue;
      const sourcePath = resolveArchiveTarget(packagePath, item.href);
      const source = await archive.require(sourcePath).text();
      chapters.push(parseChapter(source, sourcePath, chapters.length + 1));
    }
    if (!chapters.length) throw new Error("EPUB spine contains no readable HTML chapters.");
    return { packagePath, title, chapters };
  });
}

function assertEpubArchive(archive: SafeArchive) {
  if (archive.totalUncompressedBytes > MAX_EPUB_UNCOMPRESSED_BYTES) {
    throw new Error(`EPUB package exceeds the ${MAX_EPUB_UNCOMPRESSED_BYTES} byte browser processing limit.`);
  }
  archive.require("mimetype");
  archive.require("META-INF/container.xml");
}

function parseChapter(source: string, sourcePath: string, number: number): EpubChapter {
  parseXml(source, `EPUB chapter ${sourcePath}`);
  const sanitized = sanitizeGeneratedHtml(source);
  const document = new DOMParser().parseFromString(sanitized, "text/html");
  document.querySelectorAll("img").forEach((image) => {
    const replacement = document.createElement("span");
    replacement.textContent = `[Image${image.getAttribute("alt") ? `: ${image.getAttribute("alt")}` : ""}]`;
    image.replaceWith(replacement);
  });
  const bodyHtml = document.body.innerHTML.trim();
  const title = document.querySelector("h1, h2")?.textContent?.trim()
    || document.querySelector("title")?.textContent?.trim()
    || sourcePath.split("/").pop()?.replace(/\.(?:xhtml|html|htm)$/i, "")
    || `Chapter ${number}`;
  return {
    number,
    sourcePath,
    title,
    bodyHtml,
    markdown: htmlToMarkdown(bodyHtml).trim(),
    text: htmlFragmentToText(bodyHtml)
  };
}

function renderText(book: EpubBook, includeLabels: boolean) {
  const header = includeLabels ? `${book.title}\n${"=".repeat(Math.min(book.title.length, 80))}\n\n` : "";
  return `${header}${book.chapters.map((chapter) => renderChapterText(chapter, includeLabels)).join("\n\n")}\n`;
}

function renderChapterText(chapter: EpubChapter, includeLabels: boolean) {
  return `${includeLabels ? `Chapter ${chapter.number}: ${chapter.title}\n\n` : ""}${chapter.text}`.trim();
}

function renderMarkdown(book: EpubBook, includeLabels: boolean) {
  const header = includeLabels ? `# ${escapeMarkdown(book.title)}\n\n` : "";
  const chapters = book.chapters.map((chapter) => `${includeLabels ? `## Chapter ${chapter.number}: ${escapeMarkdown(chapter.title)}\n\n` : ""}${chapter.markdown}`.trim());
  return `${header}${chapters.join("\n\n")}\n`;
}

function renderHtml(book: EpubBook, includeLabels: boolean) {
  const chapters = book.chapters.map((chapter) => `<section>${includeLabels ? `<h2>Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</h2>` : ""}${chapter.bodyHtml}</section>`).join("\n");
  return standaloneHtml(book.title, `${includeLabels ? `<h1>${escapeHtml(book.title)}</h1>` : ""}${chapters}`);
}

function renderChapterHtml(bookTitle: string, chapter: EpubChapter, includeLabels: boolean) {
  return standaloneHtml(`${bookTitle} - ${chapter.title}`, `${includeLabels ? `<h1>Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</h1>` : ""}${chapter.bodyHtml}`);
}

function standaloneHtml(title: string, body: string) {
  return sanitizeGeneratedHtml(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:3rem auto;max-width:82ch;padding:0 1rem;font:16px/1.65 system-ui,sans-serif;color:#18120d;background:#fffaf0}section+section{margin-top:3rem}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`);
}

function htmlFragmentToText(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  return Array.from(document.body.childNodes).map(textFromNode).join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function textFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!(node instanceof Element)) return "";
  if (node.tagName.toLowerCase() === "br") return "\n";
  const content = Array.from(node.childNodes).map(textFromNode).filter(Boolean).join(" ").replace(/ +/g, " ").trim();
  return content;
}

function chapterOutputName(chapter: EpubChapter, extension: string, cleanName: boolean) {
  const number = String(chapter.number).padStart(3, "0");
  const slug = chapter.title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || `chapter-${chapter.number}`;
  return `${number}-${slug}${cleanName ? "" : "-converted"}.${extension}`;
}

function parseXml(source: string, label: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${label} declarations and entities are not supported.`);
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`${label} contains malformed XML.`);
  return document;
}

function firstXmlText(document: Document, localName: string) {
  return document.getElementsByTagNameNS("*", localName)[0]?.textContent?.trim() ?? "";
}

function textOutput(name: string, text: string, type: string): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return textOutput(name, JSON.stringify(value, null, 2), "application/json;charset=utf-8");
}
