import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { validateOutput } from "../../src/core/outputValidation";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_ARCHIVE_RECIPE_CONTRACTS } from "../../src/data/verifiedArchiveRecipes";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings } from "../../src/lib/types";
import { createCompressibleExeBytes, createMixedZipBytes } from "../fixtures/archiveFixtures";

function fixture(kind: "mixed-zip" | "minimal-exe") {
  return kind === "mixed-zip"
    ? new File([createMixedZipBytes()], "Project Bundle.zip", { type: "application/zip" })
    : new File([createCompressibleExeBytes()], "Setup Tool.exe", { type: "application/vnd.microsoft.portable-executable" });
}

async function runArchiveRecipe(recipeId: string, overrides: ConversionSettings = {}) {
  const contract = VERIFIED_ARCHIVE_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified archive recipe: ${recipeId}`);
  const file = fixture(contract.fixture);
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides });
  return Promise.all(outputs.map(async (output) => {
    const validation = await validateOutput(output);
    return {
      name: output.name,
      type: output.blob.type,
      bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
      text: output.blob.type.includes("json") ? await output.blob.text() : undefined,
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
      return { name: entry.filename, compressionMethod: entry.compressionMethod, bytes: [...new Uint8Array(await blob.arrayBuffer())], text: await blob.text() };
    }));
  } finally {
    await reader.close();
  }
}

declare global {
  interface Window {
    __omniArchiveHarness: { runArchiveRecipe: typeof runArchiveRecipe; unzip: typeof unzip };
  }
}

window.__omniArchiveHarness = { runArchiveRecipe, unzip };
document.getElementById("status")!.textContent = "ready";
