import { expect, test } from "playwright/test";
import { browserRecipesForInspection } from "../../src/core/catalog";
import { VERIFIED_FONT_RECIPE_CONTRACTS } from "../../src/data/verifiedFontRecipes";
import { engineForRecipe } from "../../src/engines/registry";
import "../../src/lib/conversions";

test("browser-compatible fonts expose exactly the verified local font tools", () => {
  const recipes = browserRecipesForInspection({
    name: "Display.woff2",
    extension: "woff2",
    mime: "font/woff2",
    size: 1024,
    family: "font",
    exactFormat: "woff2",
    signatureSource: "signature",
    notes: []
  }).filter((recipe) => recipe.input.includes("font"));

  expect(recipes.map((recipe) => recipe.id)).toEqual(VERIFIED_FONT_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
  for (const recipe of recipes) {
    const contract = VERIFIED_FONT_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipe.id)!;
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(recipe.inputFormats).toEqual(["ttf", "otf", "woff", "woff2"]);
    expect(recipe.editorControls).toEqual(contract.differentialControls);
    expect(Object.keys(contract.fixtureSettings)).toEqual(recipe.editorControls);
    expect(engineForRecipe(recipe).id).toBe(contract.engineId);
  }
});

test("unsupported legacy font containers retain universal tools without font-specific claims", () => {
  const recipes = browserRecipesForInspection({
    name: "Legacy.eot",
    extension: "eot",
    mime: "application/vnd.ms-fontobject",
    size: 1024,
    family: "font",
    exactFormat: "eot",
    signatureSource: "extension",
    notes: []
  });

  expect(recipes.filter((recipe) => recipe.input.includes("font"))).toEqual([]);
  expect(recipes.filter((recipe) => recipe.input.includes("unknown"))).toHaveLength(9);
});
