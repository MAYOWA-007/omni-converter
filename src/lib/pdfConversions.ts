import { sanitizeGeneratedHtml } from "../core/sanitize";
import { zipLevelFromCompression, zipOutputs } from "./conversionHelpers";
import { selectPdfPageNumbers } from "./pdfPageSelection";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";
import type { ConversionOutput } from "./imageConversions";
import type { LegacyExecutionContext } from "../engines/types";

const PDF_RECIPE_IDS = new Set(["pdf-to-text", "pdf-to-markdown", "pdf-to-html", "pdf-page-png-set", "pdf-page-jpeg-set", "pdf-split-pages", "pdf-extract-pages", "pdf-reorder-pages", "pdf-rotate-pages", "pdf-metadata-report"]);
let pdfWorkerBlobUrl: string | null = null;

export function canConvertPdfRecipe(recipe: ConversionRecipe) {
  return recipe.input.includes("pdf") && PDF_RECIPE_IDS.has(recipe.id);
}

export async function convertPdfRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}, execution?: LegacyExecutionContext): Promise<ConversionOutput[]> {
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 0, total: 1, label: "Preparing PDF conversion" });
  const outputs = await convertPdfRecipeImpl(file, inspection, recipe, settings);
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 1, total: 1, label: "PDF conversion complete" });
  return outputs;
}

async function convertPdfRecipeImpl(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  if (!canConvertPdfRecipe(recipe)) {
    throw new Error("This converter is not available yet.");
  }

  const baseName = baseFileName(file.name);

  switch (recipe.id) {
    case "pdf-to-text":
      return [await createTextFile(file, textOutputName(baseName, "text", settings.batchNaming), "text", settings)];
    case "pdf-to-markdown":
      return [await createTextFile(file, textOutputName(baseName, "markdown", settings.batchNaming), "markdown", settings)];
    case "pdf-to-html":
      return [await createTextFile(file, textOutputName(baseName, "html", settings.batchNaming), "html", settings)];
    case "pdf-page-png-set":
      return [await renderPageImages(file, baseName, "image/png", "png", settings)];
    case "pdf-page-jpeg-set":
      return [await renderPageImages(file, baseName, "image/jpeg", "jpg", settings)];
    case "pdf-split-pages":
      return [await splitPdfPages(file, baseName, settings)];
    case "pdf-extract-pages":
      return [await createSelectedPdf(file, baseName, settings, "extract")];
    case "pdf-reorder-pages":
      return [await createSelectedPdf(file, baseName, settings, "reorder")];
    case "pdf-rotate-pages":
      return [await rotatePdfPages(file, baseName, settings)];
    case "pdf-metadata-report":
      return [await createMetadataReport(file, inspection, baseName, settings)];
    default:
      throw new Error("This PDF output is not available.");
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Conversion was cancelled.", "AbortError");
  }
}

async function createTextFile(file: File, name: string, format: "text" | "markdown" | "html", settings: ConversionSettings): Promise<ConversionOutput> {
  const pages = await extractPageText(file, settings.pageOrder);

  if (format === "markdown") {
    const heading = settings.metadata === "Minimal headings"
      ? []
      : settings.metadata === "Include source metadata"
        ? ["---", `source: \"${file.name.replace(/\"/g, '\\\"')}\"`, `pages: ${pages.length}`, "---", "", `# ${escapeMarkdown(file.name)}`, ""]
        : [`# ${escapeMarkdown(file.name)}`, ""];
    const markdown = [...heading, ...pages.flatMap((page) => [`## Page ${page.pageNumber}`, "", page.text || "_No selectable text found._", ""])].join("\n");
    return { name, blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }) };
  }

  if (format === "html") {
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  <title>${escapeHtml(file.name)}</title>`,
      "  <style>body{margin:3rem auto;max-width:76ch;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#18120d;background:#fffaf0}h1,h2{line-height:1.1}pre{white-space:pre-wrap;font:inherit}</style>",
      "</head>",
      "<body>",
      ...(settings.metadata === "Minimal" ? [] : [`  <h1>${escapeHtml(file.name)}</h1>`, `  <p>${pages.length} selected page${pages.length === 1 ? "" : "s"}</p>`]),
      ...pages.flatMap((page) => [`  <h2>Page ${page.pageNumber}</h2>`, `  <pre>${escapeHtml(page.text || "No selectable text found.")}</pre>`]),
      "</body>",
      "</html>"
    ].join("\n");
    return { name, blob: new Blob([sanitizeGeneratedHtml(html)], { type: "text/html;charset=utf-8" }) };
  }

  const text = settings.metadata === "Remove page breaks"
    ? pages.map((page) => page.text || "No selectable text found.").join("\n")
    : settings.metadata === "Keep page breaks"
      ? pages.map((page) => page.text || "No selectable text found.").join("\n\f\n")
      : pages.map((page) => [`Page ${page.pageNumber}`, "", page.text || "No selectable text found.", ""].join("\n")).join("\n");
  return { name, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) };
}

async function extractPageText(file: File, selection?: string) {
  const pdf = await loadPdf(file);
  try {
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (const pageNumber of selectPdfPageNumbers(pdf.numPages, selection)) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ pageNumber, text });
    }
    return pages;
  } finally {
    await pdf.cleanup();
  }
}

function textOutputName(baseName: string, format: "text" | "markdown" | "html", naming?: string) {
  const extension = format === "text" ? "txt" : format === "markdown" ? "md" : "html";
  const suffix = format === "text" ? "text" : format === "markdown" ? "markdown" : "text";
  return `${baseName}${/suffix/i.test(naming ?? "") ? `-${suffix}` : ""}.${extension}`;
}

async function renderPageImages(file: File, baseName: string, mime: "image/png" | "image/jpeg", extension: "png" | "jpg", settings: ConversionSettings): Promise<ConversionOutput> {
  const pdf = await loadPdf(file);
  const outputs: ConversionOutput[] = [];
  const scale = scaleFromResolution(settings.resolution);
  const quality = mime === "image/jpeg" ? qualityFromCompression(settings.compression) : undefined;
  let selectedPages: number[] = [];

  try {
    selectedPages = selectPdfPageNumbers(pdf.numPages, settings.pageOrder);
    for (const pageNumber of selectedPages) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: mime === "image/png" });
      if (!context) throw new Error("Canvas is not available in this browser.");
      if (mime === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      outputs.push({ name: `pages/${pageOutputName(baseName, pageNumber, extension, settings.batchNaming)}`, blob: await canvasToBlob(canvas, mime, quality) });
    }
  } finally {
    await pdf.cleanup();
  }

  if (/manifest/i.test(settings.bundle ?? "")) {
    outputs.push({
      name: "manifest.json",
      blob: new Blob([JSON.stringify({ source: file.name, output: extension, selectedPages, pages: outputs.map((output) => output.name) }, null, 2)], { type: "application/json" })
    });
  }

  return zipOutputs(`${baseName}-pages-${extension}.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

function pageOutputName(baseName: string, pageNumber: number, extension: string, naming?: string) {
  const padded = String(pageNumber).padStart(3, "0");
  if (naming === "Page number only") return `page-${padded}.${extension}`;
  if (naming === "Clean filename") return `${baseName}-${padded}.${extension}`;
  return `${baseName}-page-${padded}.${extension}`;
}

async function splitPdfPages(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputs: ConversionOutput[] = [];
  const selectedPages = selectPdfPageNumbers(sourcePdf.getPageCount(), settings.pageOrder);

  for (const pageNumber of selectedPages) {
    const outputPdf = await PDFDocument.create();
    const [page] = await outputPdf.copyPages(sourcePdf, [pageNumber - 1]);
    outputPdf.addPage(page);
    const bytes = await outputPdf.save();
    outputs.push({
      name: `pages/${pageOutputName(baseName, pageNumber, "pdf", settings.batchNaming)}`,
      blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" })
    });
  }

  if (/manifest/i.test(settings.bundle ?? "")) {
    outputs.push({
      name: "manifest.json",
      blob: new Blob([JSON.stringify({ source: file.name, selectedPages, pages: outputs.map((output) => output.name) }, null, 2)], { type: "application/json" })
    });
  }

  return zipOutputs(`${baseName}-split-pages.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

async function createSelectedPdf(file: File, baseName: string, settings: ConversionSettings, operation: "extract" | "reorder"): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const output = await PDFDocument.create();
  const selectedPages = selectPdfPageNumbers(source.getPageCount(), settings.pageOrder);
  const copiedPages = await output.copyPages(source, selectedPages.map((pageNumber) => pageNumber - 1));
  for (const page of copiedPages) output.addPage(page);

  if (settings.metadata !== "Strip document details") {
    output.setTitle(`${source.getTitle() || file.name} - ${operation === "extract" ? "extracted pages" : "reordered"}`);
    if (source.getAuthor()) output.setAuthor(source.getAuthor()!);
    if (source.getSubject()) output.setSubject(source.getSubject()!);
  } else {
    output.setProducer("");
    output.setCreator("");
  }

  const suffix = settings.batchNaming === "Clean filename" ? "" : operation === "extract" ? "-extracted" : "-reordered";
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  return { name: `${baseName}${suffix}.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

async function rotatePdfPages(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { degrees, PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const selectedPages = selectPdfPageNumbers(pdf.getPageCount(), settings.pageOrder);
  const selectedIndexes = new Set(selectedPages.map((pageNumber) => pageNumber - 1));
  const delta = settings.rotation === "180 degrees" ? 180 : settings.rotation === "90 degrees counterclockwise" ? -90 : 90;

  for (const [index, page] of pdf.getPages().entries()) {
    if (!selectedIndexes.has(index)) continue;
    page.setRotation(degrees((page.getRotation().angle + delta + 360) % 360));
  }

  if (settings.metadata === "Strip document details") {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
  } else {
    pdf.setTitle(`${pdf.getTitle() || file.name} - rotated`);
  }

  const suffix = settings.batchNaming === "Clean filename" ? "" : "-rotated";
  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  return { name: `${baseName}${suffix}.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

async function createMetadataReport(file: File, inspection: FileInspection, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const pdf = await loadPdf(file);
  try {
    const metadata = await pdf.getMetadata().catch(() => null);
    const compact = settings.metadata === "Document info only";
    const report = {
      source: file.name,
      extension: inspection.extension,
      mime: inspection.mime,
      size: inspection.size,
      pages: pdf.numPages,
      info: metadata?.info ?? null,
      ...(compact ? {} : { metadata: metadata?.metadata?.getRaw() ?? null, generatedAt: new Date().toISOString() })
    };

    return {
      name: `${baseName}${settings.batchNaming === "Clean filename" ? "" : "-metadata"}.json`,
      blob: new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" })
    };
  } finally {
    await pdf.cleanup();
  }
}

async function loadPdf(file: File) {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfWorkerBlobUrl) {
    const { default: pdfWorkerSource } = await import("pdfjs-dist/build/pdf.worker.mjs?raw");
    pdfWorkerBlobUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: "text/javascript" }));
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data }).promise;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error(`${type.replace("image/", "").toUpperCase()} export is not supported by this browser.`));
      },
      type,
      quality
    );
  });
}

function scaleFromResolution(value?: string) {
  if (!value) return 150 / 72;
  if (value.includes("96")) return 96 / 72;
  if (value.includes("150")) return 150 / 72;
  if (value.includes("200")) return 200 / 72;
  if (value.includes("300")) return 300 / 72;
  if (value.includes("4x")) return 4;
  if (value.includes("2x")) return 2;
  return 1.5;
}

function qualityFromCompression(value?: string) {
  if (!value) return 0.9;
  if (/lossless|maximum/i.test(value)) return 0.98;
  if (/high/i.test(value)) return 0.92;
  if (/small/i.test(value)) return 0.72;
  if (/tiny/i.test(value)) return 0.56;
  return 0.86;
}

function baseFileName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "converted-pdf";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
