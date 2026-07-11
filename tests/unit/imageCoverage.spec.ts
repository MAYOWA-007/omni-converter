import { expect, test } from "playwright/test";
import { verifiedRecipesForFamily } from "../../src/core/catalog";
import { VERIFIED_IMAGE_RECIPE_CONTRACTS } from "../../src/data/verifiedImageRecipes";
import { engineForRecipe } from "../../src/engines/registry";
import "../../src/lib/conversions";

test("every verified browser image recipe has one executable coverage contract", () => {
  const verified = verifiedRecipesForFamily("image", "browser");
  const contractIds = VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId);

  expect(new Set(contractIds).size).toBe(contractIds.length);
  expect(contractIds).toEqual(verified.map((recipe) => recipe.id));

  for (const recipe of verified) {
    const contract = VERIFIED_IMAGE_RECIPE_CONTRACTS.find((candidate) => candidate.recipeId === recipe.id);
    expect(contract, `${recipe.id} is missing its fixture contract`).toBeTruthy();
    expect(contract?.fixture).toBe("transparent-quadrants-png");
    expect(contract?.expectedExtensions.length).toBeGreaterThan(0);
    expect(engineForRecipe(recipe).id).toBe(contract?.engineId);
    expect(Object.keys(contract?.fixtureSettings ?? {})).toEqual(recipe.editorControls);
    for (const control of recipe.editorControls) {
      expect(recipe.controlOptions?.[control]).toContain(contract?.fixtureSettings[control]);
    }
  }
});

test("verified recipe controls are covered by settings-differential assertions", () => {
  const verified = verifiedRecipesForFamily("image", "browser");

  for (const recipe of verified) {
    const contract = VERIFIED_IMAGE_RECIPE_CONTRACTS.find((candidate) => candidate.recipeId === recipe.id)!;
    expect(contract.differentialControls).toEqual(recipe.editorControls);
    for (const control of recipe.editorControls) {
      expect(recipe.controlOptions?.[control]?.length, `${recipe.id}.${control} needs two testable values`).toBeGreaterThan(1);
    }
  }
});
