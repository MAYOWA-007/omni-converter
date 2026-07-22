import { expect, test } from "playwright/test";
import { VERIFIED_FONT_RECIPE_CONTRACTS } from "../../src/data/verifiedFontRecipes";

test("every promoted font contract completes through its engine and central validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/font-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_FONT_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate((recipeId) => window.__omniFontHarness.runFontRecipe(recipeId), contract.recipeId);
    expect(outputs.map((output) => output.name.split(".").at(-1)?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(outputs.every((output) => output.validation.valid), contract.recipeId).toBe(true);
  }
});
