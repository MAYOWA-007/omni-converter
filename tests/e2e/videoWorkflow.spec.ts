import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("valid video exposes only verified video operations and corrupt video exposes none", async ({ page }) => {
  await page.goto("/");
  const video = readFileSync(resolve("tests/fixtures/video-tone.webm"));
  await page.locator('input[type="file"]').setInputFiles({ name: "Video Tone.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByText("5 available conversions")).toBeVisible();
  for (const title of ["Video to image frames", "Video thumbnail contact sheet", "Video to MP4", "Video to WebM", "Video to audio file"]) {
    await expect(page.locator(".recipe-card").filter({ has: page.getByText(title, { exact: true }) })).toBeVisible();
  }

  await page.locator(".recipe-card").filter({ has: page.getByText("Video to image frames", { exact: true }) }).click();
  await expect(page.locator("#control-frameInterval")).toHaveValue("Every 0.5 seconds");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Video-Tone-frames.zip")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.webm", mimeType: "video/webm", buffer: Buffer.from("not a video") });
  await expect(page.getByText("0 available conversions")).toBeVisible();
});
