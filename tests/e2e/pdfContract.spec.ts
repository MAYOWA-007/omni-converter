import { expect, test } from "playwright/test";
import { VERIFIED_PDF_RECIPE_CONTRACTS } from "../../src/data/verifiedPdfRecipes";
import type { ConversionSettings } from "../../src/lib/types";

interface HarnessOutput {
  name: string;
  validation?: { valid: boolean; detectedFormat: string };
}

test.describe.configure({ timeout: 300_000 });

test("every promoted PDF contract completes through the job controller and central validator", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  for (const contract of VERIFIED_PDF_RECIPE_CONTRACTS) {
    const outputs = await page.evaluate(
      ({ recipeId, settings }) => window.__omniPdfHarness.runPdfRecipe(recipeId, settings, "Contract Fixture ?.pdf"),
      { recipeId: contract.recipeId, settings: contract.fixtureSettings as ConversionSettings }
    ) as HarnessOutput[];
    expect(outputs.length, `${contract.recipeId} produced no output`).toBeGreaterThan(0);
    for (const output of outputs) {
      const extension = output.name.split(".").at(-1)?.toLowerCase();
      expect(contract.expectedExtensions, `${contract.recipeId} emitted unexpected ${output.name}`).toContain(extension);
      const detectedFormat = extension === "txt" || extension === "md" ? "text" : extension;
      expect(output.validation, `${contract.recipeId} bypassed central validation`).toEqual({ valid: true, detectedFormat });
    }
  }
});
