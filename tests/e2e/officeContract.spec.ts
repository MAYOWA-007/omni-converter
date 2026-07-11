import { expect, test } from "playwright/test";
import { VERIFIED_OFFICE_RECIPE_CONTRACTS } from "../../src/data/verifiedOfficeRecipes";

test("every promoted Office contract completes through the job engine and validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/office-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_OFFICE_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate((recipeId) => window.__omniOfficeHarness.runOfficeRecipe(recipeId), contract.recipeId);
    expect(outputs.map((output) => output.name.split(".").pop()?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(outputs.every((output) => output.validation.valid), contract.recipeId).toBe(true);
  }
});
