import { expect, test } from "playwright/test";
import { VERIFIED_TABULAR_RECIPE_CONTRACTS } from "../../src/data/verifiedTabularRecipes";

test("every promoted table contract completes through the job engine and validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/tabular-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_TABULAR_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate((recipeId) => window.__omniTabularHarness.runTabularRecipe(recipeId), contract.recipeId);
    expect(outputs.map((output) => output.name.split(".").pop()?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(outputs.every((output) => output.validation.valid), contract.recipeId).toBe(true);
  }
});
