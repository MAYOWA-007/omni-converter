import { validateOutput } from "../../src/core/outputValidation";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_UNIVERSAL_RECIPE_CONTRACTS, type VerifiedUniversalRecipeContract } from "../../src/data/verifiedUniversalRecipes";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";

function fixture(kind: VerifiedUniversalRecipeContract["fixture"]): File {
  if (kind === "utf8-text") return new File(["Omni Converter\nRuns in the browser.\nThird line."], "Read Me.txt", { type: "text/plain" });
  if (kind === "json") return new File(['[{"name":"Alpha","value":7},{"name":"Omni","value":9}]'], "records.json", { type: "application/json" });
  if (kind === "jsonl") return new File(['{"name":"Alpha"}\n{"name":"Omni"}\n'], "records.jsonl", { type: "application/x-ndjson" });
  if (kind === "csv") return new File(['name,note\nAlpha,"portable, private"\nOmni,fast\n'], "records.csv", { type: "text/csv" });
  if (kind === "tsv") return new File(["name\tnote\nAlpha\tportable, private\nOmni\tfast\n"], "records.tsv", { type: "text/tab-separated-values" });
  if (kind === "xml") return new File(['<?xml version="1.0"?><catalog><item id="1">Alpha</item><item id="2">Omni</item></catalog>'], "records.xml", { type: "application/xml" });
  const bytes = new Uint8Array(4096);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 73 + 19) % 251;
  return new File([bytes], "Sample Payload.bin", { type: "application/octet-stream" });
}

async function runUniversalRecipe(recipeId: string) {
  const contract = VERIFIED_UNIVERSAL_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown universal recipe: ${recipeId}`);
  const file = fixture(contract.fixture);
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, contract.fixtureSettings);
  return Promise.all(outputs.map(async (output) => {
    const validation = await validateOutput(output);
    return {
      name: output.name,
      size: output.blob.size,
      text: /json|text|xml|ndjson|csv|tab-separated/.test(output.blob.type) ? await output.blob.text() : undefined,
      validation: { valid: validation.valid, detectedFormat: validation.detectedFormat, errors: validation.errors }
    };
  }));
}

declare global {
  interface Window {
    __omniUniversalHarness: { runUniversalRecipe: typeof runUniversalRecipe };
  }
}

window.__omniUniversalHarness = { runUniversalRecipe };
document.getElementById("status")!.textContent = "ready";
