import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/font-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("WOFF2 inspection and web kit preserve the original font with usable local assets", async ({ page }) => {
  const inspection = await page.evaluate(() => window.__omniFontHarness.inspectFixture());
  expect(inspection).toMatchObject({ family: "font", exactFormat: "woff2", signatureSource: "signature" });

  const [output] = await page.evaluate(() => window.__omniFontHarness.runFontRecipe("font-web-pack"));
  const entries = await page.evaluate((bytes) => window.__omniFontHarness.unzip(bytes), output.bytes);
  expect(output.name).toBe("Omni-Display-web-font-kit.zip");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "zip" });
  expect(entries.map((entry) => entry.name)).toEqual([
    "fonts/Omni-Display.woff2",
    "css/Omni-Display.css",
    "specimen.html",
    "README.txt"
  ]);
  expect(entries[0].bytes.slice(0, 4)).toEqual([119, 79, 70, 50]);
  expect(entries[1].text).toContain('@font-face{font-family:"Omni Display"');
  expect(entries[1].text).toContain('format("woff2")');
  expect(entries[2].text).toContain('src:url("fonts/Omni-Display.woff2")');
});

test("font specimen produces real PNG and PDF outputs using the uploaded typeface", async ({ page }) => {
  const [png] = await page.evaluate(() => window.__omniFontHarness.runFontRecipe("font-specimen", { outputFormat: "PNG" }));
  const raster = await page.evaluate((bytes) => window.__omniFontHarness.inspectRaster(bytes), png.bytes);
  expect(png.name).toBe("Omni-Display-specimen.png");
  expect(png.validation).toEqual({ valid: true, detectedFormat: "png" });
  expect(raster).toMatchObject({ width: 1600, height: 1100 });
  expect(raster.lightPixels).toBeGreaterThan(10_000);

  const [pdf] = await page.evaluate(() => window.__omniFontHarness.runFontRecipe("font-specimen", { outputFormat: "PDF" }));
  const document = await page.evaluate((bytes) => window.__omniFontHarness.inspectPdf(bytes), pdf.bytes);
  expect(pdf.name).toBe("Omni-Display-specimen.pdf");
  expect(pdf.validation).toEqual({ valid: true, detectedFormat: "pdf" });
  expect(document).toEqual({ pages: 1, width: 800, height: 550 });
});
