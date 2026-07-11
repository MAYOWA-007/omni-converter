import { expect, test, type Page } from "playwright/test";
import type { ConversionSettings } from "../../src/lib/types";

test.describe.configure({ timeout: 120_000 });

interface HarnessOutput {
  name: string;
  type: string;
  bytes: number[];
  validation?: { valid: boolean; detectedFormat: string };
}

interface ZipEntryFact {
  name: string;
  compressionMethod?: number;
  compressedSize?: number;
  uncompressedSize?: number;
  width?: number;
  height?: number;
  corner?: number[];
  text?: string;
  header?: number[];
}

async function run(page: Page, recipeId: string, settings: ConversionSettings) {
  return page.evaluate(({ recipeId, settings }) => window.__omniImageHarness.runImageRecipe(recipeId, settings, "Quarter Tone ?.png"), { recipeId, settings }) as Promise<HarnessOutput[]>;
}

async function unzip(page: Page, output: HarnessOutput) {
  return page.evaluate((candidate) => window.__omniImageHarness.inspectZip(candidate), output) as Promise<ZipEntryFact[]>;
}

function imageEntries(entries: ZipEntryFact[]) {
  return entries.filter((entry) => /\.(?:png|jpe?g|webp)$/i.test(entry.name));
}

function jsonEntry(entries: ZipEntryFact[], name: string) {
  const text = entries.find((entry) => entry.name === name)?.text;
  if (!text) throw new Error(`Missing ${name}.`);
  return JSON.parse(text) as Record<string, unknown>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("thumbnail ZIP options control formats, size sets, quality, naming and ZIP level", async ({ page }) => {
  const base = { outputFormat: "WebP", resolution: "160/320/640 set", compression: "Balanced", batchNaming: "Width suffix", bundle: "Balanced ZIP" };
  const baseline = (await run(page, "image-thumbnail-set", base))[0];
  const jpeg = (await run(page, "image-thumbnail-set", { ...base, outputFormat: "JPEG" }))[0];
  const sizes = (await run(page, "image-thumbnail-set", { ...base, resolution: "320/640/1080/1920 set" }))[0];
  const maximum = (await run(page, "image-thumbnail-set", { ...base, compression: "Maximum quality" }))[0];
  const small = (await run(page, "image-thumbnail-set", { ...base, compression: "Small file" }))[0];
  const numbered = (await run(page, "image-thumbnail-set", { ...base, batchNaming: "Numbered sequence" }))[0];
  const stored = (await run(page, "image-thumbnail-set", { ...base, bundle: "Store ZIP" }))[0];
  const compressed = (await run(page, "image-thumbnail-set", { ...base, bundle: "Maximum ZIP" }))[0];

  expect(baseline.validation).toEqual({ valid: true, detectedFormat: "zip" });
  const baselineEntries = await unzip(page, baseline);
  expect(imageEntries(baselineEntries).map((entry) => [entry.name, entry.width, entry.height])).toEqual([
    ["thumbnails/quarter-tone-160w.webp", 160, 107],
    ["thumbnails/quarter-tone-320w.webp", 320, 213],
    ["thumbnails/quarter-tone-640w.webp", 640, 427]
  ]);
  expect(jsonEntry(baselineEntries, "manifest.json")).toMatchObject({ format: "webp", widths: [160, 320, 640] });
  expect(imageEntries(await unzip(page, jpeg)).every((entry) => entry.name.endsWith(".jpg"))).toBe(true);
  expect(imageEntries(await unzip(page, sizes)).map((entry) => entry.width)).toEqual([320, 640, 1080, 1920]);
  expect(imageEntries(await unzip(page, numbered)).map((entry) => entry.name)).toEqual([
    "thumbnails/quarter-tone-01.webp", "thumbnails/quarter-tone-02.webp", "thumbnails/quarter-tone-03.webp"
  ]);
  const maximumBytes = imageEntries(await unzip(page, maximum)).reduce((sum, entry) => sum + (entry.uncompressedSize ?? 0), 0);
  const smallBytes = imageEntries(await unzip(page, small)).reduce((sum, entry) => sum + (entry.uncompressedSize ?? 0), 0);
  expect(smallBytes).toBeLessThan(maximumBytes);
  expect((await unzip(page, stored)).every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect((await unzip(page, compressed)).some((entry) => entry.compressionMethod === 8)).toBe(true);
});

test("favicon ZIP creates real PNG sizes, ICO and manifest for each selected set", async ({ page }) => {
  const base = { crop: "Fit inside transparent square", resolution: "Browser-only set", batchNaming: "Source and size", bundle: "Balanced ZIP" };
  const browser = (await run(page, "image-favicon-set", base))[0];
  const pwa = (await run(page, "image-favicon-set", { ...base, resolution: "Full PWA set" }))[0];
  const cropped = (await run(page, "image-favicon-set", { ...base, crop: "Center square crop" }))[0];
  const standard = (await run(page, "image-favicon-set", { ...base, batchNaming: "Standard icon names" }))[0];
  const stored = (await run(page, "image-favicon-set", { ...base, bundle: "Store ZIP" }))[0];

  expect(browser.validation).toEqual({ valid: true, detectedFormat: "zip" });
  const browserEntries = await unzip(page, browser);
  expect(imageEntries(browserEntries).map((entry) => [entry.name, entry.width, entry.height])).toEqual([
    ["icons/quarter-tone-16x16.png", 16, 16], ["icons/quarter-tone-32x32.png", 32, 32], ["icons/quarter-tone-48x48.png", 48, 48]
  ]);
  expect(browserEntries.find((entry) => entry.name === "favicon.ico")?.header?.slice(0, 4)).toEqual([0, 0, 1, 0]);
  expect(jsonEntry(browserEntries, "site.webmanifest")).toMatchObject({ icons: expect.any(Array) });
  expect(imageEntries(await unzip(page, pwa)).map((entry) => entry.width)).toEqual([192, 512]);
  expect(imageEntries(await unzip(page, standard)).map((entry) => entry.name)).toEqual(["icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png"]);
  const fitCorner = imageEntries(browserEntries)[0].corner?.[3];
  const cropCorner = imageEntries(await unzip(page, cropped))[0].corner?.[3];
  expect(fitCorner).toBe(0);
  expect(cropCorner).toBe(255);
  expect((await unzip(page, stored)).every((entry) => entry.compressionMethod === 0)).toBe(true);
});

test("format bundle manifest and entries exactly match selected conversion settings", async ({ page }) => {
  const base = { outputFormat: "PNG + JPEG + WebP", resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", compression: "Balanced", batchNaming: "Keep source name", bundle: "Balanced ZIP" };
  const all = (await run(page, "image-format-bundle", base))[0];
  const subset = (await run(page, "image-format-bundle", { ...base, outputFormat: "PNG + JPEG" }))[0];
  const geometry = (await run(page, "image-format-bundle", { ...base, resolution: "512 px wide", crop: "Center square crop" }))[0];
  const matte = (await run(page, "image-format-bundle", { ...base, color: "White matte" }))[0];
  const small = (await run(page, "image-format-bundle", { ...base, compression: "Small file" }))[0];
  const named = (await run(page, "image-format-bundle", { ...base, batchNaming: "Format suffix" }))[0];
  const stored = (await run(page, "image-format-bundle", { ...base, bundle: "Store ZIP" }))[0];

  expect(all.validation).toEqual({ valid: true, detectedFormat: "zip" });
  const allEntries = await unzip(page, all);
  expect(imageEntries(allEntries).map((entry) => entry.name)).toEqual(["formats/Quarter Tone.png", "formats/Quarter Tone.jpg", "formats/Quarter Tone.webp"]);
  expect(jsonEntry(allEntries, "manifest.json")).toMatchObject({ formats: ["png", "jpeg", "webp"] });
  expect(imageEntries(await unzip(page, subset)).map((entry) => entry.name)).toEqual(["formats/Quarter Tone.png", "formats/Quarter Tone.jpg"]);
  expect(imageEntries(await unzip(page, geometry)).every((entry) => entry.width === 512 && entry.height === 512)).toBe(true);
  expect(imageEntries(await unzip(page, matte)).find((entry) => entry.name.endsWith(".png"))?.corner).toEqual([255, 255, 255, 255]);
  const allJpeg = imageEntries(allEntries).find((entry) => entry.name.endsWith(".jpg"))!;
  const smallJpeg = imageEntries(await unzip(page, small)).find((entry) => entry.name.endsWith(".jpg"))!;
  expect(smallJpeg.uncompressedSize).toBeLessThan(allJpeg.uncompressedSize!);
  expect(imageEntries(await unzip(page, named)).map((entry) => entry.name)).toEqual(["formats/quarter-tone-png.png", "formats/quarter-tone-jpg.jpg", "formats/quarter-tone-webp.webp"]);
  expect((await unzip(page, stored)).every((entry) => entry.compressionMethod === 0)).toBe(true);
});

test("social pack filters real platform presets and applies format, fit, scale, naming and compression", async ({ page }) => {
  const base = { outputFormat: "JPEG", aspectRatio: "Square only", crop: "Fill frame", resolution: "Half-size preview", compression: "Balanced", batchNaming: "Platform names", bundle: "Balanced ZIP" };
  const square = (await run(page, "image-social-pack", base))[0];
  const webp = (await run(page, "image-social-pack", { ...base, outputFormat: "WebP" }))[0];
  const portrait = (await run(page, "image-social-pack", { ...base, aspectRatio: "Portrait only" }))[0];
  const fit = (await run(page, "image-social-pack", { ...base, crop: "Fit entire source" }))[0];
  const full = (await run(page, "image-social-pack", { ...base, resolution: "Platform size" }))[0];
  const small = (await run(page, "image-social-pack", { ...base, compression: "Small file" }))[0];
  const prefixed = (await run(page, "image-social-pack", { ...base, batchNaming: "Source prefix" }))[0];
  const stored = (await run(page, "image-social-pack", { ...base, bundle: "Store ZIP" }))[0];

  expect(square.validation).toEqual({ valid: true, detectedFormat: "zip" });
  const squareEntries = await unzip(page, square);
  expect(imageEntries(squareEntries).map((entry) => [entry.name, entry.width, entry.height])).toEqual([["social/instagram-square.jpg", 540, 540]]);
  expect(imageEntries(await unzip(page, webp))[0].name).toBe("social/instagram-square.webp");
  expect(imageEntries(await unzip(page, portrait)).map((entry) => [entry.width, entry.height])).toEqual([[540, 675], [540, 960]]);
  expect(imageEntries(await unzip(page, fit))[0].corner?.slice(0, 3)).toEqual([255, 255, 255]);
  expect(imageEntries(await unzip(page, full))[0]).toMatchObject({ width: 1080, height: 1080 });
  expect(imageEntries(await unzip(page, small))[0].uncompressedSize).toBeLessThan(imageEntries(squareEntries)[0].uncompressedSize!);
  expect(imageEntries(await unzip(page, prefixed))[0].name).toBe("social/quarter-tone-instagram-square.jpg");
  expect((await unzip(page, stored)).every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(jsonEntry(squareEntries, "manifest.json")).toMatchObject({ format: "jpeg", outputs: expect.any(Array) });
});
