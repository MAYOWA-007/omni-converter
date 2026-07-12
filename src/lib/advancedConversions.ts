import { sanitizeGeneratedHtml } from "../core/sanitize";
import {
  audioBitrateFromCompression,
  baseFileName,
  canvasToBlob,
  coverRect,
  crfFromCompression,
  escapeHtml,
  escapeMarkdown,
  fitRect,
  parseDelimited,
  qualityFromCompression,
  renderImage,
  toArrayBuffer,
  zipLevelFromCompression,
  zipOutputs,
  type ConversionOutput
} from "./conversionHelpers";
import { selectPdfPageNumbers } from "./pdfPageSelection";
import { convertSpreadsheetToDelimited, convertSpreadsheetToJson, convertStructuredData } from "./dataConversions";
import { convertDocxToHtml, convertDocxToMarkdown, convertPptxText, extractOfficeAssets } from "./officeConversions";
import { compressApplicationPackage as compressApplicationToZip, createExtractedZip, inspectZipArchive, repackZipArchive } from "./archiveConversions";
import { convertEpub } from "./ebookConversions";
import { getFfmpegCoreAssets } from "./ffmpegRuntime";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";
import type { LegacyExecutionContext } from "../engines/types";

const ADVANCED_RECIPE_IDS = new Set([
  "image-ocr-text",
  "image-to-motion-card",
  "pdf-slide-images",
  "pdf-pptx-outline",
  "pdf-carousel-images",
  "pdf-handout-pdf",
  "pdf-extract-images",
  "pdf-ocr-searchable",
  "pdf-compress",
  "video-to-gif",
  "spreadsheet-to-csv",
  "spreadsheet-to-json",
  "spreadsheet-chart-pack",
  "data-json-csv",
  "document-to-markdown",
  "document-to-html",
  "document-assets",
  "presentation-assets",
  "presentation-notes",
  "archive-inspect",
  "archive-extract",
  "archive-repack-zip",
  "font-web-pack",
  "font-specimen",
  "model3d-preview",
  "ebook-to-text",
  "application-compress-zip"
]);

let pdfWorkerBlobUrl: string | null = null;

export function canConvertAdvancedRecipe(recipe: ConversionRecipe) {
  return ADVANCED_RECIPE_IDS.has(recipe.id);
}

export async function convertAdvancedRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}, execution?: LegacyExecutionContext): Promise<ConversionOutput[]> {
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 0, total: 1, label: "Preparing advanced conversion" });
  const outputs = await convertAdvancedRecipeImpl(file, inspection, recipe, settings);
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 1, total: 1, label: "Advanced conversion complete" });
  return outputs;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Conversion was cancelled.", "AbortError");
  }
}

async function convertAdvancedRecipeImpl(file: File, _inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  const baseName = baseFileName(file.name, "converted-file");

  switch (recipe.id) {
    case "image-social-pack":
      return [await createSocialImagePack(file, baseName, settings)];
    case "image-ocr-text":
      return [await createImageOcr(file, baseName, settings)];
    case "image-to-motion-card":
      return [await createImageMotion(file, baseName, settings)];
    case "pdf-slide-images":
      return [await renderPdfPagePack(file, baseName, "slide", settings)];
    case "pdf-carousel-images":
      return [await renderPdfPagePack(file, baseName, "carousel", settings)];
    case "pdf-pptx-outline":
      return [await createPdfPptxOutline(file, baseName, settings)];
    case "pdf-handout-pdf":
      return [await createPdfHandout(file, baseName, settings)];
    case "pdf-extract-images":
      return [await extractPdfImages(file, baseName, settings)];
    case "pdf-ocr-searchable":
      return [await createSearchablePdf(file, baseName, settings)];
    case "pdf-compress":
      return [await compressPdf(file, baseName, settings)];
    case "video-to-gif":
      return [await transcodeWithFfmpeg(file, baseName, "gif", settings)];
    case "spreadsheet-to-csv":
      return [await convertSpreadsheetToDelimited(file, baseName, settings)];
    case "spreadsheet-to-json":
      return [await convertSpreadsheetToJson(file, baseName, settings)];
    case "spreadsheet-chart-pack":
      return [await spreadsheetChartPack(file, baseName, settings)];
    case "data-json-csv":
      return [await convertStructuredData(file, baseName, settings)];
    case "document-to-markdown":
      return [await convertDocxToMarkdown(file, baseName, settings)];
    case "document-to-html":
      return [await convertDocxToHtml(file, baseName, settings)];
    case "document-assets":
      return [await extractOfficeAssets(file, baseName, "document", settings)];
    case "presentation-assets":
      return [await extractOfficeAssets(file, baseName, "presentation", settings)];
    case "presentation-notes":
      return [await convertPptxText(file, baseName, settings)];
    case "archive-inspect":
      return [await inspectZipArchive(file, baseName, settings)];
    case "archive-extract":
      return [await createExtractedZip(file, baseName, settings)];
    case "archive-repack-zip":
      return [await repackZipArchive(file, baseName, settings)];
    case "font-web-pack":
      return [await fontWebPack(file, baseName)];
    case "font-specimen":
      return [await fontSpecimen(file, baseName, settings)];
    case "model3d-preview":
      return [await modelPreviewPack(file, baseName)];
    case "ebook-to-text":
      return [await convertEpub(file, baseName, settings)];
    case "application-compress-zip":
      return compressApplicationToZip(file, baseName, settings);
    default:
      throw new Error("This converter is not available yet.");
  }
}

async function createSocialImagePack(file: File, baseName: string, settings: ConversionSettings) {
  const presets = [
    ["open-graph", 1200, 630],
    ["linkedin-post", 1200, 627],
    ["square", 1080, 1080],
    ["portrait", 1080, 1350],
    ["story", 1080, 1920],
    ["youtube-thumb", 1280, 720],
    ["banner", 1500, 500]
  ] as const;
  const quality = qualityFromCompression(settings.compression);
  const outputs: ConversionOutput[] = [];
  for (const [name, width, height] of presets) {
    const canvas = await renderImage(file, { width, height, fit: "cover", background: "#111111" });
    outputs.push({ name: `social/${baseName}-${name}.jpg`, blob: await canvasToBlob(canvas, "image/jpeg", quality) });
    outputs.push({ name: `social/${baseName}-${name}.webp`, blob: await canvasToBlob(canvas, "image/webp", quality) });
  }
  outputs.push(jsonOutput("manifest.json", { source: file.name, presets: presets.map(([name, width, height]) => ({ name, width, height })) }));
  return zipOutputs(`${baseName}-social-pack.zip`, outputs);
}

async function createImageOcr(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(file);
    const text = result.data.text.trim() || "No text detected.";
    if (settings.outputFormat?.includes("Markdown")) {
      return textOutput(`${baseName}-ocr.md`, `# ${escapeMarkdown(file.name)}\n\n${text}\n`, "text/markdown;charset=utf-8");
    }
    if (settings.outputFormat?.includes("JSON")) {
      return jsonOutput(`${baseName}-ocr.json`, { source: file.name, confidence: result.data.confidence, text });
    }
    return textOutput(`${baseName}-ocr.txt`, text, "text/plain;charset=utf-8");
  } finally {
    await worker.terminate();
  }
}

async function createImageMotion(file: File, baseName: string, settings: ConversionSettings) {
  const duration = secondsFromSetting(settings.timeline, 5);
  const fps = numberFromSetting(settings.frameRate, 24);
  const webm = await recordImageMotionWebm(file, duration, fps);
  const output = (settings.outputFormat ?? "WebM").toLowerCase();
  if (output.includes("mp4")) return transcodeBlobWithFfmpeg(webm, "input.webm", `${baseName}.mp4`, ["-i", "input.webm", "-c:v", "libx264", "-preset", "slow", "-crf", crfFromCompression(settings.compression), "-pix_fmt", "yuv420p", "output.mp4"], "video/mp4");
  if (output.includes("gif")) return transcodeBlobWithFfmpeg(webm, "input.webm", `${baseName}.gif`, ["-i", "input.webm", "-vf", `fps=${Math.min(fps, 15)},scale=720:-1:flags=lanczos`, "-loop", "0", "output.gif"], "image/gif");
  return { name: `${baseName}.webm`, blob: webm };
}

async function renderPdfPagePack(file: File, baseName: string, mode: "slide" | "carousel", settings: ConversionSettings) {
  const pdf = await loadPdf(file);
  const outputs: ConversionOutput[] = [];
  const ratio = aspectSize(settings.aspectRatio, mode === "slide" ? "16:9" : "4:5");
  const width = pixelWidth(settings.resolution, mode === "slide" ? 1920 : 1080);
  const height = Math.round((width * ratio.height) / ratio.width);
  const quality = qualityFromCompression(settings.compression);
  let selectedPages: number[] = [];

  try {
    selectedPages = selectPdfPageNumbers(pdf.numPages, settings.pageOrder);
    for (const pageNumber of selectedPages) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: scaleFromResolution(settings.resolution) });
      const source = document.createElement("canvas");
      source.width = Math.ceil(viewport.width);
      source.height = Math.ceil(viewport.height);
      const sourceContext = source.getContext("2d");
      if (!sourceContext) throw new Error("Canvas is not available in this browser.");
      sourceContext.fillStyle = "#ffffff";
      sourceContext.fillRect(0, 0, source.width, source.height);
      await page.render({ canvasContext: sourceContext, canvas: source, viewport }).promise;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      context.fillStyle = settings.color?.includes("Black") ? "#0b0b0b" : "#ffffff";
      context.fillRect(0, 0, width, height);
      const rect = settings.crop?.includes("Fill") ? coverRect(source.width, source.height, width, height) : fitRect(source.width, source.height, width, height);
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
      const extension = settings.outputFormat?.includes("JPEG") ? "jpg" : "png";
      const mime = extension === "jpg" ? "image/jpeg" : "image/png";
      outputs.push({ name: `${mode}/${pdfPackOutputName(baseName, mode, pageNumber, extension, settings.batchNaming)}`, blob: await canvasToBlob(canvas, mime, extension === "jpg" ? quality : undefined) });
    }
  } finally {
    await pdf.cleanup();
  }
  if (/manifest/i.test(settings.bundle ?? "")) {
    outputs.push(jsonOutput("manifest.json", { source: file.name, mode, width, height, selectedPages, pages: outputs.map((output) => output.name) }));
  }
  return zipOutputs(`${baseName}-${mode}-images.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

function pdfPackOutputName(baseName: string, mode: "slide" | "carousel", pageNumber: number, extension: string, naming?: string) {
  const padded = String(pageNumber).padStart(3, "0");
  if (naming === "Page number only") return `page-${padded}.${extension}`;
  if (naming === "Clean filename") return `${baseName}-${padded}.${extension}`;
  return `${baseName}-${mode}-${padded}.${extension}`;
}

async function createPdfPptxOutline(file: File, baseName: string, settings: ConversionSettings) {
  const pages = await extractPdfText(file, settings.pageOrder);
  const files: ConversionOutput[] = createPptxFiles(settings.metadata === "Include source note" ? file.name : undefined, pages.map((page) => ({ title: `Page ${page.pageNumber}`, body: page.text || "No selectable text found." })));
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-outline";
  return {
    name: `${baseName}${suffix}.pptx`,
    blob: (await zipOutputs(`${baseName}${suffix}.pptx`, files, zipLevelFromCompression(settings.bundle))).blob
  };
}

async function createPdfHandout(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const pageSize = settings.pageSize?.includes("A4") ? [595.28, 841.89] : [612, 792];
  const perSheet = settings.pageLayout?.startsWith("4 ") ? 4 : 2;
  const margin = settings.margins?.includes("Wide") ? 54 : settings.margins?.includes("Narrow") ? 24 : 36;
  const selectedPages = selectPdfPageNumbers(source.getPageCount(), settings.pageOrder);
  const copied = await output.copyPages(source, selectedPages.map((pageNumber) => pageNumber - 1));
  for (let index = 0; index < copied.length; index += perSheet) {
    const page = output.addPage(pageSize as [number, number]);
    const slots = handoutSlots(pageSize[0], pageSize[1], margin, perSheet);
    for (let slotIndex = 0; slotIndex < perSheet && index + slotIndex < copied.length; slotIndex += 1) {
      const embedded = await output.embedPage(copied[index + slotIndex]);
      const slot = slots[slotIndex];
      const fitted = fitRect(embedded.width, embedded.height, slot.width, slot.height);
      page.drawPage(embedded, { x: slot.x + fitted.x, y: slot.y + fitted.y, width: fitted.width, height: fitted.height });
    }
  }
  if (settings.metadata !== "Strip document details") {
    output.setTitle(`${source.getTitle() || file.name} - handout`);
    if (source.getAuthor()) output.setAuthor(source.getAuthor()!);
    if (source.getSubject()) output.setSubject(source.getSubject()!);
  } else {
    output.setProducer("");
    output.setCreator("");
  }
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-handout";
  return { name: `${baseName}${suffix}.pdf`, blob: new Blob([toArrayBuffer(await output.save({ useObjectStreams: true }))], { type: "application/pdf" }) };
}

async function extractPdfImages(file: File, baseName: string, settings: ConversionSettings) {
  const pdf = await loadPdf(file);
  const outputs: ConversionOutput[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const found = await extractPageImageObjects(page, pageNumber, outputs);
      if (!found) {
        const rendered = await renderPdfPageToImage(page, settings, "image/png");
        outputs.push({ name: `rendered-pages/${baseName}-page-${String(pageNumber).padStart(3, "0")}.png`, blob: rendered });
      }
    }
  } finally {
    await pdf.cleanup();
  }
  outputs.push(jsonOutput("manifest.json", { source: file.name, outputs: outputs.map((output) => output.name), note: "Embedded PDF image objects are extracted when exposed by PDF.js; page renders are included as fallbacks." }));
  return zipOutputs(`${baseName}-pdf-assets.zip`, outputs);
}

async function createSearchablePdf(file: File, baseName: string, settings: ConversionSettings) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { createWorker } = await import("tesseract.js");
  const pdf = await loadPdf(file);
  const worker = await createWorker("eng");
  const output = await PDFDocument.create();
  const textSidecar: string[] = [];
  try {
    const font = await output.embedFont(StandardFonts.Helvetica);
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: scaleFromResolution(settings.resolution) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      const imageBlob = await canvasToBlob(canvas, "image/jpeg", 0.86);
      const result = await worker.recognize(imageBlob);
      const text = result.data.text.trim();
      textSidecar.push(`Page ${pageNumber}\n\n${text || "No text detected."}\n`);
      const pdfPage = output.addPage([canvas.width, canvas.height]);
      const jpg = await output.embedJpg(await imageBlob.arrayBuffer());
      pdfPage.drawImage(jpg, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      if (text) {
        pdfPage.drawText(text.slice(0, 3000), { x: 24, y: 24, size: 8, font, color: rgb(1, 1, 1), opacity: 0.01, maxWidth: canvas.width - 48 });
      }
    }
  } finally {
    await worker.terminate();
    await pdf.cleanup();
  }
  if (settings.outputFormat?.includes("TXT")) return textOutput(`${baseName}-ocr.txt`, textSidecar.join("\n"), "text/plain;charset=utf-8");
  if (settings.outputFormat?.includes("Markdown")) return textOutput(`${baseName}-ocr.md`, textSidecar.map((page) => `## ${page}`).join("\n"), "text/markdown;charset=utf-8");
  return { name: `${baseName}-searchable.pdf`, blob: new Blob([toArrayBuffer(await output.save({ useObjectStreams: true }))], { type: "application/pdf" }) };
}

async function compressPdf(file: File, baseName: string, settings: ConversionSettings) {
  if (/visual flattening/i.test(settings.compression ?? "")) {
    return flattenPdfForCompression(file, baseName, settings);
  }

  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  if (settings.metadata?.includes("Strip")) {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
  }
  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-optimized";
  return { name: `${baseName}${suffix}.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

async function flattenPdfForCompression(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const sourceDetails = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const source = await loadPdf(file);
  const output = await PDFDocument.create();
  const smallest = /smallest/i.test(settings.compression ?? "");
  const scale = (smallest ? 96 : 150) / 72;
  const quality = smallest ? 0.52 : 0.76;

  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const pageBox = page.getViewport({ scale: 1 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas is not available in this browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
      const image = await output.embedJpg(await (await canvasToBlob(canvas, "image/jpeg", quality)).arrayBuffer());
      const outputPage = output.addPage([pageBox.width, pageBox.height]);
      outputPage.drawImage(image, { x: 0, y: 0, width: pageBox.width, height: pageBox.height });
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await source.cleanup();
  }

  if (settings.metadata !== "Strip document details") {
    if (sourceDetails.getTitle()) output.setTitle(sourceDetails.getTitle()!);
    if (sourceDetails.getAuthor()) output.setAuthor(sourceDetails.getAuthor()!);
    if (sourceDetails.getSubject()) output.setSubject(sourceDetails.getSubject()!);
    const keywords = sourceDetails.getKeywords();
    if (keywords) output.setKeywords(keywords.split(/[,;]\s*/).filter(Boolean));
  } else {
    output.setProducer("");
    output.setCreator("");
  }

  const suffix = settings.batchNaming === "Clean filename" ? "" : "-optimized";
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  return { name: `${baseName}${suffix}.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

async function transcodeWithFfmpeg(file: File, baseName: string, extension: string, settings: ConversionSettings) {
  const inputName = `input.${file.name.split(".").pop() || "bin"}`;
  const outputName = `output.${extension}`;
  const args = ffmpegArgs(inputName, outputName, extension, settings);
  const blob = await runFfmpeg(file, inputName, outputName, args, mimeForExtension(extension));
  return { name: `${baseName}.${extension}`, blob };
}

async function spreadsheetRows(file: File) {
  if (/\.(xlsx|xls)$/i.test(file.name) || file.type.includes("spreadsheet") || file.type.includes("excel")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  const text = await file.text();
  return parseDelimited(text, file.name.endsWith(".tsv") ? "\t" : ",");
}

async function spreadsheetChartPack(file: File, baseName: string, settings: ConversionSettings) {
  const rows = await spreadsheetRows(file);
  const charts = createChartsFromRows(rows);
  const outputs: ConversionOutput[] = [];
  for (const chart of charts) {
    const svg = chartSvg(chart.title, chart.labels, chart.values);
    outputs.push({ name: `charts/${chart.slug}.svg`, blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }) });
    if (!settings.outputFormat?.includes("SVG charts")) outputs.push({ name: `charts/${chart.slug}.png`, blob: await svgToPng(svg, 1200, 675) });
  }
  outputs.push(jsonOutput("manifest.json", { source: file.name, charts: charts.map((chart) => chart.title) }));
  return zipOutputs(`${baseName}-charts.zip`, outputs);
}

async function fontWebPack(file: File, baseName: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "font";
  const family = baseName.replace(/[-_]+/g, " ");
  return zipOutputs(`${baseName}-web-font-kit.zip`, [
    { name: `fonts/${baseName}.${ext}`, blob: file },
    textOutput(`css/${baseName}.css`, `@font-face{font-family:"${family}";src:url("../fonts/${baseName}.${ext}") format("${fontFormat(ext)}");font-display:swap}body{font-family:"${family}",sans-serif}`, "text/css;charset=utf-8"),
    htmlOutput("specimen.html", family, `<style>@font-face{font-family:"${family}";src:url("fonts/${baseName}.${ext}")}body{font-family:"${family}",sans-serif;margin:3rem;font-size:24px}</style><h1>${escapeHtml(family)}</h1><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>abcdefghijklmnopqrstuvwxyz</p><p>0123456789</p>`),
    textOutput("README.txt", "Web font kit generated locally. Browser font conversion preserves the original font file and provides CSS/specimen assets.", "text/plain;charset=utf-8")
  ]);
}

async function fontSpecimen(file: File, baseName: string, settings: ConversionSettings) {
  const fontUrl = URL.createObjectURL(file);
  const family = `Omni-${baseName}`;
  try {
    const font = new FontFace(family, `url(${fontUrl})`);
    await font.load();
    document.fonts.add(font);
    const canvas = textCardCanvas(baseName, "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\nThe quick brown fox jumps over the lazy dog.", 1600, 1100, family);
    if (settings.outputFormat?.includes("PNG")) return { name: `${baseName}-specimen.png`, blob: await canvasToBlob(canvas, "image/png") };
    if (settings.outputFormat?.includes("SVG")) return textOutput(`${baseName}-specimen.svg`, specimenSvg(baseName, family), "image/svg+xml;charset=utf-8");
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([800, 550]);
    const image = await pdf.embedPng(await (await canvasToBlob(canvas, "image/png")).arrayBuffer());
    page.drawImage(image, { x: 0, y: 0, width: 800, height: 550 });
    return { name: `${baseName}-specimen.pdf`, blob: new Blob([toArrayBuffer(await pdf.save({ useObjectStreams: true }))], { type: "application/pdf" }) };
  } finally {
    URL.revokeObjectURL(fontUrl);
  }
}

async function modelPreviewPack(file: File, baseName: string) {
  const preview = textCardCanvas(baseName, `3D model preview\n${file.name}\n${Math.round(file.size / 1024)} KB`, 1200, 900);
  return zipOutputs(`${baseName}-model-preview.zip`, [
    { name: `${baseName}-preview.png`, blob: await canvasToBlob(preview, "image/png") },
    jsonOutput("model-summary.json", { source: file.name, size: file.size, extension: file.name.split(".").pop()?.toLowerCase(), note: "Preview bundle generated locally. Full mesh rendering is browser/WebGL dependent." })
  ]);
}

async function loadPdf(file: File) {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfWorkerBlobUrl) {
    const { default: pdfWorkerSource } = await import("pdfjs-dist/build/pdf.worker.mjs?raw");
    pdfWorkerBlobUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: "text/javascript" }));
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
  return pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function extractPdfText(file: File, selection?: string) {
  const pdf = await loadPdf(file);
  try {
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (const pageNumber of selectPdfPageNumbers(pdf.numPages, selection)) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: unknown) => (item && typeof item === "object" && "str" in item ? String((item as { str: unknown }).str) : ""))
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

async function renderPdfPageToImage(page: any, settings: ConversionSettings, mime: "image/png" | "image/jpeg") {
  const viewport = page.getViewport({ scale: scaleFromResolution(settings.resolution) });
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
  return canvasToBlob(canvas, mime, mime === "image/jpeg" ? qualityFromCompression(settings.compression) : undefined);
}

async function extractPageImageObjects(page: any, pageNumber: number, outputs: ConversionOutput[]) {
  const pdfjs = await import("pdfjs-dist");
  const ops = await page.getOperatorList();
  const opsCatalog = pdfjs.OPS as Record<string, number>;
  const imageOps = new Set([opsCatalog.paintImageXObject, opsCatalog.paintInlineImageXObject, opsCatalog.paintXObject].filter((value): value is number => typeof value === "number"));
  let count = 0;
  for (let index = 0; index < ops.fnArray.length; index += 1) {
    if (!imageOps.has(ops.fnArray[index])) continue;
    const name = ops.argsArray[index]?.[0];
    if (!name || !page.objs?.get) continue;
    const image = await new Promise<any>((resolve) => page.objs.get(name, resolve));
    if (!image?.data || !image.width || !image.height) continue;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) continue;
    const data = new Uint8ClampedArray(image.data);
    context.putImageData(new ImageData(data, image.width, image.height), 0, 0);
    count += 1;
    outputs.push({ name: `embedded/page-${String(pageNumber).padStart(3, "0")}-image-${String(count).padStart(2, "0")}.png`, blob: await canvasToBlob(canvas, "image/png") });
  }
  return count > 0;
}

async function runFfmpeg(input: File | Blob, inputName: string, outputName: string, args: string[], mime: string) {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  await ffmpeg.load(await getFfmpegCoreAssets());
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(input));
    const code = await ffmpeg.exec(args, 180_000);
    if (code !== 0) throw new Error(`FFmpeg exited with code ${code}.`);
    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return new Blob([toArrayBuffer(bytes)], { type: mime });
  } finally {
    ffmpeg.terminate();
  }
}

async function transcodeBlobWithFfmpeg(blob: Blob, inputName: string, name: string, args: string[], mime: string) {
  return { name, blob: await runFfmpeg(blob, inputName, args.at(-1) ?? name, args, mime) };
}

function ffmpegArgs(inputName: string, outputName: string, extension: string, settings: ConversionSettings) {
  if (extension === "mp4") return ["-i", inputName, "-c:v", "libx264", "-preset", "slow", "-crf", crfFromCompression(settings.compression), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", audioBitrateFromCompression(settings.compression), "-movflags", "faststart", outputName];
  if (extension === "webm") return ["-i", inputName, "-c:v", "libvpx-vp9", "-crf", crfFromCompression(settings.compression), "-b:v", "0", "-c:a", "libopus", "-b:a", audioBitrateFromCompression(settings.compression), outputName];
  if (extension === "gif") return ["-i", inputName, "-vf", `fps=${Math.min(numberFromSetting(settings.frameRate, 12), 15)},scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, "-loop", "0", outputName];
  if (extension === "mp3") return ["-i", inputName, "-vn", "-codec:a", "libmp3lame", "-b:a", audioBitrateFromCompression(settings.compression), outputName];
  if (extension === "aac" || extension === "m4a") return ["-i", inputName, "-vn", "-c:a", "aac", "-b:a", audioBitrateFromCompression(settings.compression), outputName];
  if (extension === "ogg") return ["-i", inputName, "-vn", "-c:a", "libopus", "-b:a", audioBitrateFromCompression(settings.compression), outputName];
  return ["-i", inputName, outputName];
}

function textOutput(name: string, text: string, type: string): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return { name, blob: new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }) };
}

function htmlOutput(name: string, title: string, body: string): ConversionOutput {
  return textOutput(
    name,
    sanitizeGeneratedHtml(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:3rem auto;max-width:82ch;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#18120d;background:#fffaf0}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`),
    "text/html;charset=utf-8"
  );
}

function numberFromSetting(value: string | undefined, fallback: number) {
  const match = value?.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function secondsFromSetting(value: string | undefined, fallback: number) {
  return numberFromSetting(value, fallback);
}

function scaleFromResolution(value?: string) {
  if (!value) return 1.5;
  if (value.includes("512")) return 0.75;
  if (value.includes("1024")) return 1.25;
  if (value.includes("1080")) return 1.5;
  if (value.includes("1920")) return 2;
  if (value.includes("2K")) return 2.25;
  if (value.includes("4K")) return 4;
  if (value.includes("150")) return 1.56;
  if (value.includes("200")) return 2.08;
  if (value.includes("300")) return 3.125;
  return 1.5;
}

function pixelWidth(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  if (value.includes("512")) return 512;
  if (value.includes("1024")) return 1024;
  if (value.includes("1080")) return 1080;
  if (value.includes("1920")) return 1920;
  if (value.includes("2K")) return 2048;
  if (value.includes("4K")) return 3840;
  return fallback;
}

function aspectSize(value: string | undefined, fallback: "16:9" | "4:5") {
  const selected = value || fallback;
  if (selected.includes("1:1")) return { width: 1, height: 1 };
  if (selected.includes("4:5")) return { width: 4, height: 5 };
  if (selected.includes("9:16")) return { width: 9, height: 16 };
  if (selected.includes("4:3")) return { width: 4, height: 3 };
  return { width: 16, height: 9 };
}

function mimeForExtension(extension: string) {
  return (
    {
      mp4: "video/mp4",
      webm: "video/webm",
      gif: "image/gif",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      aac: "audio/aac",
      m4a: "audio/mp4",
      ogg: "audio/ogg"
    } as Record<string, string>
  )[extension] ?? "application/octet-stream";
}

async function recordImageMotionWebm(file: File, duration: number, fps: number) {
  const source = await renderImage(file, { width: 1280, height: 720, fit: "cover", background: "#111111" });
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start();
  const totalFrames = Math.max(1, Math.round(duration * fps));
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const progress = frame / totalFrames;
    const zoom = 1 + progress * 0.08;
    const width = canvas.width * zoom;
    const height = canvas.height * zoom;
    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    await new Promise((resolve) => window.setTimeout(resolve, 1000 / fps));
  }
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: "video/webm" });
}

function handoutSlots(width: number, height: number, margin: number, count: number) {
  if (count === 4) {
    const slotWidth = (width - margin * 3) / 2;
    const slotHeight = (height - margin * 3) / 2;
    return [
      { x: margin, y: margin + slotHeight + margin, width: slotWidth, height: slotHeight },
      { x: margin + slotWidth + margin, y: margin + slotHeight + margin, width: slotWidth, height: slotHeight },
      { x: margin, y: margin, width: slotWidth, height: slotHeight },
      { x: margin + slotWidth + margin, y: margin, width: slotWidth, height: slotHeight }
    ];
  }
  const slotWidth = width - margin * 2;
  const slotHeight = (height - margin * 3) / 2;
  return [
    { x: margin, y: margin + slotHeight + margin, width: slotWidth, height: slotHeight },
    { x: margin, y: margin, width: slotWidth, height: slotHeight }
  ];
}

function createChartsFromRows(rows: unknown[][]) {
  const headers = rows[0] ?? [];
  const body = rows.slice(1);
  const charts: Array<{ title: string; slug: string; labels: string[]; values: number[] }> = [];
  for (let column = 1; column < Math.min(headers.length, 5); column += 1) {
    const values = body.map((row) => Number(row[column])).filter(Number.isFinite);
    if (values.length < 2) continue;
    charts.push({
      title: String(headers[column] || `Column ${column + 1}`),
      slug: baseFileName(String(headers[column] || `chart-${column + 1}`)),
      labels: body.slice(0, values.length).map((row, index) => String(row[0] || index + 1)),
      values
    });
  }
  return charts.length ? charts : [{ title: "Row count", slug: "row-count", labels: ["Rows"], values: [Math.max(0, rows.length - 1)] }];
}

function chartSvg(title: string, labels: string[], values: number[]) {
  const width = 1200;
  const height = 675;
  const max = Math.max(...values, 1);
  const bars = values
    .slice(0, 24)
    .map((value, index) => {
      const barWidth = 900 / Math.min(values.length, 24);
      const h = (value / max) * 420;
      const x = 160 + index * barWidth;
      const y = 560 - h;
      return `<rect x="${x}" y="${y}" width="${Math.max(6, barWidth - 8)}" height="${h}" fill="#d7b76d"/><text x="${x}" y="590" font-size="20" fill="#fffaf0" transform="rotate(45 ${x} 590)">${escapeHtml(labels[index] ?? "")}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0b0b0b"/><text x="60" y="80" font-size="42" fill="#fffaf0" font-family="Georgia">${escapeHtml(title)}</text>${bars}</svg>`;
}

async function svgToPng(svg: string, width: number, height: number) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const image = await renderImage(blob, { width, height, fit: "cover" });
  return canvasToBlob(image, "image/png");
}

function fontFormat(ext: string) {
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  return "truetype";
}

function textCardCanvas(title: string, body: string, width: number, height: number, fontFamily = "Georgia") {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.fillStyle = "#0b0b0b";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d7b76d";
  context.lineWidth = 4;
  context.strokeRect(28, 28, width - 56, height - 56);
  context.fillStyle = "#fffaf0";
  context.font = `bold ${Math.round(width / 22)}px ${fontFamily}, Georgia, serif`;
  context.fillText(title.slice(0, 60), 72, 120);
  context.font = `${Math.round(width / 38)}px ${fontFamily}, system-ui, sans-serif`;
  wrapCanvasText(context, body, 72, 190, width - 144, Math.round(width / 28), height - 230);
  return canvas;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxHeight: number) {
  const words = text.replace(/\s+/g, " ").split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
      line = word;
      if (currentY > y + maxHeight) return;
    } else {
      line = test;
    }
  }
  if (line && currentY <= y + maxHeight) context.fillText(line, x, currentY);
}

function specimenSvg(name: string, family: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><rect width="100%" height="100%" fill="#0b0b0b"/><text x="80" y="160" fill="#fffaf0" font-size="96" font-family="${escapeHtml(family)}">${escapeHtml(name)}</text><text x="80" y="330" fill="#d7b76d" font-size="64" font-family="${escapeHtml(family)}">ABCDEFGHIJKLMNOPQRSTUVWXYZ</text><text x="80" y="460" fill="#d7b76d" font-size="64" font-family="${escapeHtml(family)}">abcdefghijklmnopqrstuvwxyz</text><text x="80" y="590" fill="#d7b76d" font-size="64" font-family="${escapeHtml(family)}">0123456789</text></svg>`;
}

function createPptxFiles(sourceName: string | undefined, slides: Array<{ title: string; body: string }>): ConversionOutput[] {
  const slideFiles = slides.flatMap((slide, index) => {
    const number = index + 1;
    return [
      textOutput(`ppt/slides/slide${number}.xml`, slideXml(slide.title, slide.body), "application/xml"),
      textOutput(`ppt/slides/_rels/slide${number}.xml.rels`, relationshipsXml([
        { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }
      ]), "application/xml")
    ];
  });
  return [
    textOutput("[Content_Types].xml", contentTypesXml(slides.length), "application/xml"),
    textOutput("_rels/.rels", relationshipsXml([{ id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" }]), "application/xml"),
    textOutput("ppt/presentation.xml", presentationXml(slides.length), "application/xml"),
    textOutput("ppt/_rels/presentation.xml.rels", presentationRelsXml(slides.length), "application/xml"),
    textOutput("ppt/presProps.xml", presentationPropertiesXml(), "application/xml"),
    textOutput("ppt/slideMasters/slideMaster1.xml", slideMasterXml(), "application/xml"),
    textOutput("ppt/slideMasters/_rels/slideMaster1.xml.rels", relationshipsXml([
      { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
      { id: "rId2", type: "theme", target: "../theme/theme1.xml" }
    ]), "application/xml"),
    textOutput("ppt/slideLayouts/slideLayout1.xml", slideLayoutXml(), "application/xml"),
    textOutput("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relationshipsXml([
      { id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }
    ]), "application/xml"),
    textOutput("ppt/theme/theme1.xml", themeXml(), "application/xml"),
    ...(sourceName ? [textOutput("ppt/props/source.txt", `Generated from ${sourceName}`, "text/plain")] : []),
    ...slideFiles
  ];
}

function contentTypesXml(count: number) {
  const slides = Array.from({ length: count }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="txt" ContentType="text/plain"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides}</Types>`;
}

function presentationXml(count: number) {
  const ids = Array.from({ length: count }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function presentationRelsXml(count: number) {
  return relationshipsXml([
    { id: "rId1", type: "slideMaster", target: "slideMasters/slideMaster1.xml" },
    ...Array.from({ length: count }, (_, index) => ({ id: `rId${index + 2}`, type: "slide", target: `slides/slide${index + 1}.xml` })),
    { id: `rId${count + 2}`, type: "presProps", target: "presProps.xml" }
  ]);
}

function slideXml(title: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupShapeXml()}${textShapeXml(2, "Title", "title", title, 457200, 274320, 11277600, 1143000, 3600)}${textShapeXml(3, "Body", "body", body.slice(0, 12000), 685800, 1828800, 10820400, 4114800, 1800)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function relationshipsXml(items: Array<{ id: string; type: string; target: string }>) {
  const relationships = items.map((item) => `<Relationship Id="${item.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${item.type}" Target="${item.target}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

function presentationPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
}

function groupShapeXml() {
  return `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
}

function emptyShapeTreeXml() {
  return `<p:spTree>${groupShapeXml()}</p:spTree>`;
}

function textShapeXml(id: number, name: string, placeholder: "title" | "body", text: string, x: number, y: number, width: number, height: number, size: number) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="${placeholder}"${placeholder === "body" ? ' idx="1"' : ""}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${size}"/><a:t>${escapeXmlText(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}

function escapeXmlText(value: string) {
  return escapeHtml(value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""));
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Omni Outline Master">${emptyShapeTreeXml()}</p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="obj" preserve="1"><p:cSld name="Title and Content">${emptyShapeTreeXml()}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Omni Outline"><a:themeElements><a:clrScheme name="Omni"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="F4F1E8"/></a:lt2><a:accent1><a:srgbClr val="B69045"/></a:accent1><a:accent2><a:srgbClr val="366F5A"/></a:accent2><a:accent3><a:srgbClr val="8E4545"/></a:accent3><a:accent4><a:srgbClr val="526A91"/></a:accent4><a:accent5><a:srgbClr val="7B638E"/></a:accent5><a:accent6><a:srgbClr val="3F7C82"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Omni"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Omni"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}
