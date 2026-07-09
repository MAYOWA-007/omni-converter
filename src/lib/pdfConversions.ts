import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";
import type { ConversionOutput } from "./imageConversions";

const PDF_RECIPE_IDS = new Set(["pdf-to-text", "pdf-to-markdown", "pdf-to-html", "pdf-page-png-set", "pdf-page-jpeg-set", "pdf-split-pages", "pdf-metadata-report"]);
let pdfWorkerBlobUrl: string | null = null;

export function canConvertPdfRecipe(recipe: ConversionRecipe) {
  return recipe.input.includes("pdf") && PDF_RECIPE_IDS.has(recipe.id);
}

export async function convertPdfRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  if (!canConvertPdfRecipe(recipe)) {
    throw new Error("This converter is not available yet.");
  }

  const baseName = baseFileName(file.name);

  switch (recipe.id) {
    case "pdf-to-text":
      return [await createTextFile(file, `${baseName}.txt`, "text")];
    case "pdf-to-markdown":
      return [await createTextFile(file, `${baseName}.md`, "markdown")];
    case "pdf-to-html":
      return [await createTextFile(file, `${baseName}.html`, "html")];
    case "pdf-page-png-set":
      return [await renderPageImages(file, baseName, "image/png", "png", settings)];
    case "pdf-page-jpeg-set":
      return [await renderPageImages(file, baseName, "image/jpeg", "jpg", settings)];
    case "pdf-split-pages":
      return [await splitPdfPages(file, baseName)];
    case "pdf-metadata-report":
      return [await createMetadataReport(file, inspection, baseName)];
    default:
      throw new Error("This PDF output is not available.");
  }
}

async function createTextFile(file: File, name: string, format: "text" | "markdown" | "html"): Promise<ConversionOutput> {
  const pages = await extractPageText(file);

  if (format === "markdown") {
    const markdown = [`# ${escapeMarkdown(file.name)}`, "", ...pages.flatMap((page) => [`## Page ${page.pageNumber}`, "", page.text || "_No selectable text found._", ""])].join("\n");
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
      `  <h1>${escapeHtml(file.name)}</h1>`,
      ...pages.flatMap((page) => [`  <h2>Page ${page.pageNumber}</h2>`, `  <pre>${escapeHtml(page.text || "No selectable text found.")}</pre>`]),
      "</body>",
      "</html>"
    ].join("\n");
    return { name, blob: new Blob([html], { type: "text/html;charset=utf-8" }) };
  }

  const text = pages.map((page) => [`Page ${page.pageNumber}`, "", page.text || "No selectable text found.", ""].join("\n")).join("\n");
  return { name, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) };
}

async function extractPageText(file: File) {
  const pdf = await loadPdf(file);
  try {
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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

async function renderPageImages(file: File, baseName: string, mime: "image/png" | "image/jpeg", extension: "png" | "jpg", settings: ConversionSettings): Promise<ConversionOutput> {
  const pdf = await loadPdf(file);
  const outputs: ConversionOutput[] = [];
  const scale = scaleFromResolution(settings.resolution);
  const quality = mime === "image/jpeg" ? qualityFromCompression(settings.compression) : undefined;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
      outputs.push({ name: `pages/${baseName}-page-${String(pageNumber).padStart(3, "0")}.${extension}`, blob: await canvasToBlob(canvas, mime, quality) });
    }
  } finally {
    await pdf.cleanup();
  }

  outputs.push({
    name: "manifest.json",
    blob: new Blob([JSON.stringify({ source: file.name, output: extension, pages: outputs.map((output) => output.name) }, null, 2)], { type: "application/json" })
  });

  return zipOutputs(`${baseName}-pages-${extension}.zip`, outputs);
}

async function splitPdfPages(file: File, baseName: string): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputs: ConversionOutput[] = [];

  for (let index = 0; index < sourcePdf.getPageCount(); index += 1) {
    const outputPdf = await PDFDocument.create();
    const [page] = await outputPdf.copyPages(sourcePdf, [index]);
    outputPdf.addPage(page);
    const bytes = await outputPdf.save();
    outputs.push({
      name: `pages/${baseName}-page-${String(index + 1).padStart(3, "0")}.pdf`,
      blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" })
    });
  }

  outputs.push({
    name: "manifest.json",
    blob: new Blob([JSON.stringify({ source: file.name, pages: outputs.map((output) => output.name) }, null, 2)], { type: "application/json" })
  });

  return zipOutputs(`${baseName}-split-pages.zip`, outputs);
}

async function createMetadataReport(file: File, inspection: FileInspection, baseName: string): Promise<ConversionOutput> {
  const pdf = await loadPdf(file);
  try {
    const metadata = await pdf.getMetadata().catch(() => null);
    const report = {
      source: file.name,
      extension: inspection.extension,
      mime: inspection.mime,
      size: inspection.size,
      pages: pdf.numPages,
      info: metadata?.info ?? null,
      metadata: metadata?.metadata?.getRaw() ?? null,
      generatedAt: new Date().toISOString()
    };

    return {
      name: `${baseName}-metadata.json`,
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

async function zipOutputs(name: string, outputs: ConversionOutput[]): Promise<ConversionOutput> {
  const { strToU8, zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};

  for (const output of outputs) {
    if (output.blob.type.startsWith("text/") || output.name.endsWith(".json") || output.name.endsWith(".webmanifest")) {
      files[output.name] = strToU8(await output.blob.text());
    } else {
      files[output.name] = new Uint8Array(await output.blob.arrayBuffer());
    }
  }

  return {
    name,
    blob: new Blob([toArrayBuffer(zipSync(files, { level: 6 }))], { type: "application/zip" })
  };
}

function scaleFromResolution(value?: string) {
  if (!value) return 1.5;
  if (value.includes("96")) return 1;
  if (value.includes("150")) return 1.56;
  if (value.includes("200")) return 2.08;
  if (value.includes("300")) return 3.125;
  if (value.includes("4x")) return 4;
  if (value.includes("2x")) return 2;
  return 1.5;
}

function qualityFromCompression(value?: string) {
  if (!value) return 0.88;
  if (value.includes("Maximum")) return 0.96;
  if (value.includes("High")) return 0.9;
  if (value.includes("Small")) return 0.72;
  return 0.84;
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
