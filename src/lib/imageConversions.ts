import { sanitizeGeneratedHtml } from "../core/sanitize";
import { qualityFromCompression, zipLevelFromCompression, zipOutputs } from "./conversionHelpers";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";
import type { LegacyExecutionContext } from "../engines/types";

export interface ConversionOutput {
  name: string;
  blob: Blob;
}

const IMAGE_RECIPE_IDS = new Set([
  "image-to-pdf",
  "image-print-pdf",
  "image-to-png",
  "image-to-jpeg",
  "image-to-webp",
  "image-to-avif",
  "image-to-bmp",
  "image-svg-wrapper",
  "image-data-uri",
  "image-html-embed",
  "image-thumbnail-set",
  "image-favicon-set",
  "image-format-bundle",
  "image-social-pack"
]);

export function canConvertImageRecipe(recipe: ConversionRecipe) {
  return recipe.input.includes("image") && IMAGE_RECIPE_IDS.has(recipe.id);
}

export async function convertImageRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}, execution?: LegacyExecutionContext): Promise<ConversionOutput[]> {
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 0, total: 1, label: "Preparing image conversion" });
  const outputs = await convertImageRecipeImpl(file, inspection, recipe, settings);
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 1, total: 1, label: "Image conversion complete" });
  return outputs;
}

async function convertImageRecipeImpl(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  if (!canConvertImageRecipe(recipe)) {
    throw new Error("This output is not wired to the image converter yet.");
  }

  switch (recipe.id) {
    case "image-to-pdf":
      return [await createPdf(file, inspection, "image", settings)];
    case "image-print-pdf":
      return [await createPdf(file, inspection, "letter", settings)];
    case "image-to-png":
      return [await convertRasterFormat(file, "png", settings)];
    case "image-to-jpeg":
      return [await convertRasterFormat(file, "jpeg", settings)];
    case "image-to-webp":
      return [await convertRasterFormat(file, "webp", settings)];
    case "image-to-avif":
      return [await convertRasterFormat(file, "avif", settings)];
    case "image-to-bmp":
      return [await convertBmp(file, settings)];
    case "image-svg-wrapper":
      return [await createSvgWrapper(file, inspection, settings)];
    case "image-data-uri":
      return [await createDataUriText(file, settings)];
    case "image-html-embed":
      return [await createHtmlEmbed(file, inspection, settings)];
    case "image-thumbnail-set":
      return [await createThumbnailZip(file, settings)];
    case "image-favicon-set":
      return [await createFaviconZip(file, settings)];
    case "image-format-bundle":
      return [await createFormatBundle(file, settings)];
    case "image-social-pack":
      return [await createSocialPack(file, settings)];
    default:
      throw new Error("This image output is not available.");
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Conversion was cancelled.", "AbortError");
  }
}

type RasterFormat = "png" | "jpeg" | "webp" | "avif";

async function convertRasterFormat(file: File, format: RasterFormat, settings: ConversionSettings): Promise<ConversionOutput> {
  const type = `image/${format}`;
  const extension = format === "jpeg" ? "jpg" : format;
  const canvas = await renderRasterImage(file, settings, format === "jpeg" ? "#ffffff" : undefined);
  const quality = format === "jpeg" || format === "webp" || format === "avif" ? qualityFromCompression(settings.compression) : undefined;
  const blob = await canvasToBlob(canvas, type, quality);
  return {
    name: `${outputBaseName(file.name, settings.batchNaming, extension)}.${extension}`,
    blob
  };
}

async function createPdf(file: File, inspection: FileInspection, mode: "image" | "letter", settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const sourceCanvas = await renderImage(file, { background: "#ffffff" });
  const layout = pdfLayout(settings, mode, sourceCanvas.width, sourceCanvas.height);
  const canvas = settings.crop === "Fill page"
    ? await renderImage(file, { ...cropCanvasSize(sourceCanvas.width, sourceCanvas.height, layout.contentWidth / layout.contentHeight), fit: "cover", background: "#ffffff" })
    : sourceCanvas;
  const jpeg = await canvasToBlob(canvas, "image/jpeg", qualityFromCompression(settings.compression));
  const imageBytes = await jpeg.arrayBuffer();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(imageBytes);
  const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
  const placement = settings.crop === "Fill page"
    ? { x: 0, y: 0, width: layout.contentWidth, height: layout.contentHeight }
    : fitRect(image.width, image.height, layout.contentWidth, layout.contentHeight);
  page.drawImage(image, {
    x: layout.margin + placement.x,
    y: layout.margin + placement.y,
    width: placement.width,
    height: placement.height
  });

  if (settings.metadata !== "Strip source details") {
    pdf.setTitle(file.name);
    pdf.setSubject(`Image conversion from ${inspection.exactFormat ?? inspection.extension ?? "image"}`);
  }

  const bytes = await pdf.save();
  const outputBase = outputBaseName(file.name, settings.batchNaming, mode === "letter" ? "print" : "pdf");
  return {
    name: `${outputBase}.pdf`,
    blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" })
  };
}

function pdfLayout(settings: ConversionSettings, mode: "image" | "letter", sourceWidth: number, sourceHeight: number) {
  const margin = pdfMargin(settings.margins);
  const requested = settings.pageSize ?? (mode === "letter" ? "Letter" : "Original image size at 96 PPI");
  const fixed = PDF_PAGE_SIZES[requested];
  const sourcePoints = { width: sourceWidth * 0.75, height: sourceHeight * 0.75 };
  const pageWidth = fixed?.[0] ?? sourcePoints.width + margin * 2;
  const pageHeight = fixed?.[1] ?? sourcePoints.height + margin * 2;
  const contentWidth = Math.max(1, pageWidth - margin * 2);
  const contentHeight = Math.max(1, pageHeight - margin * 2);
  return { pageWidth, pageHeight, contentWidth, contentHeight, margin };
}

const PDF_PAGE_SIZES: Readonly<Record<string, readonly [number, number]>> = {
  Letter: [612, 792],
  Legal: [612, 1008],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  "16:9 slide": [960, 540],
  "4:5 carousel": [576, 720],
  "1:1 square": [720, 720]
};

function pdfMargin(value?: string) {
  if (value === "Narrow") return 18;
  if (value === "Standard") return 36;
  if (value === "Wide") return 72;
  return 0;
}

function cropCanvasSize(sourceWidth: number, sourceHeight: number, targetRatio: number) {
  const sourceRatio = sourceWidth / sourceHeight;
  return sourceRatio > targetRatio
    ? { width: Math.max(1, Math.round(sourceHeight * targetRatio)), height: sourceHeight }
    : { width: sourceWidth, height: Math.max(1, Math.round(sourceWidth / targetRatio)) };
}

function outputBaseName(name: string, policy?: string, suffix = "converted") {
  const stem = name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const preserved = portableOutputStem(stem
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[ .-]+$/g, "")
    .replace(/^[ .-]+/g, "") || "converted-image");
  const clean = portableOutputStem(preserved
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "converted-image");
  if (policy === "Clean filename") return clean;
  if (/suffix/i.test(policy ?? "")) return `${clean}-${suffix}`;
  return preserved;
}

function portableOutputStem(value: string) {
  const limited = Array.from(value).slice(0, 120).join("").replace(/[ .-]+$/g, "") || "converted-image";
  const deviceStem = limited.split(".", 1)[0];
  return /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9]|LPT[1-9])$/i.test(deviceStem) ? `_${limited}` : limited;
}

async function convertBmp(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const canvas = await renderRasterImage(file, settings, "#ffffff");
  return { name: `${outputBaseName(file.name, settings.batchNaming, "bmp")}.bmp`, blob: canvasToBmp(canvas) };
}

async function createDataUriText(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  return { name: `${outputBaseName(file.name, settings.batchNaming, "data-uri")}.data-uri.txt`, blob: new Blob([dataUri], { type: "text/plain;charset=utf-8" }) };
}

async function createHtmlEmbed(file: File, inspection: FileInspection, settings: ConversionSettings): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  const size = wrapperSize(inspection, settings.resolution);
  const width = ` width="${size.width}"`;
  const height = ` height="${size.height}"`;
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(file.name)}</title>`,
    "  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111}img{max-width:100%;height:auto}</style>",
    "</head>",
    "<body>",
    `  <img src="${dataUri}" alt="${escapeHtml(file.name)}"${width}${height} />`,
    "</body>",
    "</html>"
  ].join("\n");

  return { name: `${outputBaseName(file.name, settings.batchNaming, "html")}.html`, blob: new Blob([sanitizeGeneratedHtml(html)], { type: "text/html;charset=utf-8" }) };
}

async function createSvgWrapper(file: File, inspection: FileInspection, settings: ConversionSettings): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  const { width, height } = wrapperSize(inspection, settings.resolution);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image href="${dataUri}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`,
    "</svg>"
  ].join("\n");

  return { name: `${outputBaseName(file.name, settings.batchNaming, "svg")}.svg`, blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }) };
}

function wrapperSize(inspection: FileInspection, resolution?: string) {
  const sourceWidth = Math.max(1, inspection.width ?? 1200);
  const sourceHeight = Math.max(1, inspection.height ?? 1200);
  const width = selectedResolutionWidth(resolution) ?? sourceWidth;
  return { width, height: Math.max(1, Math.round((width / sourceWidth) * sourceHeight)) };
}

async function createThumbnailZip(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const widths = thumbnailWidths(settings.resolution);
  const format = settings.outputFormat === "JPEG" ? "jpeg" : "webp";
  const extension = format === "jpeg" ? "jpg" : format;
  const mime = `image/${format}`;
  const cleanBase = outputBaseName(file.name, "Clean filename");
  const outputs: ConversionOutput[] = [];
  const manifestOutputs: Array<{ path: string; width: number; height: number; type: string }> = [];

  for (let index = 0; index < widths.length; index += 1) {
    const width = widths[index];
    const canvas = await renderImage(file, { width });
    const blob = await canvasToBlob(canvas, mime, qualityFromCompression(settings.compression));
    const marker = settings.batchNaming === "Numbered sequence" ? String(index + 1).padStart(2, "0") : `${width}w`;
    const path = `thumbnails/${cleanBase}-${marker}.${extension}`;
    outputs.push({ name: path, blob });
    manifestOutputs.push({ path, width: canvas.width, height: canvas.height, type: mime });
  }

  outputs.push({
    name: "manifest.json",
    blob: jsonBlob({ source: file.name, format, widths, outputs: manifestOutputs })
  });

  return zipOutputs(`${cleanBase}-thumbnails.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

async function createFaviconZip(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const sizes = faviconSizes(settings.resolution);
  const cleanBase = outputBaseName(file.name, "Clean filename");
  const outputs: ConversionOutput[] = [];
  const iconPngs: Array<{ size: number; blob: Blob }> = [];

  for (const size of sizes) {
    const canvas = await renderImage(file, { width: size, height: size, fit: settings.crop === "Center square crop" ? "cover" : "contain" });
    const blob = await canvasToBlob(canvas, "image/png");
    const filename = settings.batchNaming === "Standard icon names" ? `icon-${size}.png` : `${cleanBase}-${size}x${size}.png`;
    outputs.push({ name: `icons/${filename}`, blob });
    iconPngs.push({ size, blob });
  }

  const manifest = {
    name: cleanBase,
    icons: outputs.map((output, index) => ({ src: output.name, sizes: `${sizes[index]}x${sizes[index]}`, type: "image/png" }))
  };

  outputs.push({ name: "favicon.ico", blob: await createIco(iconPngs.filter((icon) => icon.size <= 256)) });
  outputs.push({
    name: "site.webmanifest",
    blob: new Blob([JSON.stringify(manifest, null, 2)], { type: "application/manifest+json" })
  });

  return zipOutputs(`${cleanBase}-favicon-set.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

async function createFormatBundle(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const formats = selectedBundleFormats(settings.outputFormat);
  const outputs: ConversionOutput[] = [];
  for (const format of formats) {
    const converted = await convertRasterFormat(file, format, settings);
    outputs.push({ ...converted, name: `formats/${converted.name}` });
  }
  outputs.push({
    name: "manifest.json",
    blob: jsonBlob({ source: file.name, formats, outputs: outputs.map((output) => output.name), settings: pickImageSettings(settings) })
  });
  const cleanBase = outputBaseName(file.name, "Clean filename");
  return zipOutputs(`${cleanBase}-formats.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

async function createSocialPack(file: File, settings: ConversionSettings): Promise<ConversionOutput> {
  const format = settings.outputFormat === "WebP" ? "webp" : "jpeg";
  const extension = format === "jpeg" ? "jpg" : "webp";
  const mime = `image/${format}`;
  const scale = settings.resolution === "Half-size preview" ? 0.5 : 1;
  const cleanBase = outputBaseName(file.name, "Clean filename");
  const presets = SOCIAL_PRESETS.filter((preset) => socialRatioMatches(preset, settings.aspectRatio));
  const outputs: ConversionOutput[] = [];
  const manifestOutputs: Array<{ path: string; width: number; height: number; preset: string }> = [];

  for (const preset of presets) {
    const width = Math.round(preset.width * scale);
    const height = Math.round(preset.height * scale);
    const canvas = await renderImage(file, {
      width,
      height,
      fit: settings.crop === "Fit entire source" ? "contain" : "cover",
      background: "#ffffff"
    });
    const blob = await canvasToBlob(canvas, mime, qualityFromCompression(settings.compression));
    const stem = settings.batchNaming === "Source prefix" ? `${cleanBase}-${preset.id}` : preset.id;
    const path = `social/${stem}.${extension}`;
    outputs.push({ name: path, blob });
    manifestOutputs.push({ path, width, height, preset: preset.id });
  }
  outputs.push({ name: "manifest.json", blob: jsonBlob({ source: file.name, format, outputs: manifestOutputs, settings: pickImageSettings(settings) }) });
  return zipOutputs(`${cleanBase}-social-pack.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

const SOCIAL_PRESETS = [
  { id: "instagram-square", width: 1080, height: 1080 },
  { id: "instagram-portrait", width: 1080, height: 1350 },
  { id: "instagram-story", width: 1080, height: 1920 },
  { id: "youtube-thumbnail", width: 1280, height: 720 },
  { id: "linkedin-post", width: 1200, height: 627 },
  { id: "open-graph", width: 1200, height: 630 },
  { id: "x-header", width: 1500, height: 500 }
] as const;

function socialRatioMatches(preset: (typeof SOCIAL_PRESETS)[number], selection?: string) {
  if (selection === "Square only") return preset.width === preset.height;
  if (selection === "Portrait only") return preset.height > preset.width;
  if (selection === "Landscape only") return preset.width > preset.height;
  return true;
}

function thumbnailWidths(selection?: string) {
  if (selection === "320/640/1080/1920 set") return [320, 640, 1080, 1920];
  if (selection === "512/1024/2048 set") return [512, 1024, 2048];
  return [160, 320, 640];
}

function faviconSizes(selection?: string) {
  if (selection === "Full PWA set") return [192, 512];
  if (selection === "Browser-only set") return [16, 32, 48];
  return [16, 32, 48, 180, 192, 512];
}

function selectedBundleFormats(selection?: string): RasterFormat[] {
  if (selection === "PNG + JPEG") return ["png", "jpeg"];
  if (selection === "PNG + WebP") return ["png", "webp"];
  if (selection === "JPEG + WebP") return ["jpeg", "webp"];
  return ["png", "jpeg", "webp"];
}

function pickImageSettings(settings: ConversionSettings) {
  const keys = ["outputFormat", "resolution", "crop", "color", "compression", "batchNaming", "bundle"] as const;
  return Object.fromEntries(keys.filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]]));
}

function jsonBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

async function createIco(images: Array<{ size: number; blob: Blob }>) {
  if (!images.length) throw new Error("ICO output needs at least one icon at or below 256 pixels.");
  const payloads = await Promise.all(images.map(async (image) => ({ ...image, bytes: new Uint8Array(await image.blob.arrayBuffer()) })));
  const directorySize = 6 + payloads.length * 16;
  const totalSize = directorySize + payloads.reduce((sum, image) => sum + image.bytes.length, 0);
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, payloads.length, true);
  let dataOffset = directorySize;
  for (let index = 0; index < payloads.length; index += 1) {
    const image = payloads[index];
    const entryOffset = 6 + index * 16;
    view.setUint8(entryOffset, image.size === 256 ? 0 : image.size);
    view.setUint8(entryOffset + 1, image.size === 256 ? 0 : image.size);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, image.bytes.length, true);
    view.setUint32(entryOffset + 12, dataOffset, true);
    bytes.set(image.bytes, dataOffset);
    dataOffset += image.bytes.length;
  }
  return new Blob([buffer], { type: "image/x-icon" });
}

async function renderImage(file: File, options: RenderOptions = {}) {
  const image = await loadImage(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height);
  const targetWidth = Math.max(1, Math.round(options.width ?? sourceWidth));
  const targetHeight = Math.max(1, Math.round(options.height ?? (targetWidth / sourceWidth) * sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { alpha: !options.background });
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  const fitted = options.fit === "cover" ? coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) : fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
  return canvas;
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        try {
          const label = type.replace("image/", "").toUpperCase();
          if (!blob || blob.type.toLowerCase() !== type.toLowerCase()) {
            reject(new Error(`${label} export is not supported by this browser${blob?.type ? `; the encoder returned ${blob.type}` : ""}.`));
            return;
          }
          const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
          if (!hasImageSignature(header, type)) {
            reject(new Error(`${label} encoder returned bytes that do not match ${type}.`));
            return;
          }
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      },
      type,
      quality
    );
  });
}

function hasImageSignature(header: Uint8Array, type: string) {
  if (type === "image/png") return matchesBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/jpeg") return matchesBytes(header, [0xff, 0xd8, 0xff]);
  if (type === "image/webp") return asciiBytes(header, 0, 4) === "RIFF" && asciiBytes(header, 8, 12) === "WEBP";
  if (type === "image/avif") {
    const major = asciiBytes(header, 8, 12);
    return asciiBytes(header, 4, 8) === "ftyp" && (major === "avif" || major === "avis");
  }
  return false;
}

function matchesBytes(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function asciiBytes(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

async function renderRasterImage(file: File, settings: ConversionSettings, defaultBackground?: string) {
  const image = await loadImage(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height);
  const cropRatio = selectedCropRatio(settings.crop);
  const cropped = cropRatio ? cropCanvasSize(sourceWidth, sourceHeight, cropRatio) : { width: sourceWidth, height: sourceHeight };
  const requestedWidth = selectedResolutionWidth(settings.resolution) ?? cropped.width;
  const targetWidth = Math.max(1, Math.round(requestedWidth));
  const targetHeight = Math.max(1, Math.round(targetWidth / (cropRatio ?? (sourceWidth / sourceHeight))));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const background = selectedMatte(settings.color) ?? defaultBackground;
  const context = canvas.getContext("2d", { alpha: !background });
  if (!context) throw new Error("Canvas is not available in this browser.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, targetWidth, targetHeight);
  }
  const placement = cropRatio
    ? coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight)
    : fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  return canvas;
}

function selectedResolutionWidth(value?: string) {
  if (!value || value === "Original") return undefined;
  const match = /^(\d+)\s*px/i.exec(value);
  return match ? Number(match[1]) : undefined;
}

function selectedCropRatio(value?: string) {
  if (value === "Center square crop") return 1;
  if (value === "Center 4:5 crop") return 4 / 5;
  if (value === "Center 16:9 crop") return 16 / 9;
  return undefined;
}

function selectedMatte(value?: string) {
  if (value === "White matte") return "#ffffff";
  if (value === "Black matte") return "#000000";
  return undefined;
}

function canvasToBmp(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  const width = canvas.width;
  const height = canvas.height;
  const { data } = context.getImageData(0, 0, width, height);
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, imageSize, true);

  let offset = 54;
  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = offset;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      view.setUint8(offset, data[source + 2]);
      view.setUint8(offset + 1, data[source + 1]);
      view.setUint8(offset + 2, data[source]);
      offset += 3;
    }
    while (offset < rowStart + rowSize) {
      view.setUint8(offset, 0);
      offset += 1;
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

async function fileToDataUri(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${file.type || "application/octet-stream"};base64,${window.btoa(binary)}`;
}

function fitRect(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (maxWidth - width) / 2, y: (maxHeight - height) / 2, width, height };
}

function coverRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

interface RenderOptions {
  width?: number;
  height?: number;
  fit?: "contain" | "cover";
  background?: string;
}
