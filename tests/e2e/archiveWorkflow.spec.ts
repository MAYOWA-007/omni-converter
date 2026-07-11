import { expect, test } from "playwright/test";
import { createCompressibleExeBytes, createMixedZipBytes } from "../fixtures/archiveFixtures";

test("ZIP upload exposes inspected entries and only verified archive operations", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Project Bundle.zip", mimeType: "application/zip", buffer: Buffer.from(createMixedZipBytes()) });
  await expect(page.getByText("3 available conversions")).toBeVisible();
  await expect(page.getByText(/7 files/)).toBeVisible();
  await page.getByRole("button", { name: "Create extracted file bundle" }).click();
  const files = page.locator("#control-archiveSelection");
  await expect.poll(() => files.locator("option").allTextContents()).toEqual(expect.arrayContaining(["All files", "Top-level files", "Documents", "Images", "Audio and video", "Single file: top.txt"]));
  await files.selectOption("Single file: media/photo.png");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Project-Bundle-extracted.zip")).toBeVisible();
});

test("EXE and ZIP-based APK files use the application compression surface while RAR stays unavailable", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Setup Tool.exe", mimeType: "application/vnd.microsoft.portable-executable", buffer: Buffer.from(createCompressibleExeBytes()) });
  await expect(page.getByText("1 available conversion")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compress application or binary" })).toBeVisible();

  await page.getByRole("button", { name: "New file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "Demo.apk", mimeType: "application/vnd.android.package-archive", buffer: Buffer.from(createMixedZipBytes()) });
  await expect(page.getByText("1 available conversion")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compress application or binary" })).toBeVisible();

  await page.getByRole("button", { name: "New file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "legacy.rar", mimeType: "application/vnd.rar", buffer: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]) });
  await expect(page.getByText("0 available conversions")).toBeVisible();
});
