import { expect, test } from "playwright/test";

test.describe.configure({ timeout: 120_000 });

test("PDF upload exposes the verified catalog, searchable outputs, dynamic pages, and a validated result", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/pdf-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  const bytes = await page.evaluate(() => window.__omniPdfHarness.fixtureBytes());

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Quarterly Plan ?.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes)
  });

  await expect(page.getByText("25 available conversions")).toBeVisible();
  await expect(page.getByText("4 pages")).toBeVisible();
  await page.getByLabel("Search conversions").fill("rotate");
  await expect(page.getByRole("button", { name: "Rotate PDF pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF to plain text" })).toHaveCount(0);

  await page.getByLabel("Search conversions").fill("extract pages");
  await page.getByRole("button", { name: "Extract selected pages" }).click();
  const pages = page.getByLabel("Pages");
  await expect(pages.locator('option[value="Page 2"]')).toHaveCount(1);
  await expect(pages.locator('option[value="Pages 2-4"]')).toHaveCount(1);
  await pages.selectOption("Pages 2-4");
  await page.getByRole("button", { name: "Convert" }).click();

  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("Quarterly-Plan-extracted.pdf")).toBeVisible();
  await expect(page.getByText(/PDF \/ .* \/ Validated/)).toBeVisible();
});
