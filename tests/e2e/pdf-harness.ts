import { createJobController } from "../../src/core/jobs";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings, FileInspection } from "../../src/lib/types";
import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import "../../src/lib/conversions";

interface SerializedOutput {
  name: string;
  type: string;
  bytes: number[];
  text?: string;
  validation?: { valid: boolean; detectedFormat: string };
}

async function mixedPdfFixture(name = "Quarterly Plan ?.pdf") {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = [
    { size: [300, 200] as const, label: "Alpha page", color: rgb(0.75, 0.12, 0.12), rotation: 0 },
    { size: [200, 300] as const, label: "Bravo page", color: rgb(0.12, 0.55, 0.2), rotation: 0 },
    { size: [400, 240] as const, label: "Charlie page", color: rgb(0.12, 0.25, 0.75), rotation: 0 },
    { size: [595.28, 841.89] as const, label: "Delta page", color: rgb(0.5, 0.2, 0.65), rotation: 90 }
  ];

  for (const [index, fixture] of pages.entries()) {
    const page = pdf.addPage(fixture.size);
    page.drawRectangle({ x: 18, y: 18, width: fixture.size[0] - 36, height: fixture.size[1] - 36, color: fixture.color, opacity: 0.18, borderColor: fixture.color, borderWidth: 3 });
    page.drawText(fixture.label, { x: 32, y: fixture.size[1] - 52, size: 20, font, color: fixture.color });
    page.drawText(`Fixture page ${index + 1}`, { x: 32, y: 32, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    if (fixture.rotation) page.setRotation(degrees(fixture.rotation));
  }

  pdf.setTitle("Mixed fixture");
  pdf.setAuthor("Omni fixture");
  pdf.setSubject("PDF conversion verification");
  const bytes = await pdf.save();
  return new File([bytes], name, { type: "application/pdf", lastModified: 1_700_000_000_000 });
}

async function runPdfRecipe(recipeId: string, settings: ConversionSettings, sourceName?: string): Promise<SerializedOutput[]> {
  const file = await mixedPdfFixture(sourceName);
  const catalogRecipe = CONVERSION_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!catalogRecipe) throw new Error(`Unknown recipe ${recipeId}.`);
  const recipe = { ...catalogRecipe, maturity: "verified" as const, implementation: "ready" as const, runtimes: ["browser"] as const };
  const inspection: FileInspection = {
    name: file.name,
    extension: "pdf",
    mime: file.type,
    size: file.size,
    family: "pdf",
    pages: 4,
    exactFormat: "pdf",
    signatureSource: "signature",
    notes: []
  };
  const controller = createJobController(undefined, { createId: () => `pdf-fixture-${recipeId}` });
  const job = controller.create({ file, inspection, recipe, settings });
  const completed = await controller.start(job.id);
  if (completed.state !== "complete") throw new Error(`${completed.error?.name ?? "ConversionError"}: ${completed.error?.message ?? completed.state}`);
  const outputs = controller.getResult(job.id);
  if (!outputs) throw new Error("Completed PDF fixture job has no outputs.");
  return Promise.all(outputs.map(async (output, index) => ({
    name: output.name,
    type: output.blob.type,
    bytes: Array.from(new Uint8Array(await output.blob.arrayBuffer())),
    text: /^(text\/|application\/(json|manifest\+json))/.test(output.blob.type) ? await output.blob.text() : undefined,
    validation: completed.outputs[index]?.validation && {
      valid: completed.outputs[index].validation!.valid,
      detectedFormat: completed.outputs[index].validation!.detectedFormat
    }
  })));
}

async function inspectFixture() {
  return inspectFile(await mixedPdfFixture());
}

async function fixtureBytes() {
  return Array.from(new Uint8Array(await (await mixedPdfFixture()).arrayBuffer()));
}

async function inspectPdf(bytes: number[]) {
  const data = Uint8Array.from(bytes);
  const pdfLib = await PDFDocument.load(data);
  const pdfJsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSource } = await import("pdfjs-dist/build/pdf.worker.mjs?raw");
  pdfJsModule.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const pdfJs = await pdfJsModule.getDocument({ data }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdfJs.numPages; pageNumber += 1) {
      const page = await pdfJs.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pages.push({
        width: Math.round(viewport.width * 100) / 100,
        height: Math.round(viewport.height * 100) / 100,
        rotation: page.rotate,
        text: content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim()
      });
    }
  } finally {
    await pdfJs.cleanup();
  }
  return { pageCount: pdfLib.getPageCount(), pages, title: pdfLib.getTitle(), author: pdfLib.getAuthor(), subject: pdfLib.getSubject() };
}

async function inspectPdfInkBounds(bytes: number[], pageNumber = 1) {
  const data = Uint8Array.from(bytes);
  const pdfJsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSource } = await import("pdfjs-dist/build/pdf.worker.mjs?raw");
  pdfJsModule.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const pdf = await pdfJsModule.getDocument({ data }).promise;
  try {
    const sourcePage = await pdf.getPage(pageNumber);
    const viewport = sourcePage.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PDF inspection canvas is unavailable.");
    await sourcePage.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
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
    return right >= left ? { left, top, right, bottom } : undefined;
  } finally {
    await pdf.cleanup();
  }
}

async function inspectZip(bytes: number[]) {
  const { BlobReader, BlobWriter, ZipReader } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(new Blob([Uint8Array.from(bytes)], { type: "application/zip" })), { checkSignature: true, checkOverlappingEntry: true });
  const entries: Array<{ name: string; bytes: number[]; compressionMethod?: number; text?: string; width?: number; height?: number; pdf?: Awaited<ReturnType<typeof inspectPdf>> }> = [];
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory || !entry.getData) continue;
      const data = await entry.getData(new BlobWriter());
      const bytes = Array.from(new Uint8Array(await data.arrayBuffer()));
      const extension = entry.filename.split(".").at(-1)?.toLowerCase();
      const fact = { name: entry.filename, bytes, compressionMethod: entry.compressionMethod } as (typeof entries)[number];
      if (["json", "txt", "xml", "rels", "md", "html"].includes(extension ?? "")) fact.text = new TextDecoder().decode(Uint8Array.from(bytes));
      if (["png", "jpg", "jpeg"].includes(extension ?? "")) {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: extension === "png" ? "image/png" : "image/jpeg" }));
        fact.width = bitmap.width;
        fact.height = bitmap.height;
        bitmap.close();
      }
      if (extension === "pdf") fact.pdf = await inspectPdf(bytes);
      entries.push(fact);
    }
  } finally {
    await reader.close();
  }
  return entries;
}

window.__omniPdfHarness = { runPdfRecipe, fixtureBytes, inspectFixture, inspectPdf, inspectPdfInkBounds, inspectZip };
document.getElementById("status")!.textContent = "ready";

declare global {
  interface Window {
    __omniPdfHarness: { runPdfRecipe: typeof runPdfRecipe; fixtureBytes: typeof fixtureBytes; inspectFixture: typeof inspectFixture; inspectPdf: typeof inspectPdf; inspectPdfInkBounds: typeof inspectPdfInkBounds; inspectZip: typeof inspectZip };
  }
}
