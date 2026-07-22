import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { PDFDocument } from "pdf-lib";
import { validateOutput } from "../../src/core/outputValidation";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_FONT_RECIPE_CONTRACTS } from "../../src/data/verifiedFontRecipes";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings } from "../../src/lib/types";

async function fontFixture() {
  const response = await fetch(`${import.meta.env.BASE_URL}assets/fonts/OmniScript.woff2`);
  if (!response.ok) throw new Error("Could not load the local WOFF2 fixture.");
  return new File([await response.blob()], "Omni Display.woff2", { type: "font/woff2" });
}

async function runFontRecipe(recipeId: string, overrides: ConversionSettings = {}) {
  const contract = VERIFIED_FONT_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified font recipe: ${recipeId}`);
  const file = await fontFixture();
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides });
  return Promise.all(outputs.map(async (output) => {
    const validation = await validateOutput(output);
    return {
      name: output.name,
      type: output.blob.type,
      bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
      validation: { valid: validation.valid, detectedFormat: validation.detectedFormat }
    };
  }));
}

async function inspectFixture() {
  return inspectFile(await fontFixture());
}

async function unzip(bytes: number[]) {
  const reader = new ZipReader(new BlobReader(new Blob([Uint8Array.from(bytes)], { type: "application/zip" })), { checkSignature: true, checkOverlappingEntry: true });
  try {
    const entries = await reader.getEntries();
    return Promise.all(entries.filter((entry) => !entry.directory).map(async (entry) => {
      const blob = entry.getData ? await entry.getData(new BlobWriter()) : new Blob();
      const extension = entry.filename.split(".").at(-1)?.toLowerCase();
      return {
        name: entry.filename,
        bytes: [...new Uint8Array(await blob.arrayBuffer())],
        text: ["css", "html", "txt"].includes(extension ?? "") ? await blob.text() : undefined
      };
    }));
  } finally {
    await reader.close();
  }
}

async function inspectRaster(bytes: number[]) {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: "image/png" }));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Raster inspection canvas is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let lightPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] > 180 && pixels[offset + 1] > 150 && pixels[offset + 2] > 80) lightPixels += 1;
    }
    return { width: bitmap.width, height: bitmap.height, lightPixels };
  } finally {
    bitmap.close();
  }
}

async function inspectPdf(bytes: number[]) {
  const pdf = await PDFDocument.load(Uint8Array.from(bytes));
  const page = pdf.getPage(0);
  return { pages: pdf.getPageCount(), width: page.getWidth(), height: page.getHeight() };
}

declare global {
  interface Window {
    __omniFontHarness: {
      runFontRecipe: typeof runFontRecipe;
      inspectFixture: typeof inspectFixture;
      unzip: typeof unzip;
      inspectRaster: typeof inspectRaster;
      inspectPdf: typeof inspectPdf;
    };
  }
}

window.__omniFontHarness = { runFontRecipe, inspectFixture, unzip, inspectRaster, inspectPdf };
document.getElementById("status")!.textContent = "ready";
