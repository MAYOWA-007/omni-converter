import { expect, test, type Page } from "playwright/test";
import type { ConversionSettings } from "../../src/lib/types";

interface HarnessOutput {
  name: string;
  type: string;
  bytes: number[];
  validation?: { valid: boolean; detectedFormat: string };
}

const BASE: ConversionSettings = {
  resolution: "Original",
  crop: "Fit entire source",
  color: "Preserve transparency",
  compression: "Maximum quality",
  batchNaming: "Keep source name"
};

async function run(page: Page, recipeId: string, settings: ConversionSettings = BASE, sourceName = "Quarter Tone ?.png") {
  return page.evaluate(({ recipeId, settings, sourceName }) => window.__omniImageHarness.runImageRecipe(recipeId, settings, sourceName), { recipeId, settings, sourceName }) as Promise<HarnessOutput[]>;
}

async function inspect(page: Page, output: HarnessOutput) {
  return page.evaluate((candidate) => window.__omniImageHarness.inspectImage(candidate), output);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("PNG conversion applies resolution, crop, transparency, matte and naming", async ({ page }) => {
  const original = (await run(page, "image-to-png"))[0];
  const resized = (await run(page, "image-to-png", { ...BASE, resolution: "512 px wide" }))[0];
  const cropped = (await run(page, "image-to-png", { ...BASE, crop: "Center square crop" }))[0];
  const matte = (await run(page, "image-to-png", { ...BASE, color: "White matte" }))[0];
  const named = (await run(page, "image-to-png", { ...BASE, batchNaming: "Format suffix" }))[0];

  expect(original.validation).toEqual({ valid: true, detectedFormat: "png" });
  expect(original.type).toBe("image/png");
  expect(await inspect(page, original)).toMatchObject({ width: 240, height: 160, corner: [0, 0, 0, 0] });
  expect(await inspect(page, resized)).toMatchObject({ width: 512, height: 341 });
  expect(await inspect(page, cropped)).toMatchObject({ width: 160, height: 160 });
  expect((await inspect(page, matte)).corner).toEqual([255, 255, 255, 255]);
  expect(named.name).toBe("quarter-tone-png.png");
});

test("JPEG and WebP emit truthful signatures and honor quality, matte and geometry", async ({ page }) => {
  for (const [recipeId, format, mime] of [
    ["image-to-jpeg", "jpeg", "image/jpeg"],
    ["image-to-webp", "webp", "image/webp"]
  ] as const) {
    const maximum = (await run(page, recipeId, { ...BASE, color: "Black matte", compression: "Maximum quality" }))[0];
    const small = (await run(page, recipeId, { ...BASE, color: "Black matte", compression: "Small file" }))[0];
    const resized = (await run(page, recipeId, { ...BASE, color: "White matte", resolution: "512 px wide", crop: "Center 4:5 crop" }))[0];
    const clean = (await run(page, recipeId, { ...BASE, color: "White matte", batchNaming: "Clean filename" }))[0];

    expect(maximum.validation).toEqual({ valid: true, detectedFormat: format });
    expect(maximum.type).toBe(mime);
    const maximumFacts = await inspect(page, maximum);
    expect(maximumFacts.width).toBe(240);
    expect(maximumFacts.height).toBe(160);
    expect(maximumFacts.corner.slice(0, 3).every((channel) => channel < 12)).toBe(true);
    expect(small.bytes).not.toEqual(maximum.bytes);
    expect(small.bytes.length).toBeLessThan(maximum.bytes.length);
    expect(await inspect(page, resized)).toMatchObject({ width: 512, height: 640 });
    expect(clean.name).toBe(recipeId === "image-to-jpeg" ? "quarter-tone.jpg" : "quarter-tone.webp");
  }
});

test("BMP applies crop, resolution, matte and safe output naming", async ({ page }) => {
  const original = (await run(page, "image-to-bmp", { ...BASE, color: "Black matte" }))[0];
  const cropped = (await run(page, "image-to-bmp", { ...BASE, color: "White matte", crop: "Center 16:9 crop", resolution: "512 px wide", batchNaming: "Format suffix" }))[0];
  expect(original.validation).toEqual({ valid: true, detectedFormat: "bmp" });
  expect(original.type).toBe("image/bmp");
  expect((await inspect(page, original)).corner.slice(0, 3)).toEqual([0, 0, 0]);
  expect(await inspect(page, cropped)).toMatchObject({ width: 512, height: 288 });
  expect(cropped.name).toBe("quarter-tone-bmp.bmp");
});

test("AVIF remains unverified and canvas MIME fallback is rejected", async ({ page }) => {
  const attempt = await page.evaluate(() => window.__omniImageHarness.attemptDirectImageRecipe("image-to-avif"));
  expect(attempt.ok).toBe(false);
  if (!attempt.ok) expect(attempt.error).toMatch(/AVIF export is not supported|AVIF encoder returned/i);
});

declare global {
  interface Window {
    __omniImageHarness: {
      runImageRecipe(recipeId: string, settings: ConversionSettings, sourceName?: string): Promise<HarnessOutput[]>;
      inspectImage(output: Pick<HarnessOutput, "bytes" | "type">): Promise<{ width: number; height: number; corner: number[]; header: number[] }>;
      attemptDirectImageRecipe(recipeId: string): Promise<{ ok: true; name?: string; type?: string; header: number[] } | { ok: false; error: string }>;
    };
  }
}
