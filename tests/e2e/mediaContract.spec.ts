import { expect, test } from "playwright/test";
import { VERIFIED_MEDIA_RECIPE_CONTRACTS } from "../../src/data/verifiedMediaRecipes";

test("every promoted media contract completes through its engine and central validator", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_MEDIA_RECIPE_CONTRACTS) {
    const result = await page.evaluate((recipeId) => window.__omniMediaHarness.runMediaRecipe(recipeId), contract.recipeId);
    expect(result.outputs.map((output) => output.name.split(".").pop()?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(result.outputs.every((output) => output.validation.valid), contract.recipeId).toBe(true);
    expect(result.progress.length, contract.recipeId).toBeGreaterThan(1);
  }
});
