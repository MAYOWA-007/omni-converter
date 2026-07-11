import { expect, test, type Page } from "playwright/test";
import type { ConversionSettings } from "../../src/lib/types";

interface HarnessOutput {
  name: string;
  type: string;
  bytes: number[];
  validation?: { valid: boolean; detectedFormat: string };
}

async function run(page: Page, settings: ConversionSettings, sourceName?: string, recipeId = "image-to-pdf") {
  return page.evaluate(async ({ recipeId, settings, sourceName }) => window.__omniImageHarness.runImageRecipe(recipeId, settings, sourceName), { recipeId, settings, sourceName }) as Promise<HarnessOutput[]>;
}

async function openPdf(page: Page, output: HarnessOutput) {
  return page.evaluate((bytes) => window.__omniImageHarness.inspectPdf(bytes), output.bytes);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("image-to-PDF page size, margins and fit mode are real geometry", async ({ page }) => {
  const original = (await run(page, {
    pageSize: "Original image size at 96 PPI", margins: "None", crop: "Fit entire source", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  }))[0];
  const margined = (await run(page, {
    pageSize: "Original image size at 96 PPI", margins: "Standard", crop: "Fit entire source", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  }))[0];
  const contained = (await run(page, {
    pageSize: "A4", margins: "Standard", crop: "Fit entire source", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  }))[0];
  const filled = (await run(page, {
    pageSize: "A4", margins: "Standard", crop: "Fill page", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  }))[0];

  for (const output of [original, margined, contained, filled]) {
    expect(output.validation).toEqual({ valid: true, detectedFormat: "pdf" });
  }
  const originalPdf = await openPdf(page, original);
  const marginedPdf = await openPdf(page, margined);
  const containedPdf = await openPdf(page, contained);
  const filledPdf = await openPdf(page, filled);
  expect(originalPdf.pages).toBe(1);
  expect({ width: originalPdf.width, height: originalPdf.height }).toEqual({ width: 180, height: 120 });
  expect({ width: marginedPdf.width, height: marginedPdf.height }).toEqual({ width: 252, height: 192 });
  expect(containedPdf.width).toBeCloseTo(595.28, 1);
  expect(containedPdf.height).toBeCloseTo(841.89, 1);
  expect(containedPdf.imageRatio).toBeCloseTo(1.5, 2);
  expect(filledPdf.imageRatio).toBeCloseTo((595.28 - 72) / (841.89 - 72), 2);
});

test("image-to-PDF metadata, naming and compression selections change the output", async ({ page }) => {
  const baseline = {
    pageSize: "Letter", margins: "Narrow", crop: "Fit entire source", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  };
  const kept = (await run(page, baseline, "Quarter Tone ?.png"))[0];
  const stripped = (await run(page, { ...baseline, metadata: "Strip source details" }, "Quarter Tone ?.png"))[0];
  const small = (await run(page, { ...baseline, compression: "Small file" }, "Quarter Tone ?.png"))[0];
  const clean = (await run(page, { ...baseline, batchNaming: "Clean filename" }, "Quarter Tone ?.png"))[0];
  const suffixed = (await run(page, { ...baseline, batchNaming: "PDF suffix" }, "Quarter Tone ?.png"))[0];
  const reserved = (await run(page, baseline, "CON.png"))[0];

  const keptPdf = await openPdf(page, kept);
  const strippedPdf = await openPdf(page, stripped);
  expect(kept.name).toBe("Quarter Tone.pdf");
  expect(clean.name).toBe("quarter-tone.pdf");
  expect(suffixed.name).toBe("quarter-tone-pdf.pdf");
  expect(reserved.name).toBe("_CON.pdf");
  expect(keptPdf.title).toBe("Quarter Tone ?.png");
  expect(strippedPdf.title).toBeUndefined();
  expect(stripped.bytes).not.toEqual(kept.bytes);
  expect(small.bytes).not.toEqual(kept.bytes);
  expect(small.bytes.length).toBeLessThan(kept.bytes.length);
});

test("print PDF applies every page, placement, metadata, quality and naming control", async ({ page }) => {
  const baseline = {
    pageSize: "Letter", margins: "None", crop: "Fit entire source", compression: "Maximum quality",
    metadata: "Keep source filename", batchNaming: "Keep source name"
  };
  const original = (await run(page, baseline, "Quarter Tone ?.png", "image-print-pdf"))[0];
  const a5 = (await run(page, { ...baseline, pageSize: "A5" }, undefined, "image-print-pdf"))[0];
  const wide = (await run(page, { ...baseline, margins: "Wide" }, undefined, "image-print-pdf"))[0];
  const filled = (await run(page, { ...baseline, crop: "Fill page" }, undefined, "image-print-pdf"))[0];
  const small = (await run(page, { ...baseline, compression: "Small file" }, undefined, "image-print-pdf"))[0];
  const stripped = (await run(page, { ...baseline, metadata: "Strip source details" }, undefined, "image-print-pdf"))[0];
  const named = (await run(page, { ...baseline, batchNaming: "Print suffix" }, "Quarter Tone ?.png", "image-print-pdf"))[0];
  const [originalPdf, a5Pdf, widePdf, filledPdf, strippedPdf] = await Promise.all([
    openPdf(page, original), openPdf(page, a5), openPdf(page, wide), openPdf(page, filled), openPdf(page, stripped)
  ]);

  expect(original.validation).toEqual({ valid: true, detectedFormat: "pdf" });
  expect(originalPdf).toMatchObject({ width: 612, height: 792, title: "Quarter Tone ?.png" });
  expect(a5Pdf.width).toBeCloseTo(419.53, 1);
  expect(a5Pdf.height).toBeCloseTo(595.28, 1);
  expect(widePdf.inkBounds!.left).toBeGreaterThan(originalPdf.inkBounds!.left + 25);
  expect(filledPdf.imageRatio).toBeCloseTo(612 / 792, 2);
  expect(small.bytes.length).toBeLessThan(original.bytes.length);
  expect(strippedPdf.title).toBeUndefined();
  expect(named.name).toBe("quarter-tone-print.pdf");
});

declare global {
  interface Window {
    __omniImageHarness: {
      runImageRecipe(recipeId: string, settings: ConversionSettings, sourceName?: string): Promise<HarnessOutput[]>;
      inspectPdf(bytes: number[]): Promise<{ pages: number; width: number; height: number; title?: string; imageRatio?: number; inkBounds?: { left: number; top: number; right: number; bottom: number } }>;
    };
  }
}
