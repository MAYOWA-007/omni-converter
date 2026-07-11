import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { validateOutput } from "../../src/core/outputValidation";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_EBOOK_RECIPE_CONTRACTS } from "../../src/data/verifiedEbookRecipes";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings } from "../../src/lib/types";
import { createSpineEpubBytes } from "../fixtures/ebookFixtures";

async function runEbookRecipe(overrides: ConversionSettings = {}) {
  const contract = VERIFIED_EBOOK_RECIPE_CONTRACTS[0];
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
  if (!recipe) throw new Error("Verified EPUB recipe is missing.");
  const file = new File([createSpineEpubBytes()], "Spine Order.epub", { type: "application/epub+zip" });
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides });
  return Promise.all(outputs.map(async (output) => {
    const validation = await validateOutput(output);
    return {
      name: output.name,
      type: output.blob.type,
      bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
      text: /(?:text|json|html|markdown)/i.test(output.blob.type) ? await output.blob.text() : undefined,
      validation: { valid: validation.valid, detectedFormat: validation.detectedFormat }
    };
  }));
}

async function unzip(bytes: number[]) {
  const reader = new ZipReader(new BlobReader(new Blob([Uint8Array.from(bytes)], { type: "application/zip" })), { checkSignature: true, checkOverlappingEntry: true });
  try {
    const entries = await reader.getEntries();
    return Promise.all(entries.filter((entry) => !entry.directory).map(async (entry) => {
      const blob = entry.getData ? await entry.getData(new BlobWriter()) : new Blob();
      return { name: entry.filename, compressionMethod: entry.compressionMethod, text: await blob.text() };
    }));
  } finally {
    await reader.close();
  }
}

declare global {
  interface Window {
    __omniEbookHarness: { runEbookRecipe: typeof runEbookRecipe; unzip: typeof unzip };
  }
}

window.__omniEbookHarness = { runEbookRecipe, unzip };
document.getElementById("status")!.textContent = "ready";
