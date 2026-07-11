import { expect, test } from "playwright/test";
import { createNotesPptxBytes, createSemanticDocxBytes } from "../fixtures/officeFixtures";

test("DOCX and PPTX uploads expose only verified semantic conversions", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Quarterly Plan.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(createSemanticDocxBytes()) });
  await expect(page.getByText("3 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "DOCX to Markdown" })).toBeVisible();
  await page.getByRole("button", { name: "DOCX to Markdown" }).click();
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Quarterly-Plan-converted.md")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "Launch Brief.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: Buffer.from(createNotesPptxBytes()) });
  await expect(page.getByText("2 available conversions")).toBeVisible();
  await expect(page.getByText(/2 slides/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Presentation slide rendering" })).toHaveCount(0);
  await page.getByRole("button", { name: "Presentation to notes text" }).click();
  await expect(page.getByLabel("Slides").locator("option")).toHaveText(["All slides", "First slide", "Last slide", "Odd slides", "Even slides", "Reverse order", "Slide 1", "Slide 2", "Slides 1-2"]);
});

test("legacy DOC and PPT files do not inherit DOCX or PPTX routes", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "legacy.doc", mimeType: "application/msword", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) });
  await expect(page.getByText("0 available conversions")).toBeVisible();
  await page.getByRole("button", { name: "New file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "legacy.ppt", mimeType: "application/vnd.ms-powerpoint", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) });
  await expect(page.getByText("0 available conversions")).toBeVisible();
});
