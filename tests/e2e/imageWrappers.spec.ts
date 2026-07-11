import { expect, test, type Page } from "playwright/test";
import type { ConversionSettings } from "../../src/lib/types";

interface HarnessOutput {
  name: string;
  type: string;
  bytes: number[];
  validation?: { valid: boolean; detectedFormat: string };
}

async function run(page: Page, recipeId: string, settings: ConversionSettings) {
  return page.evaluate(({ recipeId, settings }) => window.__omniImageHarness.runImageRecipe(recipeId, settings, "Quarter Tone ?.png"), { recipeId, settings }) as Promise<HarnessOutput[]>;
}

function text(output: HarnessOutput) {
  return Buffer.from(output.bytes).toString("utf8");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("SVG wrapper is an explicit embedded raster with functional size and naming", async ({ page }) => {
  const original = (await run(page, "image-svg-wrapper", { resolution: "Original", batchNaming: "Keep source name" }))[0];
  const resized = (await run(page, "image-svg-wrapper", { resolution: "512 px wide", batchNaming: "Format suffix" }))[0];
  expect(original.validation).toEqual({ valid: true, detectedFormat: "svg" });
  expect(original.name).toBe("Quarter Tone.svg");
  expect(resized.name).toBe("quarter-tone-svg.svg");

  const facts = await page.evaluate(({ original, resized }) => {
    const parse = (value: string) => new DOMParser().parseFromString(value, "image/svg+xml").documentElement;
    const first = parse(original);
    const second = parse(resized);
    return {
      original: { width: first.getAttribute("width"), height: first.getAttribute("height"), images: first.querySelectorAll("image").length, paths: first.querySelectorAll("path").length, href: first.querySelector("image")?.getAttribute("href") },
      resized: { width: second.getAttribute("width"), height: second.getAttribute("height") }
    };
  }, { original: text(original), resized: text(resized) });
  expect(facts.original).toMatchObject({ width: "240", height: "160", images: 1, paths: 0 });
  expect(facts.original.href).toMatch(/^data:image\/png;base64,/);
  expect(facts.resized).toEqual({ width: "512", height: "341" });
});

test("data URI preserves the encoded image and applies output naming", async ({ page }) => {
  const kept = (await run(page, "image-data-uri", { batchNaming: "Keep source name" }))[0];
  const clean = (await run(page, "image-data-uri", { batchNaming: "Clean filename" }))[0];
  expect(kept.validation).toEqual({ valid: true, detectedFormat: "text" });
  expect(kept.name).toBe("Quarter Tone.data-uri.txt");
  expect(clean.name).toBe("quarter-tone.data-uri.txt");
  const uri = text(kept);
  expect(uri).toMatch(/^data:image\/png;base64,/);
  const decoded = Buffer.from(uri.split(",")[1], "base64");
  expect([...decoded.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("sanitized HTML embed honors display geometry and contains no active markup", async ({ page }) => {
  const original = (await run(page, "image-html-embed", { resolution: "Original", batchNaming: "Keep source name" }))[0];
  const resized = (await run(page, "image-html-embed", { resolution: "512 px wide", batchNaming: "Format suffix" }))[0];
  expect(original.validation).toEqual({ valid: true, detectedFormat: "html" });
  expect(original.name).toBe("Quarter Tone.html");
  expect(resized.name).toBe("quarter-tone-html.html");
  const facts = await page.evaluate(({ original, resized }) => {
    const parse = (value: string) => new DOMParser().parseFromString(value, "text/html");
    const first = parse(original);
    const second = parse(resized);
    const image = first.querySelector("img");
    const resizedImage = second.querySelector("img");
    return {
      scripts: first.querySelectorAll("script,iframe,object,embed").length,
      activeAttributes: [...first.querySelectorAll("*")].flatMap((node) => [...node.attributes]).filter((attribute) => attribute.name.startsWith("on")).length,
      source: image?.getAttribute("src"), width: image?.getAttribute("width"), height: image?.getAttribute("height"),
      resizedWidth: resizedImage?.getAttribute("width"), resizedHeight: resizedImage?.getAttribute("height")
    };
  }, { original: text(original), resized: text(resized) });
  expect(facts).toMatchObject({ scripts: 0, activeAttributes: 0, width: "240", height: "160", resizedWidth: "512", resizedHeight: "341" });
  expect(facts.source).toMatch(/^data:image\/png;base64,/);
});
