import { expect, test, type Page } from "playwright/test";
import { VERIFIED_IMAGE_RECIPE_CONTRACTS } from "../../src/data/verifiedImageRecipes";
import type { ConversionSettings } from "../../src/lib/types";

interface HarnessOutput {
  name: string;
  type: string;
  bytes: number[];
  validation?: { valid: boolean; detectedFormat: string };
}

test.describe.configure({ timeout: 120_000 });

async function run(page: Page, recipeId: string, settings: ConversionSettings) {
  return page.evaluate(({ recipeId, settings }) => window.__omniImageHarness.runImageRecipe(recipeId, settings, "Contract Fixture ?.png"), { recipeId, settings }) as Promise<HarnessOutput[]>;
}

test("every promoted image contract completes through the job controller and central validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  for (const contract of VERIFIED_IMAGE_RECIPE_CONTRACTS) {
    const outputs = await run(page, contract.recipeId, contract.fixtureSettings);
    expect(outputs.length, `${contract.recipeId} produced no output`).toBeGreaterThan(0);
    for (const output of outputs) {
      const extension = output.name.split(".").at(-1)?.toLowerCase();
      expect(contract.expectedExtensions, `${contract.recipeId} emitted unexpected ${output.name}`).toContain(extension);
      const detectedFormat = extension === "jpg" ? "jpeg" : extension === "txt" ? "text" : extension;
      expect(output.validation, `${contract.recipeId} bypassed central validation`).toEqual({ valid: true, detectedFormat });
    }
  }
});
