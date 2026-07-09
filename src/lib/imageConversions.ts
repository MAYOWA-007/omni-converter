import { qualityFromCompression } from "./conversionHelpers";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";

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
  "image-format-bundle"
]);

export function canConvertImageRecipe(recipe: ConversionRecipe) {
  return recipe.input.includes("image") && IMAGE_RECIPE_IDS.has(recipe.id);
}

export async function convertImageRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  if (!canConvertImageRecipe(recipe)) {
    throw new Error("This output is not wired to the image converter yet.");
  }

  const baseName = baseFileName(file.name);

  switch (recipe.id) {
    case "image-to-pdf":
      return [await createPdf(file, inspection, baseName, "image", settings)];
    case "image-print-pdf":
      return [await createPdf(file, inspection, baseName, "letter", settings)];
    case "image-to-png":
      return [await convertCanvasFormat(file, `${baseName}.png`, "image/png")];
    case "image-to-jpeg":
      return [await convertCanvasFormat(file, `${baseName}.jpg`, "image/jpeg", qualityFromCompression(settings.compression), "#ffffff")];
    case "image-to-webp":
      return [await convertCanvasFormat(file, `${baseName}.webp`, "image/webp", qualityFromCompression(settings.compression))];
    case "image-to-avif":
      return [await convertCanvasFormat(file, `${baseName}.avif`, "image/avif", qualityFromCompression(settings.compression))];
    case "image-to-bmp":
      return [await convertBmp(file, `${baseName}.bmp`)];
    case "image-svg-wrapper":
      return [await createSvgWrapper(file, inspection, `${baseName}.svg`)];
    case "image-data-uri":
      return [await createDataUriText(file, `${baseName}.data-uri.txt`)];
    case "image-html-embed":
      return [await createHtmlEmbed(file, inspection, `${baseName}.html`)];
    case "image-thumbnail-set":
      return [await createThumbnailZip(file, baseName, settings)];
    case "image-favicon-set":
      return [await createFaviconZip(file, baseName)];
    case "image-format-bundle":
      return [await createFormatBundle(file, baseName, settings)];
    default:
      throw new Error("This image output is not available.");
  }
}

export function downloadOutput(output: ConversionOutput) {
  const url = URL.createObjectURL(output.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = output.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function convertCanvasFormat(file: File, name: string, type: string, quality?: number, background?: string): Promise<ConversionOutput> {
  const canvas = await renderImage(file, { background });
  const blob = await canvasToBlob(canvas, type, quality);
  return { name, blob };
}

async function createPdf(file: File, inspection: FileInspection, baseName: string, mode: "image" | "letter", settings: ConversionSettings): Promise<ConversionOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const canvas = await renderImage(file, { background: "#ffffff" });
  const jpeg = await canvasToBlob(canvas, "image/jpeg", qualityFromCompression(settings.compression));
  const imageBytes = await jpeg.arrayBuffer();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(imageBytes);

  if (mode === "letter") {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 36;
    const page = pdf.addPage([pageWidth, pageHeight]);
    const fitted = fitRect(image.width, image.height, pageWidth - margin * 2, pageHeight - margin * 2);
    page.drawImage(image, {
      x: (pageWidth - fitted.width) / 2,
      y: (pageHeight - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height
    });
  } else {
    const width = Math.max(1, inspection.width ?? image.width);
    const height = Math.max(1, inspection.height ?? image.height);
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const bytes = await pdf.save();
  return {
    name: `${baseName}${mode === "letter" ? "-print" : ""}.pdf`,
    blob: new Blob([toArrayBuffer(bytes)], { type: "application/pdf" })
  };
}

async function convertBmp(file: File, name: string): Promise<ConversionOutput> {
  const canvas = await renderImage(file, { background: "#ffffff" });
  return { name, blob: canvasToBmp(canvas) };
}

async function createDataUriText(file: File, name: string): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  return { name, blob: new Blob([dataUri], { type: "text/plain;charset=utf-8" }) };
}

async function createHtmlEmbed(file: File, inspection: FileInspection, name: string): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  const width = inspection.width ? ` width="${inspection.width}"` : "";
  const height = inspection.height ? ` height="${inspection.height}"` : "";
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

  return { name, blob: new Blob([html], { type: "text/html;charset=utf-8" }) };
}

async function createSvgWrapper(file: File, inspection: FileInspection, name: string): Promise<ConversionOutput> {
  const dataUri = await fileToDataUri(file);
  const width = Math.max(1, inspection.width ?? 1200);
  const height = Math.max(1, inspection.height ?? 1200);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image href="${dataUri}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`,
    "</svg>"
  ].join("\n");

  return { name, blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }) };
}

async function createThumbnailZip(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const widths = [320, 640, 1080, 1920];
  const outputs: ConversionOutput[] = [];

  for (const width of widths) {
    const canvas = await renderImage(file, { width });
    const blob = await canvasToBlob(canvas, "image/webp", qualityFromCompression(settings.compression));
    outputs.push({ name: `thumbnails/${baseName}-${width}w.webp`, blob });
  }

  outputs.push({
    name: "README.txt",
    blob: new Blob(["Generated thumbnail set: 320w, 640w, 1080w, 1920w WebP."], { type: "text/plain;charset=utf-8" })
  });

  return zipOutputs(`${baseName}-thumbnails.zip`, outputs);
}

async function createFaviconZip(file: File, baseName: string): Promise<ConversionOutput> {
  const sizes = [16, 32, 48, 180, 192, 512];
  const outputs: ConversionOutput[] = [];

  for (const size of sizes) {
    const canvas = await renderImage(file, { width: size, height: size, fit: "cover" });
    const blob = await canvasToBlob(canvas, "image/png");
    outputs.push({ name: `icons/${baseName}-${size}x${size}.png`, blob });
  }

  const manifest = {
    icons: sizes.map((size) => ({
      src: `icons/${baseName}-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png"
    }))
  };

  outputs.push({
    name: "site.webmanifest",
    blob: new Blob([JSON.stringify(manifest, null, 2)], { type: "application/manifest+json" })
  });
  outputs.push({
    name: "README.txt",
    blob: new Blob(["PNG favicon/app icon set generated from the source image."], { type: "text/plain;charset=utf-8" })
  });

  return zipOutputs(`${baseName}-favicon-set.zip`, outputs);
}

async function createFormatBundle(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const png = await convertCanvasFormat(file, `formats/${baseName}.png`, "image/png");
  const jpeg = await convertCanvasFormat(file, `formats/${baseName}.jpg`, "image/jpeg", qualityFromCompression(settings.compression), "#ffffff");
  const webp = await convertCanvasFormat(file, `formats/${baseName}.webp`, "image/webp", qualityFromCompression(settings.compression));

  const manifest = {
    source: file.name,
    outputs: [png.name, jpeg.name, webp.name]
  };

  return zipOutputs(`${baseName}-formats.zip`, [
    png,
    jpeg,
    webp,
    {
      name: "manifest.json",
      blob: new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" })
    }
  ]);
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
    blob: new Blob([toArrayBuffer(zipSync(files, { level: 9 }))], { type: "application/zip" })
  };
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

function baseFileName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "converted-image";
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
