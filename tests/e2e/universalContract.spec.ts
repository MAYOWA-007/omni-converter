import { expect, test } from "playwright/test";
import { VERIFIED_UNIVERSAL_RECIPE_CONTRACTS } from "../../src/data/verifiedUniversalRecipes";

test("every promoted universal contract executes and passes central byte validation", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/universal-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  for (const contract of VERIFIED_UNIVERSAL_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate((recipeId) => window.__omniUniversalHarness.runUniversalRecipe(recipeId), contract.recipeId);
    expect(outputs.map((output) => output.name.split(".").pop()?.toLowerCase()), contract.recipeId).toEqual(contract.expectedExtensions);
    expect(outputs.every((output) => output.size > 0), contract.recipeId).toBe(true);
    expect(outputs.every((output) => output.validation.valid), `${contract.recipeId}: ${JSON.stringify(outputs)}`).toBe(true);
  }
});
