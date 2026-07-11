import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_ARCHIVE_RECIPE_CONTRACTS, VERIFIED_ARCHIVE_RECIPE_IDS } from "../../src/data/verifiedArchiveRecipes";

test("every verified archive/application recipe has one executable fixture contract", () => {
  expect(new Set(VERIFIED_ARCHIVE_RECIPE_CONTRACTS.map((contract) => contract.recipeId)).size).toBe(VERIFIED_ARCHIVE_RECIPE_CONTRACTS.length);
  for (const contract of VERIFIED_ARCHIVE_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("RAR, 7Z, and unsupported TAR routes are not promoted by ZIP contracts", () => {
  for (const id of ["archive-inspect", "archive-extract", "archive-repack-zip"]) {
    expect(CONVERSION_RECIPES.find((recipe) => recipe.id === id)?.inputFormats).toEqual(["zip"]);
  }
  expect(VERIFIED_ARCHIVE_RECIPE_IDS.size).toBe(4);
});
