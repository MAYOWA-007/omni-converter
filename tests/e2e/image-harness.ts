import { createJobController } from "../../src/core/jobs";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { convertImageRecipe } from "../../src/lib/imageConversions";
import type { ConversionSettings, FileInspection } from "../../src/lib/types";
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import "../../src/lib/conversions";
import { imageInputFixture, type ImageInputFixtureId } from "../fixtures/imageInputFixtures";

interface SerializedOutput {
  name: string;
  type: string;
  bytes: number[];
  validation: { valid: boolean; detectedFormat: string } | undefined;
}

async function transparentQuadrantsPng(name = "Quarter Tone ?.png") {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas fixture is unavailable.");

  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = (x * 17 + y * 3) % 256;
      pixels.data[offset + 1] = (x * 5 + y * 13) % 256;
      pixels.data[offset + 2] = (x * 11 + y * 7) % 256;
      pixels.data[offset + 3] = x < 32 && y < 32 ? 0 : 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG fixture encoding failed.")), "image/png"));
  return new File([blob], name, { type: "image/png", lastModified: 1_700_000_000_000 });
}

async function runImageRecipe(recipeId: string, settings: ConversionSettings, sourceName?: string): Promise<SerializedOutput[]> {
  const file = await transparentQuadrantsPng(sourceName);
  const recipe = CONVERSION_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new Error(`Unknown recipe ${recipeId}.`);
  const inspection: FileInspection = {
    name: file.name,
    extension: "png",
    mime: file.type,
    size: file.size,
    family: "image",
    width: 240,
    height: 160,
    exactFormat: "png",
    signatureSource: "signature",
    notes: []
  };
  const controller = createJobController(undefined, { createId: () => `fixture-${recipeId}` });
  const job = controller.create({ file, inspection, recipe, settings });
  const completed = await controller.start(job.id);
  if (completed.state !== "complete") throw new Error(`${completed.error?.name ?? "ConversionError"}: ${completed.error?.message ?? completed.state}`);
  const outputs = controller.getResult(job.id);
  if (!outputs) throw new Error("Completed fixture job has no outputs.");
  return Promise.all(outputs.map(async (output, index) => ({
    name: output.name,
    type: output.blob.type,
    bytes: Array.from(new Uint8Array(await output.blob.arrayBuffer())),
    validation: completed.outputs[index]?.validation && {
      valid: completed.outputs[index].validation!.valid,
      detectedFormat: completed.outputs[index].validation!.detectedFormat
    }
  })));
}

async function runImageInputFixture(fixtureId: ImageInputFixtureId) {
  const file = imageInputFixture(fixtureId);
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const source = await inspectImage({ bytes, type: file.type });
  const recipe = CONVERSION_RECIPES.find((candidate) => candidate.id === "image-to-png");
  if (!recipe) throw new Error("The image-to-png recipe is unavailable.");
  const inspection: FileInspection = {
    name: file.name,
    extension: file.name.split(".").pop()?.toLowerCase(),
    mime: file.type,
    size: file.size,
    family: "image",
    width: source.width,
    height: source.height,
    exactFormat: fixtureId,
    signatureSource: "signature",
    notes: []
  };
  const controller = createJobController(undefined, { createId: () => `fixture-input-${fixtureId}` });
  const job = controller.create({
    file,
    inspection,
    recipe,
    settings: { resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", batchNaming: "Keep source name" }
  });
  const completed = await controller.start(job.id);
  if (completed.state !== "complete") throw new Error(`${completed.error?.name ?? "ConversionError"}: ${completed.error?.message ?? completed.state}`);
  const [output] = controller.getResult(job.id) ?? [];
  if (!output) throw new Error(`${fixtureId} fixture conversion produced no output.`);
  const outputBytes = Array.from(new Uint8Array(await output.blob.arrayBuffer()));
  const serialized: SerializedOutput = {
    name: output.name,
    type: output.blob.type,
    bytes: outputBytes,
    validation: completed.outputs[0]?.validation && {
      valid: completed.outputs[0].validation.valid,
      detectedFormat: completed.outputs[0].validation.detectedFormat
    }
  };
  return { source, output: serialized, decoded: await inspectImage(serialized) };
}

async function inspectPdf(bytes: number[]) {
  const data = Uint8Array.from(bytes);
  const pdfLib = await PDFDocument.load(data);
  const pdfJsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSource } = await import("pdfjs-dist/build/pdf.worker.mjs?raw");
  pdfJsModule.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const pdfJs = await pdfJsModule.getDocument({ data }).promise;
  let imageRatio: number | undefined;
  for (const [, object] of pdfLib.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Image") continue;
    const width = object.dict.get(PDFName.of("Width"));
    const height = object.dict.get(PDFName.of("Height"));
    if (width instanceof PDFNumber && height instanceof PDFNumber) {
      imageRatio = width.asNumber() / height.asNumber();
      break;
    }
  }
  const page = pdfLib.getPage(0);
  const renderedPage = await pdfJs.getPage(1);
  const viewport = renderedPage.getViewport({ scale: 0.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("PDF inspection canvas is unavailable.");
  await renderedPage.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (pixels[offset] > 248 && pixels[offset + 1] > 248 && pixels[offset + 2] > 248) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  const inkBounds = right >= left ? { left, top, right, bottom } : undefined;
  return { pages: pdfJs.numPages, width: page.getWidth(), height: page.getHeight(), title: pdfLib.getTitle(), imageRatio, inkBounds };
}

async function inspectImage(output: Pick<SerializedOutput, "bytes" | "type">) {
  const bytes = Uint8Array.from(output.bytes);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: output.type }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image inspection canvas is unavailable.");
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const corner = Array.from(imageData.slice(0, 4));
  const checksum = imageData.reduce((sum, value, index) => (sum + value * (index + 1)) >>> 0, 0);
  bitmap.close();
  return { width: canvas.width, height: canvas.height, corner, checksum, header: Array.from(bytes.slice(0, 16)) };
}

async function attemptDirectImageRecipe(recipeId: string) {
  const file = await transparentQuadrantsPng();
  const recipe = CONVERSION_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new Error(`Unknown recipe ${recipeId}.`);
  const inspection: FileInspection = { name: file.name, extension: "png", mime: file.type, size: file.size, family: "image", width: 240, height: 160, notes: [] };
  try {
    const outputs = await convertImageRecipe(file, inspection, recipe, { resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", compression: "Maximum quality", batchNaming: "Keep source name" });
    return { ok: true as const, name: outputs[0]?.name, type: outputs[0]?.blob.type, header: Array.from(new Uint8Array(await outputs[0].blob.slice(0, 16).arrayBuffer())) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

async function inspectZip(output: Pick<SerializedOutput, "bytes" | "type">) {
  const { BlobReader, BlobWriter, ZipReader } = await import("@zip.js/zip.js");
  const blob = new Blob([Uint8Array.from(output.bytes)], { type: output.type });
  const reader = new ZipReader(new BlobReader(blob), { checkSignature: true, checkOverlappingEntry: true });
  const facts: Array<{ name: string; compressionMethod?: number; compressedSize?: number; uncompressedSize?: number; width?: number; height?: number; corner?: number[]; text?: string; header?: number[] }> = [];
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory || !entry.getData) continue;
      const extension = entry.filename.split(".").pop()?.toLowerCase();
      const mime = extension === "png" ? "image/png" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : "application/octet-stream";
      const data = await entry.getData(new BlobWriter(mime));
      const fact = { name: entry.filename, compressionMethod: entry.compressionMethod, compressedSize: entry.compressedSize, uncompressedSize: entry.uncompressedSize } as (typeof facts)[number];
      if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) {
        const image = await inspectImage({ bytes: Array.from(new Uint8Array(await data.arrayBuffer())), type: mime });
        fact.width = image.width;
        fact.height = image.height;
        fact.corner = image.corner;
      } else if (["json", "webmanifest", "txt"].includes(extension ?? "")) {
        fact.text = await data.text();
      } else {
        fact.header = Array.from(new Uint8Array(await data.slice(0, 16).arrayBuffer()));
      }
      facts.push(fact);
    }
  } finally {
    await reader.close();
  }
  return facts;
}

window.__omniImageHarness = { runImageRecipe, runImageInputFixture, inspectPdf, inspectImage, attemptDirectImageRecipe, inspectZip };
document.getElementById("status")!.textContent = "ready";

declare global {
  interface Window {
    __omniImageHarness: { runImageRecipe: typeof runImageRecipe; runImageInputFixture: typeof runImageInputFixture; inspectPdf: typeof inspectPdf; inspectImage: typeof inspectImage; attemptDirectImageRecipe: typeof attemptDirectImageRecipe; inspectZip: typeof inspectZip };
  }
}
