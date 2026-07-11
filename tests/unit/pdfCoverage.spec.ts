import { expect, test } from "playwright/test";
import { verifiedRecipesForFamily } from "../../src/core/catalog";
import { VERIFIED_PDF_RECIPE_CONTRACTS } from "../../src/data/verifiedPdfRecipes";
import { engineForRecipe } from "../../src/engines/registry";
import "../../src/lib/conversions";

test("every verified browser PDF recipe has one executable fixture contract", () => {
  const verified = verifiedRecipesForFamily("pdf", "browser");
  const contractIds = VERIFIED_PDF_RECIPE_CONTRACTS.map((contract) => contract.recipeId);

  expect(contractIds).toHaveLength(15);
  expect(new Set(contractIds).size).toBe(contractIds.length);
  expect(contractIds).toEqual(verified.map((recipe) => recipe.id));

  for (const recipe of verified) {
    const contract = VERIFIED_PDF_RECIPE_CONTRACTS.find((candidate) => candidate.recipeId === recipe.id);
    expect(contract, `${recipe.id} is missing its fixture contract`).toBeTruthy();
    expect(contract?.fixture).toBe("mixed-four-page-pdf");
    expect(contract?.expectedExtensions.length).toBeGreaterThan(0);
    expect(engineForRecipe(recipe).id).toBe(contract?.engineId);
    expect(Object.keys(contract?.fixtureSettings ?? {})).toEqual(recipe.editorControls);
    for (const control of recipe.editorControls) {
      expect(recipe.controlOptions?.[control], `${recipe.id}.${control} needs explicit options`).toContain(contract?.fixtureSettings[control]);
      expect(recipe.controlOptions?.[control]?.length, `${recipe.id}.${control} needs two meaningful values`).toBeGreaterThan(1);
      expect(recipe.controlOptions?.[control]?.some((value) => /custom|later|auto/i.test(value))).toBe(false);
    }
  }
});

test("verified PDF controls are covered by settings-differential assertions", () => {
  const verified = verifiedRecipesForFamily("pdf", "browser");
  for (const recipe of verified) {
    const contract = VERIFIED_PDF_RECIPE_CONTRACTS.find((candidate) => candidate.recipeId === recipe.id)!;
    expect(contract.differentialControls).toEqual(recipe.editorControls);
  }
});

test("experimental OCR and image-object extraction remain unavailable", () => {
  const verifiedIds = new Set(verifiedRecipesForFamily("pdf", "browser").map((recipe) => recipe.id));
  expect(verifiedIds.has("pdf-ocr-searchable")).toBe(false);
  expect(verifiedIds.has("pdf-extract-images")).toBe(false);
});
