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
  rowsToCsv,
  rowsToMarkdown,
  rowsToObjects,
  stringifyYaml,
  toArrayBuffer,
  zipLevelFromCompression,
  zipOutputs,
  type ConversionOutput
} from "./conversionHelpers";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";

const ffmpegCoreURL = `${import.meta.env.BASE_URL}assets/ffmpeg/ffmpeg-core.js`;
const ffmpegWasmURL = `${import.meta.env.BASE_URL}assets/ffmpeg/ffmpeg-core.wasm`;

const ADVANCED_RECIPE_IDS = new Set([
  "image-social-pack",
  "image-ocr-text",
  "image-to-motion-card",
  "pdf-slide-images",
  "pdf-pptx-outline",
  "pdf-carousel-images",
  "pdf-handout-pdf",
  "pdf-extract-images",
  "pdf-ocr-searchable",
  "pdf-compress",
  "video-to-frames",
  "video-to-mp4",
  "video-to-webm",
  "video-to-gif",
  "video-to-audio",
  "video-thumbnail-sheet",
  "audio-to-mp3",
  "audio-to-wav",
  "audio-waveform",
  "spreadsheet-to-csv",
  "spreadsheet-to-json",
  "spreadsheet-chart-pack",
  "data-json-csv",
  "document-to-markdown",
  "document-to-html",
  "document-assets",
  "presentation-slide-images",
  "presentation-notes",
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

export async function convertAdvancedRecipe(file: File, _inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
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
      return [await createPdfPptxOutline(file, baseName)];
    case "pdf-handout-pdf":
      return [await createPdfHandout(file, baseName, settings)];
    case "pdf-extract-images":
      return [await extractPdfImages(file, baseName, settings)];
    case "pdf-ocr-searchable":
      return [await createSearchablePdf(file, baseName, settings)];
    case "pdf-compress":
      return [await compressPdf(file, baseName, settings)];
    case "video-to-frames":
      return [await createVideoFrames(file, baseName, settings)];
    case "video-thumbnail-sheet":
      return [await createVideoContactSheet(file, baseName, settings)];
    case "video-to-mp4":
      return [await transcodeWithFfmpeg(file, baseName, "mp4", settings)];
    case "video-to-webm":
      return [await transcodeWithFfmpeg(file, baseName, "webm", settings)];
    case "video-to-gif":
      return [await transcodeWithFfmpeg(file, baseName, "gif", settings)];
    case "video-to-audio":
      return [await transcodeWithFfmpeg(file, baseName, audioExtension(settings.outputFormat), settings)];
    case "audio-to-mp3":
      return [await transcodeWithFfmpeg(file, baseName, "mp3", settings)];
    case "audio-to-wav":
      return [await createWavAudio(file, baseName, settings)];
    case "audio-waveform":
      return [await createWaveformPack(file, baseName, settings)];
    case "spreadsheet-to-csv":
      return [await spreadsheetToDelimited(file, baseName, settings)];
    case "spreadsheet-to-json":
      return [await spreadsheetToJson(file, baseName, settings)];
    case "spreadsheet-chart-pack":
      return [await spreadsheetChartPack(file, baseName, settings)];
    case "data-json-csv":
      return [await transformStructuredData(file, baseName, settings)];
    case "document-to-markdown":
      return [await documentToMarkdown(file, baseName)];
    case "document-to-html":
      return [await documentToHtml(file, baseName)];
    case "document-assets":
      return [await extractZipAssets(file, baseName, "document-assets")];
    case "presentation-slide-images":
      return [await presentationSlideImages(file, baseName, settings)];
    case "presentation-notes":
      return [await presentationNotes(file, baseName, settings)];
    case "archive-extract":
      return [await extractArchive(file, baseName)];
    case "archive-repack-zip":
      return [await repackArchive(file, baseName)];
    case "font-web-pack":
      return [await fontWebPack(file, baseName)];
    case "font-specimen":
      return [await fontSpecimen(file, baseName, settings)];
    case "model3d-preview":
      return [await modelPreviewPack(file, baseName)];
    case "ebook-to-text":
      return [await ebookToText(file, baseName, settings)];
    case "application-compress-zip":
      return [await compressApplicationPackage(file, baseName, settings)];
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

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
      outputs.push({ name: `${mode}/${baseName}-${mode}-${String(pageNumber).padStart(3, "0")}.${extension}`, blob: await canvasToBlob(canvas, mime, extension === "jpg" ? quality : undefined) });
    }
  } finally {
    await pdf.cleanup();
  }
  outputs.push(jsonOutput("manifest.json", { source: file.name, mode, width, height, pages: outputs.map((output) => output.name) }));
  return zipOutputs(`${baseName}-${mode}-images.zip`, outputs);
}

async function createPdfPptxOutline(file: File, baseName: string) {
  const pages = await extractPdfText(file);
  const files: ConversionOutput[] = createPptxFiles(file.name, pages.map((page) => ({ title: `Page ${page.pageNumber}`, body: page.text || "No selectable text found." })));
  return {
    name: `${baseName}-outline.pptx`,
    blob: (await zipOutputs(`${baseName}-outline.pptx`, files)).blob
  };
}

async function createPdfHandout(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const pageSize = settings.pageSize?.includes("A4") ? [595.28, 841.89] : [612, 792];
  const perSheet = settings.pageSize?.includes("4") ? 4 : 2;
  const margin = settings.margins?.includes("Wide") ? 54 : settings.margins?.includes("Narrow") ? 24 : 36;
  const copied = await output.copyPages(source, source.getPageIndices());
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
  return { name: `${baseName}-handout.pdf`, blob: new Blob([toArrayBuffer(await output.save({ useObjectStreams: true }))], { type: "application/pdf" }) };
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
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  if (settings.metadata?.includes("Strip")) {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("Omni Converter");
    pdf.setCreator("Omni Converter");
  }
  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  return { name: `${baseName}-compressed.pdf`, blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }) };
}

async function createVideoFrames(file: File, baseName: string, settings: ConversionSettings) {
  const video = await loadVideo(file);
  try {
    const interval = frameIntervalSeconds(settings.frameInterval);
    const times = timelineSamples(video.duration, interval, 120);
    const outputs: ConversionOutput[] = [];
    const mime = imageMimeFromSetting(settings.outputFormat);
    const ext = extensionForImageMime(mime);
    for (let index = 0; index < times.length; index += 1) {
      await seekVideo(video, times[index]);
      const canvas = videoFrameCanvas(video, pixelWidth(settings.resolution, video.videoWidth || 1280));
      outputs.push({ name: `frames/${baseName}-frame-${String(index + 1).padStart(4, "0")}.${ext}`, blob: await canvasToBlob(canvas, mime, qualityFromCompression(settings.compression)) });
    }
    outputs.push(jsonOutput("manifest.json", { source: file.name, interval, frames: outputs.map((output) => output.name) }));
    return zipOutputs(`${baseName}-frames.zip`, outputs);
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

async function createVideoContactSheet(file: File, baseName: string, _settings: ConversionSettings) {
  const video = await loadVideo(file);
  try {
    const columns = 4;
    const rows = 3;
    const cellWidth = 360;
    const cellHeight = 220;
    const canvas = document.createElement("canvas");
    canvas.width = columns * cellWidth;
    canvas.height = rows * cellHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");
    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const times = timelineSamples(video.duration, video.duration / (columns * rows), columns * rows);
    for (let index = 0; index < times.length; index += 1) {
      await seekVideo(video, times[index]);
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;
      const rect = coverRect(video.videoWidth || cellWidth, video.videoHeight || cellHeight, cellWidth, cellHeight);
      context.drawImage(video, x + rect.x, y + rect.y, rect.width, rect.height);
      context.fillStyle = "rgba(0,0,0,.62)";
      context.fillRect(x, y + cellHeight - 28, cellWidth, 28);
      context.fillStyle = "#fff7e8";
      context.font = "14px system-ui";
      context.fillText(formatTimestamp(times[index]), x + 10, y + cellHeight - 10);
    }
    return { name: `${baseName}-contact-sheet.png`, blob: await canvasToBlob(canvas, "image/png") };
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

async function transcodeWithFfmpeg(file: File, baseName: string, extension: string, settings: ConversionSettings) {
  const inputName = `input.${file.name.split(".").pop() || "bin"}`;
  const outputName = `output.${extension}`;
  const args = ffmpegArgs(inputName, outputName, extension, settings);
  const blob = await runFfmpeg(file, inputName, outputName, args, mimeForExtension(extension));
  return { name: `${baseName}.${extension}`, blob };
}

async function createWavAudio(file: File, baseName: string, settings: ConversionSettings) {
  try {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    await context.close();
    return { name: `${baseName}.wav`, blob: encodeWav(buffer, settings) };
  } catch {
    return transcodeWithFfmpeg(file, baseName, "wav", settings);
  }
}

async function createWaveformPack(file: File, baseName: string, settings: ConversionSettings) {
  const context = new AudioContext();
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  await context.close();
  const peaks = waveformPeaks(buffer, 1200);
  const svg = waveformSvg(peaks, file.name);
  const png = await waveformPng(peaks, settings);
  return zipOutputs(`${baseName}-waveform.zip`, [
    { name: `${baseName}-waveform.svg`, blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }) },
    { name: `${baseName}-waveform.png`, blob: png },
    jsonOutput("peaks.json", { source: file.name, duration: buffer.duration, sampleRate: buffer.sampleRate, peaks })
  ]);
}

async function spreadsheetRows(file: File) {
  if (/\.(xlsx|xls)$/i.test(file.name) || file.type.includes("spreadsheet") || file.type.includes("excel")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  const text = await file.text();
  return parseDelimited(text, file.name.endsWith(".tsv") ? "\t" : ",");
}

async function spreadsheetToDelimited(file: File, baseName: string, settings: ConversionSettings) {
  const rows = await spreadsheetRows(file);
  const delimiter = settings.outputFormat?.includes("TSV") ? "\t" : settings.outputFormat?.includes("Pipe") ? "|" : ",";
  const ext = delimiter === "\t" ? "tsv" : delimiter === "|" ? "txt" : "csv";
  return textOutput(`${baseName}.${ext}`, rowsToCsv(rows, delimiter), delimiter === "\t" ? "text/tab-separated-values;charset=utf-8" : "text/csv;charset=utf-8");
}

async function spreadsheetToJson(file: File, baseName: string, settings: ConversionSettings) {
  const rows = await spreadsheetRows(file);
  const data = settings.outputFormat?.includes("Array of arrays") ? rows : rowsToObjects(rows);
  if (settings.outputFormat?.includes("JSON Lines") && Array.isArray(data)) return textOutput(`${baseName}.jsonl`, data.map((row) => JSON.stringify(row)).join("\n"), "application/x-ndjson;charset=utf-8");
  return jsonOutput(`${baseName}.json`, data);
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

async function transformStructuredData(file: File, baseName: string, settings: ConversionSettings) {
  const text = await file.text();
  const rows = structuredRows(text, file.name);
  const target = settings.outputFormat ?? "JSON";
  if (target.includes("CSV")) return textOutput(`${baseName}.csv`, rowsToCsv(rows), "text/csv;charset=utf-8");
  if (target.includes("TSV")) return textOutput(`${baseName}.tsv`, rowsToCsv(rows, "\t"), "text/tab-separated-values;charset=utf-8");
  if (target.includes("Markdown")) return textOutput(`${baseName}.md`, rowsToMarkdown(rows), "text/markdown;charset=utf-8");
  if (target.includes("XML")) return textOutput(`${baseName}.xml`, rowsToXml(rows), "application/xml;charset=utf-8");
  if (target.includes("YAML")) return textOutput(`${baseName}.yaml`, stringifyYaml(rowsToObjects(rows)), "application/yaml;charset=utf-8");
  return jsonOutput(`${baseName}.json`, rowsToObjects(rows));
}

async function documentToMarkdown(file: File, baseName: string) {
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return textOutput(`${baseName}.md`, `# ${escapeMarkdown(file.name)}\n\n${result.value.trim()}\n`, "text/markdown;charset=utf-8");
  }
  const text = await file.text();
  return textOutput(`${baseName}.md`, `# ${escapeMarkdown(file.name)}\n\n${text.trim()}\n`, "text/markdown;charset=utf-8");
}

async function documentToHtml(file: File, baseName: string) {
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.dataUri });
    return htmlOutput(`${baseName}.html`, file.name, result.value);
  }
  const text = await file.text();
  return htmlOutput(`${baseName}.html`, file.name, `<pre>${escapeHtml(text)}</pre>`);
}

async function presentationSlideImages(file: File, baseName: string, settings: ConversionSettings) {
  const slides = await readPptxSlides(file);
  const outputs: ConversionOutput[] = [];
  const mime = imageMimeFromSetting(settings.outputFormat);
  const ext = extensionForImageMime(mime);
  for (let index = 0; index < slides.length; index += 1) {
    const canvas = textCardCanvas(slides[index].title || `Slide ${index + 1}`, slides[index].text.join("\n"), 1920, 1080);
    outputs.push({ name: `slides/${baseName}-slide-${String(index + 1).padStart(3, "0")}.${ext}`, blob: await canvasToBlob(canvas, mime, qualityFromCompression(settings.compression)) });
  }
  outputs.push(jsonOutput("outline.json", { source: file.name, slides }));
  return zipOutputs(`${baseName}-slide-images.zip`, outputs);
}

async function presentationNotes(file: File, baseName: string, settings: ConversionSettings) {
  const slides = await readPptxSlides(file);
  if (settings.outputFormat?.includes("JSON")) return jsonOutput(`${baseName}-outline.json`, { source: file.name, slides });
  const markdown = slides.map((slide, index) => `## Slide ${index + 1}: ${escapeMarkdown(slide.title || "")}\n\n${escapeMarkdown(slide.text.join("\n"))}`).join("\n\n");
  if (settings.outputFormat?.includes("Markdown")) return textOutput(`${baseName}-notes.md`, `# ${escapeMarkdown(file.name)}\n\n${markdown}\n`, "text/markdown;charset=utf-8");
  return textOutput(`${baseName}-notes.txt`, slides.map((slide, index) => `Slide ${index + 1}: ${slide.title}\n${slide.text.join("\n")}`).join("\n\n"), "text/plain;charset=utf-8");
}

async function extractArchive(file: File, baseName: string) {
  const files = await unzipFile(await file.arrayBuffer());
  const outputs = Object.entries(files).map(([name, bytes]) => ({ name: `extracted/${safeZipPath(name)}`, blob: new Blob([toArrayBuffer(bytes)]) }));
  outputs.push(jsonOutput("manifest.json", { source: file.name, files: Object.keys(files) }));
  return zipOutputs(`${baseName}-extracted.zip`, outputs);
}

async function repackArchive(file: File, baseName: string) {
  const files = await unzipFile(await file.arrayBuffer());
  const outputs = Object.entries(files)
    .filter(([name]) => !name.includes("__MACOSX") && !name.endsWith(".DS_Store"))
    .map(([name, bytes]) => ({ name: safeZipPath(name), blob: new Blob([toArrayBuffer(bytes)]) }));
  outputs.push(jsonOutput("manifest.json", { source: file.name, files: outputs.map((output) => output.name) }));
  return zipOutputs(`${baseName}-repacked.zip`, outputs);
}

async function extractZipAssets(file: File, baseName: string, folder: string) {
  const files = await unzipFile(await file.arrayBuffer());
  const assetEntries = Object.entries(files).filter(([name]) => /media|image|embeddings|assets|\.png$|\.jpe?g$|\.gif$|\.svg$/i.test(name));
  const outputs = (assetEntries.length ? assetEntries : Object.entries(files)).map(([name, bytes]) => ({ name: `${folder}/${safeZipPath(name)}`, blob: new Blob([toArrayBuffer(bytes)]) }));
  outputs.push(jsonOutput("manifest.json", { source: file.name, files: outputs.map((output) => output.name) }));
  return zipOutputs(`${baseName}-${folder}.zip`, outputs);
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

async function ebookToText(file: File, baseName: string, settings: ConversionSettings) {
  const files = await unzipFile(await file.arrayBuffer());
  const chapters = Object.entries(files)
    .filter(([name]) => /\.(xhtml|html|htm)$/i.test(name))
    .map(([name, bytes]) => ({ name, html: new TextDecoder().decode(bytes) }));
  const chapterOutputs = chapters.map((chapter) => ({ name: safeZipPath(chapter.name.replace(/\.(xhtml|html|htm)$/i, ".txt")), text: htmlToText(chapter.html) }));
  if (settings.outputFormat?.includes("HTML")) return htmlOutput(`${baseName}.html`, file.name, chapters.map((chapter) => chapter.html).join("\n"));
  if (settings.outputFormat?.includes("Markdown")) return textOutput(`${baseName}.md`, chapterOutputs.map((chapter) => `## ${escapeMarkdown(chapter.name)}\n\n${chapter.text}`).join("\n\n"), "text/markdown;charset=utf-8");
  if (settings.outputFormat?.includes("ZIP")) return zipOutputs(`${baseName}-chapters.zip`, chapterOutputs.map((chapter) => textOutput(chapter.name, chapter.text, "text/plain;charset=utf-8")));
  return textOutput(`${baseName}.txt`, chapterOutputs.map((chapter) => `${chapter.name}\n\n${chapter.text}`).join("\n\n"), "text/plain;charset=utf-8");
}

async function compressApplicationPackage(file: File, baseName: string, settings: ConversionSettings) {
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const checksum = await sha256Hex(originalBytes);
  const compression = settings.compression || "Maximum Deflate";
  const manifest = {
    source: file.name,
    type: file.type || "application/octet-stream",
    bytes: file.size,
    compression,
    sha256: checksum,
    note: "Executable and installer files are preserved byte-for-byte inside the ZIP. Many application packages are already compressed, so size reduction depends on the source file."
  };

  return zipOutputs(
    `${baseName}-compressed.zip`,
    [
      { name: `original/${safeZipPath(file.name)}`, blob: new Blob([toArrayBuffer(originalBytes)], { type: file.type || "application/octet-stream" }) },
      jsonOutput("manifest.json", manifest),
      textOutput("README.txt", `Compressed application package generated locally.\n\nSource: ${file.name}\nSHA-256: ${checksum}\nOriginal bytes: ${file.size}\nMode: ${compression}\n`, "text/plain;charset=utf-8")
    ],
    zipLevelFromCompression(settings.compression)
  );
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

async function extractPdfText(file: File) {
  const pdf = await loadPdf(file);
  try {
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
  await ffmpeg.load({ coreURL: ffmpegCoreURL, wasmURL: ffmpegWasmURL });
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

function encodeWav(buffer: AudioBuffer, settings: ConversionSettings) {
  const gain = gainFromSetting(settings.audioGain);
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * channels * 2;
  const output = new ArrayBuffer(44 + length);
  const view = new DataView(output);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length, true);
  let offset = 44;
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index] * gain));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([output], { type: "audio/wav" });
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
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:3rem auto;max-width:82ch;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#18120d;background:#fffaf0}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`,
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

function frameIntervalSeconds(value?: string) {
  if (!value || value.includes("Every frame")) return 1;
  return Math.max(0.2, numberFromSetting(value, 1));
}

function timelineSamples(duration: number, interval: number, cap: number) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const times: number[] = [];
  for (let time = 0; time < safeDuration && times.length < cap; time += interval) times.push(Math.min(time, safeDuration - 0.05));
  if (!times.length) times.push(0);
  return times;
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function imageMimeFromSetting(value?: string): "image/png" | "image/jpeg" | "image/webp" {
  if (value?.includes("JPEG")) return "image/jpeg";
  if (value?.includes("WebP")) return "image/webp";
  return "image/png";
}

function extensionForImageMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function audioExtension(value?: string) {
  if (value?.includes("WAV")) return "wav";
  if (value?.includes("AAC")) return "aac";
  if (value?.includes("M4A")) return "m4a";
  if (value?.includes("OGG")) return "ogg";
  return "mp3";
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

async function loadVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("This video could not be decoded by the browser."));
  });
  return video;
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, (video.duration || 0) - 0.05));
  });
}

function videoFrameCanvas(video: HTMLVideoElement, targetWidth: number) {
  const width = targetWidth;
  const height = Math.max(1, Math.round((width / (video.videoWidth || width)) * (video.videoHeight || width)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(video, 0, 0, width, height);
  return canvas;
}

function gainFromSetting(value?: string) {
  if (!value) return 1;
  if (value.includes("-6")) return 0.5;
  if (value.includes("-3")) return 0.707;
  if (value.includes("+3")) return 1.414;
  if (value.includes("+6")) return 2;
  if (value.includes("Mute")) return 0;
  return 1;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function waveformPeaks(buffer: AudioBuffer, points: number) {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / points));
  const peaks: number[] = [];
  for (let index = 0; index < points; index += 1) {
    let peak = 0;
    for (let sample = 0; sample < block; sample += 1) peak = Math.max(peak, Math.abs(data[index * block + sample] ?? 0));
    peaks.push(Number(peak.toFixed(4)));
  }
  return peaks;
}

function waveformSvg(peaks: number[], title: string) {
  const width = 1200;
  const height = 360;
  const bars = peaks
    .map((peak, index) => {
      const x = (index / peaks.length) * width;
      const h = Math.max(2, peak * (height - 60));
      return `<rect x="${x.toFixed(2)}" y="${((height - h) / 2).toFixed(2)}" width="${Math.max(1, width / peaks.length).toFixed(2)}" height="${h.toFixed(2)}" rx="1" fill="#f3dc9d"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0b0b0b"/><title>${escapeHtml(title)}</title>${bars}</svg>`;
}

async function waveformPng(peaks: number[], settings: ConversionSettings) {
  const width = pixelWidth(settings.resolution, 1200);
  const height = Math.round(width * 0.3);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.fillStyle = "#0b0b0b";
  context.fillRect(0, 0, width, height);
  context.fillStyle = settings.color?.includes("Grayscale") ? "#f5f5f5" : "#f3dc9d";
  peaks.forEach((peak, index) => {
    const x = (index / peaks.length) * width;
    const barWidth = Math.max(1, width / peaks.length);
    const barHeight = Math.max(2, peak * (height - 32));
    context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
  });
  return canvasToBlob(canvas, "image/png");
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

function structuredRows(text: string, name: string): unknown[][] {
  const trimmed = text.trim();
  if (name.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const value = JSON.parse(trimmed);
    const rows = Array.isArray(value) ? value : [value];
    if (rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row as Record<string, unknown>))));
      return [keys, ...rows.map((row) => keys.map((key) => (row as Record<string, unknown>)[key] ?? ""))];
    }
    return rows.map((row) => (Array.isArray(row) ? row : [row]));
  }
  if (name.endsWith(".tsv")) return parseDelimited(text, "\t");
  return parseDelimited(text, ",");
}

function rowsToXml(rows: unknown[][]) {
  const objects = rowsToObjects(rows);
  return `<rows>${objects.map((row) => `<row>${Object.entries(row).map(([key, value]) => `<${key}>${escapeHtml(String(value))}</${key}>`).join("")}</row>`).join("")}</rows>`;
}

async function unzipFile(buffer: ArrayBuffer) {
  const { unzipSync } = await import("fflate");
  return unzipSync(new Uint8Array(buffer));
}

async function readPptxSlides(file: File) {
  const { unzipSync } = await import("fflate");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const slideNames = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => numberFromSetting(a, 0) - numberFromSetting(b, 0));
  return slideNames.map((name, index) => {
    const xml = new TextDecoder().decode(files[name]);
    const text = extractXmlText(xml);
    return { number: index + 1, title: text[0] ?? `Slide ${index + 1}`, text };
  });
}

function extractXmlText(xml: string) {
  return Array.from(xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>|<t[^>]*>(.*?)<\/t>/g))
    .map((match) => decodeXml(match[1] ?? match[2] ?? ""))
    .filter(Boolean);
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function safeZipPath(name: string) {
  return name.replace(/^[a-z]+:\/+/i, "").replace(/\.\.+/g, ".").replace(/^\/+/, "");
}

async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

function htmlToText(html: string) {
  return decodeXml(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function createPptxFiles(sourceName: string, slides: Array<{ title: string; body: string }>): ConversionOutput[] {
  const slideFiles = slides.flatMap((slide, index) => {
    const number = index + 1;
    return [
      textOutput(`ppt/slides/slide${number}.xml`, slideXml(slide.title, slide.body), "application/xml"),
      textOutput(`ppt/slides/_rels/slide${number}.xml.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`, "application/xml")
    ];
  });
  return [
    textOutput("[Content_Types].xml", contentTypesXml(slides.length), "application/xml"),
    textOutput("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`, "application/xml"),
    textOutput("ppt/presentation.xml", presentationXml(slides.length), "application/xml"),
    textOutput("ppt/_rels/presentation.xml.rels", presentationRelsXml(slides.length), "application/xml"),
    textOutput("ppt/props/source.txt", `Generated from ${sourceName}`, "text/plain"),
    ...slideFiles
  ];
}

function contentTypesXml(count: number) {
  const slides = Array.from({ length: count }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides}</Types>`;
}

function presentationXml(count: number) {
  const ids = Array.from({ length: count }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/></p:presentation>`;
}

function presentationRelsXml(count: number) {
  const rels = Array.from({ length: count }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function slideXml(title: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="3600"/><a:t>${escapeHtml(title)}</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1800"/><a:t>${escapeHtml(body.slice(0, 2000))}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}
