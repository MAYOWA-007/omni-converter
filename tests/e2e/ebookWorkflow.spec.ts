import { expect, test } from "playwright/test";
import { createSpineEpubBytes } from "../fixtures/ebookFixtures";

test("EPUB exposes its verified conversion while MOBI remains specialist-gated with universal tools", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Spine Order.epub", mimeType: "application/epub+zip", buffer: Buffer.from(createSpineEpubBytes()) });
  await expect(page.getByText("10 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "EPUB to readable chapters" })).toBeVisible();
  await page.getByRole("button", { name: "EPUB to readable chapters" }).click();
  await expect(page.locator("#control-outputFormat")).toHaveValue("Markdown");
  await page.locator("#control-outputFormat").selectOption("Text ZIP by chapter");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Spine-Order-chapters-text.zip")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "legacy.mobi", mimeType: "application/x-mobipocket-ebook", buffer: Buffer.from("BOOKMOBI") });
  await expect(page.getByText("9 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "EPUB to readable chapters" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create checksum manifest" })).toBeVisible();
});
