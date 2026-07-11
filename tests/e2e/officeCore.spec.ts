import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/office-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("DOCX Markdown preserves semantic headings, emphasis, links, lists, tables, details, and naming", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-to-markdown"));
  expect(output.name).toBe("Quarterly-Plan-converted.md");
  expect(output.text).toContain("# Quarterly Plan");
  expect(output.text).toContain("**Bold move**");
  expect(output.text).toContain("*careful detail*");
  expect(output.text).toContain("[Example](https://example.com)");
  expect(output.text).toMatch(/[-*]\s+First item/);
  expect(output.text).toContain("Metric");
  expect(output.text).toContain("Revenue");
  expect(output.text).toContain("| Metric | Value |");
  expect(output.text).toContain("| --- | --- |");

  const [named] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-to-markdown", { metadata: "Include source filename", batchNaming: "Clean filename" }));
  expect(named.name).toBe("Quarterly-Plan.md");
  expect(named.text).toMatch(/^# Quarterly Plan\\\.docx/);
});

test("DOCX HTML is sanitized, semantic, and applies image and naming controls", async ({ page }) => {
  const [embedded] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-to-html"));
  const [omitted] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-to-html", { metadata: "Omit images", batchNaming: "Clean filename" }));
  expect(embedded.name).toBe("Quarterly-Plan-converted.html");
  expect(embedded.text).toContain("<h1>Quarterly Plan</h1>");
  expect(embedded.text).toContain("<table>");
  expect(embedded.text).toContain("data:image/png;base64,");
  expect(embedded.text).not.toMatch(/<script|onerror=/i);
  expect(omitted.name).toBe("Quarterly-Plan.html");
  expect(omitted.text).not.toContain("<img");
  expect(omitted.bytes.length).toBeLessThan(embedded.bytes.length);
});

test("DOCX asset extraction emits media only with manifest, naming, and ZIP controls", async ({ page }) => {
  const [stored] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-assets", { bundle: "Store ZIP" }));
  const entries = await page.evaluate((bytes) => window.__omniOfficeHarness.unzip(bytes), stored.bytes);
  expect(stored.name).toBe("Quarterly-Plan-assets.zip");
  expect(entries.map((entry) => entry.name)).toEqual(["assets/logo.png", "manifest.json"]);
  expect(entries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(JSON.parse(entries[1].text).assets[0]).toMatchObject({ sourcePath: "word/media/logo.png", output: "assets/logo.png" });

  const [clean] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("document-assets", { metadata: "Assets only", batchNaming: "Clean filename", bundle: "Maximum ZIP" }));
  const cleanEntries = await page.evaluate((bytes) => window.__omniOfficeHarness.unzip(bytes), clean.bytes);
  expect(clean.name).toBe("Quarterly-Plan.zip");
  expect(cleanEntries.map((entry) => entry.name)).toEqual(["assets/logo.png"]);
  expect(cleanEntries[0].compressionMethod).toBe(8);
});

test("PPTX parser follows declared slide order and reads actual speaker notes", async ({ page }) => {
  const slides = await page.evaluate(() => window.__omniOfficeHarness.inspectPresentation());
  expect(slides.map((slide) => slide.title)).toEqual(["Opening", "Details"]);
  expect(slides[0].visibleText).toEqual(["Opening", "First in declared order"]);
  expect(slides[0].notes).toEqual(["Welcome the room"]);
  expect(slides[1].notes).toEqual(["Explain the numbers"]);
});

test("PPTX text export applies format, slide selection, detail, and naming controls", async ({ page }) => {
  const [markdown] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("presentation-notes", { slideSelection: "Slide 2" }));
  expect(markdown.text).toContain("## Slide 2: Details");
  expect(markdown.text).toContain("Explain the numbers");
  expect(markdown.text).not.toContain("Welcome the room");

  const [json] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("presentation-notes", { outputFormat: "JSON outline", slideSelection: "Reverse order", metadata: "Speaker notes only", batchNaming: "Clean filename" }));
  expect(json.name).toBe("Launch-Brief.json");
  const value = JSON.parse(json.text!);
  expect(value.slides.map((slide: { title: string }) => slide.title)).toEqual(["Details", "Opening"]);
  expect(value.slides[0]).not.toHaveProperty("visibleText");
  expect(value.slides[0].notes).toEqual(["Explain the numbers"]);

  const [text] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("presentation-notes", { outputFormat: "TXT", metadata: "Visible text only" }));
  expect(text.name).toBe("Launch-Brief-notes.txt");
  expect(text.text).toContain("First in declared order");
  expect(text.text).not.toContain("Speaker notes:");
});

test("PPTX media extraction is truthful and never claims visual slide rendering", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniOfficeHarness.runOfficeRecipe("presentation-assets", { bundle: "Store ZIP" }));
  const entries = await page.evaluate((bytes) => window.__omniOfficeHarness.unzip(bytes), output.bytes);
  expect(output.name).toBe("Launch-Brief-assets.zip");
  expect(entries.map((entry) => entry.name)).toEqual(["assets/logo.png", "manifest.json"]);
  expect(entries.every((entry) => entry.compressionMethod === 0)).toBe(true);
});
