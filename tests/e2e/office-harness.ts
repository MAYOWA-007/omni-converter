import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_OFFICE_RECIPE_CONTRACTS } from "../../src/data/verifiedOfficeRecipes";
import { validateOutput } from "../../src/core/outputValidation";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import { readPptxSlides } from "../../src/lib/officeConversions";
import type { ConversionSettings } from "../../src/lib/types";
import { createNotesPptxBytes, createSemanticDocxBytes } from "../fixtures/officeFixtures";

function officeFixture(kind: "semantic-docx" | "notes-pptx") {
  return kind === "semantic-docx"
    ? new File([createSemanticDocxBytes()], "Quarterly Plan.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    : new File([createNotesPptxBytes()], "Launch Brief.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

async function runOfficeRecipe(recipeId: string, overrides: ConversionSettings = {}) {
  const contract = VERIFIED_OFFICE_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified Office recipe: ${recipeId}`);
  const file = officeFixture(contract.fixture);
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides });
  return Promise.all(outputs.map(async (output) => {
    const validation = await validateOutput(output);
    return {
      name: output.name,
      type: output.blob.type,
      bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
      text: /^(text\/|application\/(json|x-ndjson))/.test(output.blob.type) ? await output.blob.text() : undefined,
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

async function inspectPresentation() {
  return readPptxSlides(officeFixture("notes-pptx"));
}

declare global {
  interface Window {
    __omniOfficeHarness: { runOfficeRecipe: typeof runOfficeRecipe; unzip: typeof unzip; inspectPresentation: typeof inspectPresentation };
  }
}

window.__omniOfficeHarness = { runOfficeRecipe, unzip, inspectPresentation };
document.getElementById("status")!.textContent = "ready";
