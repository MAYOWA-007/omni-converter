import { expect, test } from "playwright/test";
import { sheetSelectionOptionsForWorkbook } from "../../src/lib/tabularOptions";

test("adds every detected worksheet to the existing selection menu without duplicates", () => {
  expect(sheetSelectionOptionsForWorkbook(["All sheets", "First sheet"], ["Finance 2026", "Notes & QA"])).toEqual([
    "All sheets",
    "First sheet",
    "Sheet: Finance 2026",
    "Sheet: Notes & QA"
  ]);
  expect(sheetSelectionOptionsForWorkbook(["All sheets", "Sheet: Finance 2026"], ["Finance 2026"])).toEqual(["All sheets", "Sheet: Finance 2026"]);
});
