import { expect, test } from "playwright/test";
import { FORMAT_UNIVERSE, findFormatByExtension, findFormatByMime, type FormatSupportTier } from "../../src/core/formatUniverse";
import type { FileFamily } from "../../src/lib/types";

const SUPPORT_TIERS: FormatSupportTier[] = ["browser", "desktop", "inspect-only", "blocked"];
const FILE_FAMILIES: FileFamily[] = [
  "image", "video", "audio", "pdf", "document", "spreadsheet", "presentation", "archive",
  "data", "code", "font", "model3d", "ebook", "application", "unknown"
];

test("defines at least 180 named formats and 100 normalized extensions", () => {
  const extensions = FORMAT_UNIVERSE.flatMap((format) => format.extensions);

  expect(FORMAT_UNIVERSE.length).toBeGreaterThanOrEqual(180);
  expect(new Set(extensions).size).toBeGreaterThanOrEqual(100);
  for (const format of FORMAT_UNIVERSE) {
    expect(format.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(format.label.trim().length).toBeGreaterThan(1);
  }
});

test("keeps format IDs and normalized extensions globally unique", () => {
  const ids = FORMAT_UNIVERSE.map((format) => format.id);
  const extensions = FORMAT_UNIVERSE.flatMap((format) => format.extensions);

  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(extensions).size).toBe(extensions.length);
  expect(extensions).toEqual(extensions.map((extension) => extension.toLowerCase().replace(/^\./, "")));
});

test("gives every format a family, support tier, and concise reason", () => {
  for (const format of FORMAT_UNIVERSE) {
    expect(FILE_FAMILIES).toContain(format.family);
    expect(SUPPORT_TIERS).toContain(format.supportTier);
    expect(format.supportReason.trim().length).toBeGreaterThan(8);
    expect(format.supportReason.length).toBeLessThanOrEqual(140);
  }
});

test("represents every current product family", () => {
  const representedFamilies = new Set(FORMAT_UNIVERSE.map((format) => format.family));

  expect([...representedFamilies].sort()).toEqual([...FILE_FAMILIES].sort());
});

test("normalizes extension lookup without accepting duplicate aliases", () => {
  expect(findFormatByExtension(".JPG")?.id).toBe("jpeg");
  expect(findFormatByExtension("  DOCX ")?.family).toBe("document");
  expect(findFormatByExtension("not-a-real-format")).toBeUndefined();
});

test("preserves verified audio-container family mappings", () => {
  for (const extension of ["mka", "asf", "3gp"]) {
    expect(findFormatByExtension(extension)?.family, extension).toBe("audio");
  }
});

test("does not invent an exact format from an ambiguous MIME alias", () => {
  expect(findFormatByMime("audio/mpeg")).toBeUndefined();
  expect(findFormatByMime("FONT/WOFF2; charset=binary")?.id).toBe("woff2");
});

test("uses browser tiers only for fixture-verified image directions", () => {
  const expected = {
    png: ["browser", /reader and writer/i],
    jpeg: ["browser", /reader and writer/i],
    gif: ["browser", /reader only/i],
    webp: ["browser", /reader and writer/i],
    bmp: ["browser", /reader and writer/i],
    svg: ["browser", /writer only/i],
    avif: ["desktop", /no verified browser/i],
    ico: ["inspect-only", /no verified browser reader or writer/i]
  } as const;

  for (const [id, [tier, reason]] of Object.entries(expected)) {
    const format = FORMAT_UNIVERSE.find((entry) => entry.id === id);
    expect(format?.supportTier, id).toBe(tier);
    expect(format?.supportReason, id).toMatch(reason);
  }
});

test("marks verified video and ebook paths with their exact directions", () => {
  for (const id of ["mp4", "webm"]) {
    const format = FORMAT_UNIVERSE.find((entry) => entry.id === id);
    expect(format?.supportTier, id).toBe("browser");
    expect(format?.supportReason, id).toMatch(/reader and writer/i);
  }

  const epub = FORMAT_UNIVERSE.find((entry) => entry.id === "epub");
  expect(epub?.supportTier).toBe("browser");
  expect(epub?.supportReason).toMatch(/reader only/i);
});

test("reflects verified structured-data reader and writer directions", () => {
  const expected = {
    json: /reader and writer/i,
    jsonl: /reader and writer/i,
    ndjson: /reader only/i,
    tsv: /reader and writer/i
  } as const;

  for (const [id, reason] of Object.entries(expected)) {
    const format = FORMAT_UNIVERSE.find((entry) => entry.id === id);
    expect(format?.supportTier, id).toBe("browser");
    expect(format?.supportReason, id).toMatch(reason);
  }
});

test("describes every browser tier as a verified reader or writer direction", () => {
  for (const format of FORMAT_UNIVERSE.filter((entry) => entry.supportTier === "browser")) {
    expect(format.supportReason, format.id).toMatch(/reader|writer/i);
  }
});
