import { expect, test } from "playwright/test";
import type { ConversionSettings } from "../../src/lib/types";

type StructuredFixtureId = "json" | "jsonl" | "ndjson" | "tsv";

interface StructuredFixtureOutput {
  name: string;
  type: string;
  text?: string;
  validation: { valid: boolean; detectedFormat: string };
}

async function runFixture(page: import("playwright/test").Page, fixtureId: StructuredFixtureId, settings: ConversionSettings) {
  return page.evaluate(async ({ id, overrides }) => {
    const harness = (window as unknown as {
      __omniTabularHarness: {
        runStructuredInputFixture(fixtureId: StructuredFixtureId, settings: ConversionSettings): Promise<StructuredFixtureOutput[]>;
      };
    }).__omniTabularHarness;
    return harness.runStructuredInputFixture(id, overrides);
  }, { id: fixtureId, overrides: settings });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/tabular-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("JSON input converts parsed records to validated TSV", async ({ page }) => {
  const [output] = await runFixture(page, "json", { outputFormat: "TSV" });
  expect(output.name).toBe("records-json.tsv");
  expect(output.type).toContain("text/tab-separated-values");
  expect(output.text).toBe("name\tcount\tactive\nAlpha\t2\ttrue\nBeta\t7\tfalse");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "text" });
});

test("JSONL input converts union-key records to validated JSON objects", async ({ page }) => {
  const [output] = await runFixture(page, "jsonl", { outputFormat: "JSON objects" });
  expect(JSON.parse(output.text!)).toEqual([
    { name: "Alpha", count: 2, active: null },
    { name: "Beta", count: null, active: true }
  ]);
  expect(output.validation).toEqual({ valid: true, detectedFormat: "json" });
});

test("NDJSON input uses the JSON Lines parser and emits validated CSV", async ({ page }) => {
  const [output] = await runFixture(page, "ndjson", { outputFormat: "CSV" });
  expect(output.name).toBe("records-ndjson.csv");
  expect(output.text).toBe("sku,price,available\nA-1,12.5,true\nB-2,8,false");
  expect(output.validation).toEqual({ valid: true, detectedFormat: "text" });
});

test("TSV input preserves quoted tabs and lines in validated JSON Lines output", async ({ page }) => {
  const [output] = await runFixture(page, "tsv", { outputFormat: "JSON Lines" });
  expect(output.name).toBe("records-tsv.jsonl");
  expect(output.text!.split("\n").map((line) => JSON.parse(line))).toEqual([
    { name: "Alpha", note: "tab\tinside", formula: "=2+2" },
    { name: "Beta", note: "line one\nline two", formula: "plain" }
  ]);
  expect(output.validation).toEqual({ valid: true, detectedFormat: "jsonl" });
});
