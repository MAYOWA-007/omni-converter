import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_TABULAR_RECIPE_CONTRACTS, VERIFIED_TABULAR_RECIPE_IDS } from "../../src/data/verifiedTabularRecipes";

test("every verified browser table recipe has one executable fixture contract", () => {
  expect(new Set(VERIFIED_TABULAR_RECIPE_CONTRACTS.map((contract) => contract.recipeId)).size).toBe(VERIFIED_TABULAR_RECIPE_CONTRACTS.length);
  for (const contract of VERIFIED_TABULAR_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("table routes are limited to parsed inputs and truthful outputs", () => {
  const dataRecipe = CONVERSION_RECIPES.find((recipe) => recipe.id === "data-json-csv")!;
  const chartRecipe = CONVERSION_RECIPES.find((recipe) => recipe.id === "spreadsheet-chart-pack")!;
  expect(dataRecipe.controlOptions?.outputFormat).not.toEqual(expect.arrayContaining(["XML", "YAML"]));
  expect(dataRecipe.inputFormats).not.toEqual(expect.arrayContaining(["xml", "yaml", "yml"]));
  expect(VERIFIED_TABULAR_RECIPE_IDS.has("spreadsheet-chart-pack")).toBe(true);
  expect(chartRecipe.inputFormats).toEqual(["xlsx", "csv", "tsv"]);
  expect(chartRecipe.description).not.toMatch(/line|pie/i);
});
