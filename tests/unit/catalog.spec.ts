import { expect, test } from "playwright/test";
import { browserRecipesForFamily, deriveRecipeAvailability, loadConversionCatalog, recipeSupportsInspection, verifiedRecipesForFamily } from "../../src/core/catalog";
import { VERIFIED_IMAGE_RECIPE_CONTRACTS } from "../../src/data/verifiedImageRecipes";

test("implemented without fixtures is not selectable", () => {
  expect(deriveRecipeAvailability({ maturity: "implemented" }, "browser").selectable).toBe(false);
});

test("verified browser recipe is selectable", () => {
  expect(deriveRecipeAvailability({ maturity: "verified", runtimes: ["browser"] }, "browser").selectable).toBe(true);
});

test("browser image promotion is driven by fixture contracts", () => {
  const imageIds = verifiedRecipesForFamily("image", "browser")
    .filter((recipe) => recipe.input.includes("image"))
    .map((recipe) => recipe.id);
  expect(imageIds).toEqual(VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
});

test("normal browser catalog excludes image paths without passing fixtures", () => {
  const ids = browserRecipesForFamily("image").map((recipe) => recipe.id);
  expect(ids).toEqual(expect.arrayContaining(VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId)));
  expect(ids).toContain("file-to-zip");
  expect(ids).toContain("file-checksum-manifest");
  expect(ids).not.toContain("image-to-avif");
  expect(ids).not.toContain("image-ocr-text");
  expect(ids).not.toContain("image-to-motion-card");
});

test("loads and reuses the conversion catalog on demand", async () => {
  const first = loadConversionCatalog();
  const second = loadConversionCatalog();

  expect(second).toBe(first);
  await expect(first).resolves.toMatchObject({ CONVERSION_RECIPES: expect.any(Array) });
});

test("exact input-format gates prevent legacy or mislabeled routes from being offered", () => {
  const recipe = { inputFormats: ["xlsx"] };
  const base = { name: "book.xlsx", extension: "xlsx", mime: "application/octet-stream", size: 12, family: "spreadsheet" as const, notes: [] };

  expect(recipeSupportsInspection(recipe, { ...base, exactFormat: "xlsx" })).toBe(true);
  expect(recipeSupportsInspection(recipe, { ...base, name: "legacy.xls", extension: "xls", exactFormat: "unknown" })).toBe(false);
  expect(recipeSupportsInspection(recipe, { ...base, exactFormat: "zip" })).toBe(false);
});
