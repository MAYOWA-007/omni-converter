import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/tabular-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("XLSX to CSV exports every sheet, safe formulas, Unicode, and a truthful manifest", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-csv"));
  const entries = await page.evaluate((bytes) => window.__omniTabularHarness.unzip(bytes), output.bytes);
  expect(entries.map((entry) => entry.name)).toEqual(["sheets/01-Finance-2026.csv", "sheets/02-Notes-QA.csv", "manifest.json"]);
  expect(entries[0].text).toContain("Zoë,7,'  @SUM(A1:A2),false");
  expect(entries[0].text).toContain("Alpha,2,'=2+2,true");
  expect(entries[1].text).toContain('Widget,"comma, and\nline"');
  expect(JSON.parse(entries[2].text).sheets).toEqual([
    { name: "Finance 2026", rows: 3, output: "sheets/01-Finance-2026.csv" },
    { name: "Notes & QA", rows: 2, output: "sheets/02-Notes-QA.csv" }
  ]);
});

test("single-sheet CSV can preserve exact formula text", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-csv", {
    sheetSelection: "First sheet",
    formulaSafety: "Preserve exact text"
  }));
  expect(output.name).toBe("Ledger.csv");
  expect(output.text).toContain("Alpha,2,=2+2,true");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "text" });

  const [namedSheet] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-csv", {
    sheetSelection: "Sheet: Notes & QA"
  }));
  expect(namedSheet.name).toBe("Ledger.csv");
  expect(namedSheet.text).toContain("Widget");
  expect(namedSheet.text).not.toContain("Alpha");
});

test("combined workbook JSON preserves sheet names and detected value types", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-json"));
  const value = JSON.parse(output.text!);
  expect(output.name).toBe("Ledger-workbook.json");
  expect(value.sheets["Finance 2026"][0]).toEqual({ name: "Alpha", count: 2, formula: "=2+2", active: true });
  expect(value.sheets["Finance 2026"][1].name).toBe("Zoë");
  expect(value.sheets["Notes & QA"][0].note).toBe("comma, and\nline");
});

test("quoted CSV to JSON Lines infers unambiguous types and preserves leading zeros", async ({ page }) => {
  const [output] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("data-json-csv"));
  const records = output.text!.split("\n").map((line) => JSON.parse(line));
  expect(records).toEqual([
    { name: "Zoë", count: 7, active: true, note: "comma, and\nline", formula: "=2+2" },
    { name: "Alpha", count: "007", active: false, note: "plain", formula: "@command" }
  ]);
  expect(output.validation).toEqual({ valid: true, detectedFormat: "jsonl" });
});

test("XLSX delimited format and ZIP level controls change entries and compression", async ({ page }) => {
  const [stored] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-csv", {
    outputFormat: "TSV",
    bundle: "Store ZIP"
  }));
  const [maximum] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-csv", {
    outputFormat: "TSV",
    bundle: "Maximum ZIP with manifest"
  }));
  const storedEntries = await page.evaluate((bytes) => window.__omniTabularHarness.unzip(bytes), stored.bytes);
  const maximumEntries = await page.evaluate((bytes) => window.__omniTabularHarness.unzip(bytes), maximum.bytes);

  expect(stored.name).toBe("Ledger-tsv-sheets.zip");
  expect(storedEntries.map((entry) => entry.name)).toEqual(["sheets/01-Finance-2026.tsv", "sheets/02-Notes-QA.tsv"]);
  expect(storedEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(maximumEntries.map((entry) => entry.name)).toContain("manifest.json");
  expect(maximumEntries.every((entry) => entry.compressionMethod === 8)).toBe(true);
  expect(storedEntries[0].text).toContain("name\tcount\tformula\tactive");
});

test("XLSX JSON modes apply row shape, headers, value types, sheet selection, and ZIP mode", async ({ page }) => {
  const [lines] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-json", {
    outputFormat: "JSON Lines by sheet",
    headerMode: "No header row",
    dataTypes: "Convert all values to text",
    bundle: "Store ZIP"
  }));
  const lineEntries = await page.evaluate((bytes) => window.__omniTabularHarness.unzip(bytes), lines.bytes);
  expect(lineEntries.map((entry) => entry.name)).toEqual(["sheets/01-Finance-2026.jsonl", "sheets/02-Notes-QA.jsonl"]);
  expect(lineEntries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(JSON.parse(lineEntries[0].text.split("\n")[0])).toEqual({ column_1: "name", column_2: "count", column_3: "formula", column_4: "active" });
  expect(JSON.parse(lineEntries[0].text.split("\n")[1]).count).toBeUndefined();
  expect(JSON.parse(lineEntries[0].text.split("\n")[1]).column_2).toBe("2");

  const [rows] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("spreadsheet-to-json", {
    outputFormat: "JSON rows by sheet",
    sheetSelection: "First sheet"
  }));
  expect(rows.name).toBe("Ledger.json");
  const value = JSON.parse(rows.text!);
  expect(value[0]).toEqual(["name", "count", "formula", "active"]);
  expect(value[1]).toEqual(["Alpha", 2, "=2+2", true]);
});

test("structured data exposes only real output formats and applies headers, naming, and formula safety", async ({ page }) => {
  const cases = [
    ["JSON objects", "json"],
    ["JSON rows", "json"],
    ["JSON Lines", "jsonl"],
    ["CSV", "csv"],
    ["TSV", "tsv"],
    ["Markdown table", "md"]
  ] as const;
  for (const [outputFormat, extension] of cases) {
    const [output] = await page.evaluate(({ outputFormat }) => window.__omniTabularHarness.runTabularRecipe("data-json-csv", { outputFormat }), { outputFormat });
    expect(output.name.endsWith(`.${extension}`), outputFormat).toBe(true);
    expect(output.validation.valid, outputFormat).toBe(true);
  }

  const [safe] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("data-json-csv", { outputFormat: "CSV" }));
  const [exact] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("data-json-csv", { outputFormat: "CSV", formulaSafety: "Preserve exact text" }));
  expect(safe.text).toContain(",'=2+2");
  expect(safe.text).toContain(",'@command");
  expect(exact.text).toContain(",=2+2");

  const [renamed] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("data-json-csv", { outputFormat: "JSON objects", batchNaming: "Format suffix" }));
  expect(renamed.name).toBe("quoted-data-converted-to-json.json");
  const [headerless] = await page.evaluate(() => window.__omniTabularHarness.runTabularRecipe("data-json-csv", { outputFormat: "JSON objects", headerMode: "No header row", dataTypes: "Convert all values to text" }));
  expect(JSON.parse(headerless.text!)[0]).toEqual({ column_1: "name", column_2: "count", column_3: "active", column_4: "note", column_5: "formula" });
});
