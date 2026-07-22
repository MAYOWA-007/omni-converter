import { expect, test } from "playwright/test";
import { createMultiSheetXlsxBytes } from "../fixtures/tabularFixtures";

test("XLSX exposes verified table conversions plus universal tools and completes a multi-sheet export", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Ledger.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(createMultiSheetXlsxBytes())
  });

  await expect(page.getByText("12 available conversions")).toBeVisible();
  await expect(page.getByText(/2 sheets/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Spreadsheet to CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spreadsheet to JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Spreadsheet to bar chart pack/i })).toBeVisible();

  await page.getByLabel("Search conversions").fill("all sheets csv");
  await expect(page.getByText("1 of 12 conversions")).toBeVisible();
  await page.getByRole("button", { name: "Spreadsheet to CSV" }).click();
  await expect(page.getByLabel("Sheets")).toHaveValue("All sheets");
  await expect(page.getByLabel("Sheets").locator("option")).toHaveText(["All sheets", "First sheet", "Sheet: Finance 2026", "Sheet: Notes & QA"]);
  await expect(page.getByLabel("Formula safety")).toHaveValue("Protect spreadsheet formulas");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Ledger-csv-sheets.zip")).toBeVisible();
});

test("legacy XLS stays specialist-gated while valid XML gets its safe structured route", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "legacy.xls",
    mimeType: "application/vnd.ms-excel",
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  });
  await expect(page.getByText("9 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Spreadsheet to CSV" })).toHaveCount(0);

  await page.getByRole("button", { name: "New file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "records.xml", mimeType: "application/xml", buffer: Buffer.from("<records/>") });
  await expect(page.getByText("17 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "XML to JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spreadsheet to JSON" })).toHaveCount(0);
});
