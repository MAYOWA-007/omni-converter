import { expect, test } from "playwright/test";

test.describe.configure({ timeout: 120_000 });

test("PDF analysis reports the actual page count", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const inspection = await page.evaluate(() => window.__omniPdfHarness.inspectFixture());

  expect(inspection).toMatchObject({ family: "pdf", exactFormat: "pdf", pages: 4 });
  expect(inspection.notes).toContain("PDF pages detected: 4.");
});

test("PDF text extraction applies selected pages and heading style", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-to-text", {
    pageOrder: "Odd pages",
    metadata: "Add page headings",
    batchNaming: "TXT suffix"
  }));

  expect(output.name).toBe("Quarterly-Plan-text.txt");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "text" });
  expect(output.text).toContain("Page 1\n\nAlpha page Fixture page 1");
  expect(output.text).toContain("Page 3\n\nCharlie page Fixture page 3");
  expect(output.text).not.toContain("Bravo page");
  expect(output.text).not.toContain("Delta page");
});

test("PDF Markdown extraction preserves selected order and minimal headings", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-to-markdown", {
    pageOrder: "Reverse order",
    metadata: "Minimal headings",
    batchNaming: "Markdown suffix"
  }));

  expect(output.name).toBe("Quarterly-Plan-markdown.md");
  expect(output.text).not.toContain("# Quarterly Plan");
  expect(output.text?.indexOf("## Page 4")).toBeLessThan(output.text!.indexOf("## Page 1"));
  expect(output.text).toContain("Delta page Fixture page 4");
});

test("PDF HTML extraction emits sanitized selected content", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-to-html", {
    pageOrder: "Last page",
    metadata: "Minimal",
    batchNaming: "HTML suffix"
  }));

  expect(output.name).toBe("Quarterly-Plan-text.html");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "html" });
  expect(output.text).toContain("Delta page Fixture page 4");
  expect(output.text).not.toContain("Alpha page");
  expect(output.text).not.toContain("<h1>");
  expect(output.text).not.toMatch(/<script|\son\w+=|javascript:/i);
});

test("PDF page PNG bundle applies page selection, resolution, naming, and manifest mode", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-page-png-set", {
    pageOrder: "Odd pages",
    resolution: "96 DPI",
    batchNaming: "Page number only",
    bundle: "Balanced ZIP with manifest"
  }));
  const entries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-pages-png.zip");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "zip" });
  expect(entries.map((entry) => entry.name)).toEqual(["pages/page-001.png", "pages/page-003.png", "manifest.json"]);
  expect(entries[0].compressionMethod).toBe(8);
  expect(entries[0]).toMatchObject({ width: 400, height: 267 });
  expect(entries[1]).toMatchObject({ width: 534, height: 320 });
  expect(JSON.parse(entries[2].text!)).toMatchObject({ source: "Quarterly Plan ?.pdf", selectedPages: [1, 3] });
});

test("PDF page JPEG bundle uses true DPI, quality, and Store compression", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const results = await page.evaluate(async () => {
    const base = { pageOrder: "First page", resolution: "150 DPI", batchNaming: "Page number only", bundle: "Store ZIP" };
    const [high] = await window.__omniPdfHarness.runPdfRecipe("pdf-page-jpeg-set", { ...base, compression: "Maximum quality" });
    const [small] = await window.__omniPdfHarness.runPdfRecipe("pdf-page-jpeg-set", { ...base, compression: "Small file" });
    return { high, small };
  });
  const output = results.small;
  const entries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), output.bytes);
  const highEntries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), results.high.bytes);

  expect(entries.map((entry) => entry.name)).toEqual(["pages/page-001.jpg"]);
  expect(entries[0].compressionMethod).toBe(0);
  expect(entries[0]).toMatchObject({ width: 625, height: 417 });
  expect(entries[0].bytes.length).toBeLessThan(highEntries[0].bytes.length);
});

test("PDF split bundle contains only selected standalone pages", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-split-pages", {
    pageOrder: "Even pages",
    batchNaming: "Page number only",
    bundle: "Maximum ZIP with manifest"
  }));
  const entries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), output.bytes);

  expect(entries.map((entry) => entry.name)).toEqual(["pages/page-002.pdf", "pages/page-004.pdf", "manifest.json"]);
  expect(entries[0].pdf).toMatchObject({ pageCount: 1 });
  expect(entries[0].pdf?.pages[0].text).toContain("Bravo page");
  expect(entries[1].pdf?.pages[0].text).toContain("Delta page");
  expect(JSON.parse(entries[2].text!)).toMatchObject({ selectedPages: [2, 4] });
});

test("PDF metadata report supports a compact document-info mode", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-metadata-report", {
    metadata: "Document info only",
    batchNaming: "Clean filename"
  }));
  const report = JSON.parse(output.text!);

  expect(output.name).toBe("Quarterly-Plan.json");
  expect(report).toMatchObject({ source: "Quarterly Plan ?.pdf", pages: 4 });
  expect(report.info.Title).toBe("Mixed fixture");
  expect(report.info.Author).toBe("Omni fixture");
  expect(report).not.toHaveProperty("metadata");
  expect(report).not.toHaveProperty("generatedAt");
});

test("PDF slide pack renders selected pages to exact slide geometry", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-slide-images", {
    pageOrder: "First 2 pages",
    aspectRatio: "4:3 classic slides",
    resolution: "1024 px wide",
    color: "Black letterbox",
    batchNaming: "Page number only",
    bundle: "Balanced ZIP with manifest"
  }));
  const entries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), output.bytes);

  expect(entries.map((entry) => entry.name)).toEqual(["slide/page-001.png", "slide/page-002.png", "manifest.json"]);
  expect(entries[0]).toMatchObject({ width: 1024, height: 768 });
  expect(entries[1]).toMatchObject({ width: 1024, height: 768 });
  expect(JSON.parse(entries[2].text!)).toMatchObject({ selectedPages: [1, 2], width: 1024, height: 768 });
});

test("PDF carousel pack renders selected square images and applies crop mode", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const results = await page.evaluate(async () => {
    const base = { pageOrder: "First 2 pages", aspectRatio: "1:1 square", resolution: "1080 px wide", batchNaming: "Page number only", bundle: "Balanced ZIP with manifest" };
    const [fit] = await window.__omniPdfHarness.runPdfRecipe("pdf-carousel-images", { ...base, crop: "Fit entire page" });
    const [fill] = await window.__omniPdfHarness.runPdfRecipe("pdf-carousel-images", { ...base, crop: "Fill target" });
    return { fit, fill };
  });
  const fitEntries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), results.fit.bytes);
  const fillEntries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), results.fill.bytes);

  expect(fillEntries.map((entry) => entry.name)).toEqual(["carousel/page-001.png", "carousel/page-002.png", "manifest.json"]);
  expect(fillEntries[0]).toMatchObject({ width: 1080, height: 1080 });
  expect(fillEntries[1]).toMatchObject({ width: 1080, height: 1080 });
  expect(JSON.parse(fillEntries[2].text!)).toMatchObject({ selectedPages: [1, 2], width: 1080, height: 1080 });
  expect(fillEntries[0].bytes).not.toEqual(fitEntries[0].bytes);
});

test("A4 handout paper size does not silently select four-up layout", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => {
    const settings = {
      pageOrder: "All pages",
      pageLayout: "2 pages per sheet",
      pageSize: "A4",
      margins: "Narrow",
      metadata: "Keep document details",
      batchNaming: "Handout suffix"
    };
    return window.__omniPdfHarness.runPdfRecipe("pdf-handout-pdf", settings as Parameters<typeof window.__omniPdfHarness.runPdfRecipe>[1]);
  });
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-handout.pdf");
  expect(facts.pageCount).toBe(2);
  expect(facts.pages).toEqual([
    expect.objectContaining({ width: 595.28, height: 841.89 }),
    expect.objectContaining({ width: 595.28, height: 841.89 })
  ]);
  expect(facts.title).toBe("Mixed fixture - handout");
  expect(facts.author).toBe("Omni fixture");
});

test("four-up handout layout, paper, margins, details, and naming are applied", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const result = await page.evaluate(async () => {
    const base = { pageOrder: "All pages", pageLayout: "4 pages per sheet", pageSize: "Letter", metadata: "Strip document details", batchNaming: "Clean filename" };
    const [narrow] = await window.__omniPdfHarness.runPdfRecipe("pdf-handout-pdf", { ...base, margins: "Narrow" });
    const [wide] = await window.__omniPdfHarness.runPdfRecipe("pdf-handout-pdf", { ...base, margins: "Wide" });
    return { narrow, wide };
  });
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), result.wide.bytes);
  const narrowBounds = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdfInkBounds(bytes), result.narrow.bytes);
  const wideBounds = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdfInkBounds(bytes), result.wide.bytes);

  expect(result.wide.name).toBe("Quarterly-Plan.pdf");
  expect(facts.pageCount).toBe(1);
  expect(facts.pages[0]).toMatchObject({ width: 612, height: 792 });
  expect(facts.title || "").toBe("");
  expect(facts.author || "").toBe("");
  expect(narrowBounds?.left).toBeLessThan(wideBounds!.left);
  expect(narrowBounds?.top).toBeLessThan(wideBounds!.top);
});

test("PDF to PPTX creates a validated text outline for selected pages", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-pptx-outline", {
    pageOrder: "Even pages",
    metadata: "Include source note",
    batchNaming: "Outline suffix",
    bundle: "Maximum compression"
  }));
  const entries = await page.evaluate((bytes) => window.__omniPdfHarness.inspectZip(bytes), output.bytes);
  const entry = (name: string) => entries.find((candidate) => candidate.name === name);

  expect(output.name).toBe("Quarterly-Plan-outline.pptx");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "pptx" });
  expect(entry("ppt/slides/slide1.xml")?.text).toContain("Page 2");
  expect(entry("ppt/slides/slide1.xml")?.text).toContain("Bravo page Fixture page 2");
  expect(entry("ppt/slides/slide1.xml")?.text).toContain('<p:ph type="title"');
  expect(entry("ppt/slides/slide1.xml")?.text).toContain('<p:ph type="body"');
  expect(entry("ppt/slides/slide2.xml")?.text).toContain("Page 4");
  expect(entry("ppt/slides/slide3.xml")).toBeUndefined();
  expect(entry("ppt/presentation.xml")?.text?.match(/<p:sldId\b/g)).toHaveLength(2);
  expect(entry("ppt/props/source.txt")?.text).toContain("Quarterly Plan ?.pdf");
  expect(entry("ppt/presProps.xml")?.text).toContain("<p:presentationPr");
  expect(entry("ppt/slideMasters/slideMaster1.xml")?.text).toContain("<p:sldMaster");
  expect(entry("ppt/slideLayouts/slideLayout1.xml")?.text).toContain("<p:sldLayout");
  expect(entry("ppt/slideLayouts/slideLayout1.xml")?.text).toContain('type="obj"');
  expect(entry("ppt/theme/theme1.xml")?.text).toContain("<a:theme");
  expect(entry("ppt/presentation.xml")?.text).toContain("<p:sldMasterIdLst>");
  expect(entry("ppt/slides/_rels/slide1.xml.rels")?.text).toContain("../slideLayouts/slideLayout1.xml");
  expect(entry("ppt/slideMasters/_rels/slideMaster1.xml.rels")?.text).toContain("../theme/theme1.xml");
});

test("lossless PDF optimization preserves pages, text, and selected details", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-compress", {
    compression: "Lossless structure rewrite",
    metadata: "Keep document details",
    batchNaming: "Optimized suffix"
  }));
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-optimized.pdf");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "pdf" });
  expect(facts).toMatchObject({ pageCount: 4, title: "Mixed fixture", author: "Omni fixture" });
  expect(facts.pages[0].text).toContain("Alpha page");
  expect(facts.pages[3].text).toContain("Delta page");
});

test("visual PDF compression exposes and applies its flattening tradeoff", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const result = await page.evaluate(async () => {
    const [balanced] = await window.__omniPdfHarness.runPdfRecipe("pdf-compress", {
      compression: "Balanced visual flattening (150 DPI)",
      metadata: "Strip document details",
      batchNaming: "Optimized suffix"
    });
    const [smallest] = await window.__omniPdfHarness.runPdfRecipe("pdf-compress", {
      compression: "Smallest visual flattening (96 DPI)",
      metadata: "Strip document details",
      batchNaming: "Optimized suffix"
    });
    return { balanced, smallest };
  });
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), result.smallest.bytes);

  expect(result.smallest.bytes.length).toBeLessThan(result.balanced.bytes.length);
  expect(facts.pageCount).toBe(4);
  expect(facts.pages.every((sourcePage) => sourcePage.text === "")).toBe(true);
  expect(facts.title || "").toBe("");
  expect(facts.author || "").toBe("");
});

test("PDF page extraction creates one ordered PDF from selected pages", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-extract-pages", {
    pageOrder: "Pages 3, 1",
    metadata: "Keep document details",
    batchNaming: "Extracted suffix"
  }));
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-extracted.pdf");
  expect(facts.pageCount).toBe(2);
  expect(facts.pages[0].text).toContain("Charlie page");
  expect(facts.pages[1].text).toContain("Alpha page");
  expect(facts.title).toBe("Mixed fixture - extracted pages");
});

test("PDF page reordering preserves every page in the chosen order", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => window.__omniPdfHarness.runPdfRecipe("pdf-reorder-pages", {
    pageOrder: "Odd pages, then even pages",
    metadata: "Keep document details",
    batchNaming: "Reordered suffix"
  }));
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-reordered.pdf");
  expect(facts.pageCount).toBe(4);
  expect(facts.pages.map((sourcePage) => sourcePage.text.split(" ")[0])).toEqual(["Alpha", "Charlie", "Bravo", "Delta"]);
  expect(facts.title).toBe("Mixed fixture - reordered");
});

test("PDF rotation changes only the selected pages", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");

  const [output] = await page.evaluate(() => {
    const settings = {
      pageOrder: "Odd pages",
      rotation: "90 degrees clockwise",
      metadata: "Keep document details",
      batchNaming: "Rotated suffix"
    };
    return window.__omniPdfHarness.runPdfRecipe("pdf-rotate-pages", settings as Parameters<typeof window.__omniPdfHarness.runPdfRecipe>[1]);
  });
  const facts = await page.evaluate((bytes) => window.__omniPdfHarness.inspectPdf(bytes), output.bytes);

  expect(output.name).toBe("Quarterly-Plan-rotated.pdf");
  expect(facts.pageCount).toBe(4);
  expect(facts.pages.map((sourcePage) => sourcePage.rotation)).toEqual([90, 0, 90, 90]);
  expect(facts.title).toBe("Mixed fixture - rotated");
});
