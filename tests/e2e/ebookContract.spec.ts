import { expect, test } from "playwright/test";
import { VERIFIED_EBOOK_RECIPE_CONTRACTS } from "../../src/data/verifiedEbookRecipes";

test("every promoted ebook contract completes through the job engine and validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/ebook-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_EBOOK_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe());
    expect(outputs.map((output) => output.name.split(".").pop()?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(outputs.every((output) => output.validation.valid), contract.recipeId).toBe(true);
  }
});
