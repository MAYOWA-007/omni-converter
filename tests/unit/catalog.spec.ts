import { expect, test } from "playwright/test";
import { browserRecipesForFamily, deriveRecipeAvailability, recipeSupportsInspection, verifiedRecipesForFamily } from "../../src/core/catalog";
import { VERIFIED_IMAGE_RECIPE_CONTRACTS } from "../../src/data/verifiedImageRecipes";

test("implemented without fixtures is not selectable", () => {
  expect(deriveRecipeAvailability({ maturity: "implemented" }, "browser").selectable).toBe(false);
});

test("verified browser recipe is selectable", () => {
  expect(deriveRecipeAvailability({ maturity: "verified", runtimes: ["browser"] }, "browser").selectable).toBe(true);
});

test("browser image promotion is driven by fixture contracts", () => {
  expect(verifiedRecipesForFamily("image", "browser").map((recipe) => recipe.id)).toEqual(VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
});

test("normal browser catalog excludes image paths without passing fixtures", () => {
  const ids = browserRecipesForFamily("image").map((recipe) => recipe.id);
  expect(ids).toEqual(VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
  expect(ids).not.toContain("image-to-avif");
  expect(ids).not.toContain("image-ocr-text");
  expect(ids).not.toContain("image-to-motion-card");
});

test("exact input-format gates prevent legacy or mislabeled routes from being offered", () => {
  const recipe = { inputFormats: ["xlsx"] };
  const base = { name: "book.xlsx", extension: "xlsx", mime: "application/octet-stream", size: 12, family: "spreadsheet" as const, notes: [] };

  expect(recipeSupportsInspection(recipe, { ...base, exactFormat: "xlsx" })).toBe(true);
  expect(recipeSupportsInspection(recipe, { ...base, name: "legacy.xls", extension: "xls", exactFormat: "unknown" })).toBe(false);
  expect(recipeSupportsInspection(recipe, { ...base, exactFormat: "zip" })).toBe(false);
});
