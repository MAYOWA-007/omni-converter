import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_OFFICE_RECIPE_CONTRACTS, VERIFIED_OFFICE_RECIPE_IDS } from "../../src/data/verifiedOfficeRecipes";

test("every verified Office recipe has one executable fixture contract", () => {
  expect(new Set(VERIFIED_OFFICE_RECIPE_CONTRACTS.map((contract) => contract.recipeId)).size).toBe(VERIFIED_OFFICE_RECIPE_CONTRACTS.length);
  for (const contract of VERIFIED_OFFICE_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("full-fidelity visual rendering and legacy binary Office formats remain unavailable", () => {
  expect(VERIFIED_OFFICE_RECIPE_IDS.has("presentation-slide-images")).toBe(false);
  expect(CONVERSION_RECIPES.find((recipe) => recipe.id === "presentation-slide-images")).toMatchObject({ implementation: "planned", runtimes: [] });
  for (const id of VERIFIED_OFFICE_RECIPE_IDS) {
    expect(CONVERSION_RECIPES.find((recipe) => recipe.id === id)?.inputFormats).not.toEqual(expect.arrayContaining(["doc", "ppt"]));
  }
});
