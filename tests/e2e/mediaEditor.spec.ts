import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSineWavBytes } from "../fixtures/mediaFixtures";

test("video editor previews the source and drives exact trim settings from one timeline", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  const video = readFileSync(resolve("tests/fixtures/video-tone.mp4"));
  await page.locator('input[type="file"]').setInputFiles({ name: "Video Tone.mp4", mimeType: "video/mp4", buffer: video });
  await page.locator(".recipe-card").filter({ has: page.getByText("Video to MP4", { exact: true }) }).click();

  await expect(page.getByLabel("Source video preview")).toBeVisible();
  await expect(page.getByLabel("Media waveform")).toBeVisible();
  await expect(page.getByLabel("Trim start")).toHaveValue("0");
  await expect(page.getByLabel("Trim end")).toHaveValue(/1\.2/);

  await page.getByLabel("Trim start").fill("0.25");
  await page.getByLabel("Trim end").fill("0.75");
  await expect(page.locator("#control-trim")).toHaveValue("Custom range");
  await expect(page.getByTestId("trim-start-time")).toHaveText("0:00.250");
  await expect(page.getByTestId("trim-end-time")).toHaveText("0:00.750");
  await expect(page.getByTestId("trim-duration")).toHaveText("0:00.500");

  await expect.poll(() => page.getByLabel("Media waveform").evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    return Array.from(pixels).some((value, index) => index % 4 !== 3 && value > 0);
  })).toBe(true);

  await page.getByRole("button", { name: "Play selected range" }).click();
  await expect.poll(() => page.getByLabel("Source video preview").evaluate((media: HTMLVideoElement) => media.currentTime)).toBeGreaterThanOrEqual(0.24);
  if (process.env.OMNI_CAPTURE_MEDIA_EDITOR === "1") await page.screenshot({ path: "../.superpowers/sdd/media-editor-desktop.png" });
  await page.waitForTimeout(100);
  expect(consoleErrors.filter((message) => /empty string.*src|garbage collected without first being closed/i.test(message))).toEqual([]);
});

test("audio timeline and conversion controls remain contained on a phone viewport", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Tone.wav", mimeType: "audio/wav", buffer: Buffer.from(createSineWavBytes()) });
  await page.locator(".recipe-card").filter({ has: page.getByText("Audio to WAV", { exact: true }) }).click();

  await expect(page.getByLabel("Source audio preview")).toBeAttached();
  await expect(page.getByLabel("Audio source")).toBeVisible();
  await page.getByLabel("Trim end").fill("1.25");
  await expect(page.locator("#control-trim")).toHaveValue("Custom range");

  const containment = await page.evaluate(() => {
    const workbench = document.querySelector(".media-workbench")!.getBoundingClientRect();
    const convert = document.querySelector(".primary-action")!.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      workbench: { left: workbench.left, right: workbench.right, top: workbench.top, bottom: workbench.bottom },
      convert: { left: convert.left, right: convert.right, top: convert.top, bottom: convert.bottom }
    };
  });
  expect(containment.scrollWidth).toBeLessThanOrEqual(containment.width);
  expect(containment.workbench.left).toBeGreaterThanOrEqual(0);
  expect(containment.workbench.right).toBeLessThanOrEqual(390);
  expect(containment.workbench.bottom).toBeLessThanOrEqual(844);
  expect(containment.convert.left).toBeGreaterThanOrEqual(0);
  expect(containment.convert.right).toBeLessThanOrEqual(390);
  expect(containment.convert.bottom).toBeLessThanOrEqual(844);
  if (process.env.OMNI_CAPTURE_MEDIA_EDITOR === "1") await page.screenshot({ path: "../.superpowers/sdd/media-editor-mobile.png" });
  await page.waitForTimeout(100);
  expect(consoleErrors.filter((message) => /empty string.*src|garbage collected without first being closed/i.test(message))).toEqual([]);
});
