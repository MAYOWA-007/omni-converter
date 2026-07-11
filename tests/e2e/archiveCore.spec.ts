import { expect, test } from "playwright/test";
import { createCompressibleExeBytes } from "../fixtures/archiveFixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/archive-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("ZIP inspection reports real sizes, methods, ratios, checksums, and naming", async ({ page }) => {
  const [summary] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-inspect"));
  const value = JSON.parse(summary.text!);
  expect(summary.name).toBe("Project-Bundle-archive-report.json");
  expect(value.fileCount).toBe(7);
  expect(value.uncompressedBytes).toBeGreaterThan(0);
  expect(value.entries.find((entry: { name: string }) => entry.name === "media/photo.png")).toMatchObject({ method: 8 });

  const [checksums] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-inspect", { metadata: "File list + SHA-256", batchNaming: "Clean filename" }));
  expect(checksums.name).toBe("Project-Bundle.json");
  expect(JSON.parse(checksums.text!).entries.every((entry: { sha256: string }) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
});

test("ZIP extraction applies grouped and exact-file selections, manifests, compression, and naming", async ({ page }) => {
  const [images] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-extract", { compression: "Store ZIP" }));
  const imageEntries = await page.evaluate((bytes) => window.__omniArchiveHarness.unzip(bytes), images.bytes);
  expect(images.name).toBe("Project-Bundle-extracted.zip");
  expect(imageEntries.map((entry) => entry.name)).toEqual(["extracted/media/photo.png", "_omni/extraction-manifest.json"]);
  expect(imageEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);

  const [exact] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-extract", { archiveSelection: "Single file: docs/report.txt", metadata: "Files only", compression: "Maximum ZIP", batchNaming: "Clean filename" }));
  const exactEntries = await page.evaluate((bytes) => window.__omniArchiveHarness.unzip(bytes), exact.bytes);
  expect(exact.name).toBe("Project-Bundle.zip");
  expect(exactEntries.map((entry) => entry.name)).toEqual(["extracted/docs/report.txt"]);
  expect(exactEntries[0].text).toContain("Revenue: 42");
  expect(exactEntries[0].compressionMethod).toBe(8);
});

test("ZIP repack removes OS junk and resolves manifest collisions without losing files", async ({ page }) => {
  const [cleaned] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-repack-zip"));
  const entries = await page.evaluate((bytes) => window.__omniArchiveHarness.unzip(bytes), cleaned.bytes);
  expect(entries.map((entry) => entry.name)).not.toContain(".DS_Store");
  expect(entries.map((entry) => entry.name)).not.toContain("__MACOSX/._report");
  expect(entries.map((entry) => entry.name)).toContain("_omni/repack-manifest.json");
  expect(entries.map((entry) => entry.name)).toContain("_omni/repack-manifest-2.json");

  const [kept] = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("archive-repack-zip", { metadata: "Keep all + manifest", compression: "Store ZIP", batchNaming: "Clean filename" }));
  const keptEntries = await page.evaluate((bytes) => window.__omniArchiveHarness.unzip(bytes), kept.bytes);
  expect(kept.name).toBe("Project-Bundle.zip");
  expect(keptEntries.map((entry) => entry.name)).toContain(".DS_Store");
  expect(keptEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);
});

test("application compression preserves exact bytes and reports final size, ratio, checksum, naming, and level", async ({ page }) => {
  const stored = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("application-compress-zip", { compression: "Store ZIP", batchNaming: "Clean filename" }));
  const maximum = await page.evaluate(() => window.__omniArchiveHarness.runArchiveRecipe("application-compress-zip", { compression: "Maximum ZIP" }));
  const storedEntries = await page.evaluate((bytes) => window.__omniArchiveHarness.unzip(bytes), stored[0].bytes);
  const source = [...createCompressibleExeBytes()];

  expect(stored.map((output) => output.name)).toEqual(["Setup-Tool.zip", "Setup-Tool-compression-report.json"]);
  expect(storedEntries.map((entry) => entry.name)).toEqual(["original/Setup-Tool.exe", "manifest.json"]);
  expect(storedEntries[0].bytes).toEqual(source);
  expect(storedEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  const report = JSON.parse(stored[1].text!);
  expect(report.archiveBytes).toBe(stored[0].bytes.length);
  expect(report.archiveToOriginalRatio).toBeCloseTo(stored[0].bytes.length / source.length, 4);
  expect(report.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(maximum[0].bytes.length).toBeLessThan(stored[0].bytes.length);
});
