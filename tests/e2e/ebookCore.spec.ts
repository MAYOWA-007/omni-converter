import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/ebook-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("EPUB exports follow spine order and produce readable Markdown and text", async ({ page }) => {
  const [markdown] = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe());
  expect(markdown.name).toBe("Spine-Order-converted.md");
  expect(markdown.text!.indexOf("Opening")).toBeLessThan(markdown.text!.indexOf("Details"));
  expect(markdown.text).toContain("## Chapter 1: Opening");
  expect(markdown.text).toContain("**real structure**");
  expect(markdown.text).not.toMatch(/onclick|<script|javascript:|window\.compromised/i);

  const [text] = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe({ outputFormat: "TXT", metadata: "Content only", batchNaming: "Clean filename" }));
  expect(text.name).toBe("Spine-Order.txt");
  expect(text.text).not.toContain("Chapter 1:");
  expect(text.text!.indexOf("Opening")).toBeLessThan(text.text!.indexOf("Details"));
});

test("EPUB HTML export sanitizes active chapter markup", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe({ outputFormat: "Sanitized HTML" }));
  expect(output.name).toBe("Spine-Order-converted.html");
  expect(output.text).toContain("<h1>Opening</h1>");
  expect(output.text).toContain("<a>Read</a>");
  expect(output.text).not.toMatch(/onclick|<script|javascript:|window\.compromised/i);
  expect(output.text!.indexOf("Opening")).toBeLessThan(output.text!.indexOf("Details"));
});

test("EPUB chapter ZIPs honor type, naming, manifest, and compression controls", async ({ page }) => {
  const [stored] = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe({ outputFormat: "Text ZIP by chapter", bundle: "Store ZIP", batchNaming: "Clean filename" }));
  const storedEntries = await page.evaluate((bytes) => window.__omniEbookHarness.unzip(bytes), stored.bytes);
  expect(stored.name).toBe("Spine-Order-chapters-text.zip");
  expect(storedEntries.map((entry) => entry.name)).toEqual([
    "chapters/001-opening.txt",
    "chapters/002-details.txt",
    "manifest.json"
  ]);
  expect(storedEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(JSON.parse(storedEntries[2].text).chapters.map((chapter: { title: string }) => chapter.title)).toEqual(["Opening", "Details"]);

  const [compressed] = await page.evaluate(() => window.__omniEbookHarness.runEbookRecipe({ outputFormat: "HTML ZIP by chapter", bundle: "Maximum ZIP" }));
  const compressedEntries = await page.evaluate((bytes) => window.__omniEbookHarness.unzip(bytes), compressed.bytes);
  expect(compressedEntries.map((entry) => entry.name)).toEqual([
    "chapters/001-opening-converted.html",
    "chapters/002-details-converted.html",
    "manifest.json"
  ]);
  expect(compressedEntries.some((entry) => entry.compressionMethod === 8)).toBe(true);
  expect(compressedEntries[0].text).not.toMatch(/onclick|<script|javascript:/i);
});
