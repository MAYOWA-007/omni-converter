import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_TABULAR_RECIPE_CONTRACTS } from "../../src/data/verifiedTabularRecipes";
import { validateOutput } from "../../src/core/outputValidation";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings } from "../../src/lib/types";
import { createMultiSheetXlsxBytes, QUOTED_CSV } from "../fixtures/tabularFixtures";

async function runTabularRecipe(recipeId: string, overrides: ConversionSettings = {}) {
  const contract = VERIFIED_TABULAR_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified tabular recipe: ${recipeId}`);
  const file = contract.fixture === "multi-sheet-xlsx"
    ? new File([createMultiSheetXlsxBytes()], "Ledger.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    : new File([QUOTED_CSV], "quoted-data.csv", { type: "text/csv" });
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides });
  return Promise.all(outputs.map(async (output) => {
    const bytes = [...new Uint8Array(await output.blob.arrayBuffer())];
    const validation = await validateOutput(output);
    const text = /^(text\/|application\/(json|x-ndjson))/.test(output.blob.type) ? await output.blob.text() : undefined;
    return { name: output.name, type: output.blob.type, bytes, text, validation: { valid: validation.valid, detectedFormat: validation.detectedFormat } };
  }));
}

async function unzip(bytes: number[]) {
  const reader = new ZipReader(new BlobReader(new Blob([Uint8Array.from(bytes)], { type: "application/zip" })), { checkSignature: true, checkOverlappingEntry: true });
  try {
    const entries = await reader.getEntries();
    return Promise.all(entries.filter((entry) => !entry.directory).map(async (entry) => ({
      name: entry.filename,
      compressionMethod: entry.compressionMethod,
      text: entry.getData ? await entry.getData(new BlobWriter()).then((blob) => blob.text()) : ""
    })));
  } finally {
    await reader.close();
  }
}

declare global {
  interface Window {
    __omniTabularHarness: { runTabularRecipe: typeof runTabularRecipe; unzip: typeof unzip };
  }
}

window.__omniTabularHarness = { runTabularRecipe, unzip };
document.getElementById("status")!.textContent = "ready";
