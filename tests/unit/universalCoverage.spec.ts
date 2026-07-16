import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_UNIVERSAL_RECIPE_CONTRACTS } from "../../src/data/verifiedUniversalRecipes";
import { engineForRecipe } from "../../src/engines/registry";
import { RECOGNIZED_FILE_EXTENSIONS } from "../../src/lib/fileInspection";
import "../../src/lib/conversions";

test("the catalog has more than 100 conversion cards and recognizes hundreds of extensions", () => {
  expect(CONVERSION_RECIPES.length).toBeGreaterThan(100);
  expect(RECOGNIZED_FILE_EXTENSIONS.length).toBeGreaterThan(250);
  expect(new Set(RECOGNIZED_FILE_EXTENSIONS).size).toBe(RECOGNIZED_FILE_EXTENSIONS.length);
});

test("every promoted universal conversion has one complete executable contract", () => {
  const ids = VERIFIED_UNIVERSAL_RECIPE_CONTRACTS.map((contract) => contract.recipeId);
  expect(new Set(ids).size).toBe(ids.length);
  for (const contract of VERIFIED_UNIVERSAL_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(engineForRecipe(recipe!).id).toBe(contract.engineId);
    expect(contract.expectedExtensions.length).toBeGreaterThan(0);
    expect(contract.differentialControls).toEqual(recipe!.editorControls);
    expect(Object.keys(contract.fixtureSettings)).toEqual(recipe!.editorControls);
  }
});

test("universal preservation and inspection tools are offered for every file family", () => {
  const universalIds = new Set(CONVERSION_RECIPES.filter((recipe) => recipe.input.includes("unknown")).map((recipe) => recipe.id));
  expect(universalIds).toEqual(new Set([
    "file-to-zip", "file-to-gzip", "file-checksum-manifest", "file-metadata-report", "file-byte-analysis",
    "file-to-base64", "file-to-data-uri", "file-to-hex", "file-chunk-zip"
  ]));
});
