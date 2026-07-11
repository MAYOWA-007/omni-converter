import { expect, test } from "playwright/test";
import { createSineWavBytes } from "../fixtures/mediaFixtures";

test("valid audio exposes only verified audio conversions and corrupt media exposes none", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Tone.wav", mimeType: "audio/wav", buffer: Buffer.from(createSineWavBytes()) });
  await expect(page.getByText("3 available conversions")).toBeVisible();
  const wavCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to WAV", { exact: true }) });
  const waveformCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to waveform assets", { exact: true }) });
  const videoCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to video", { exact: true }) });
  await expect(wavCard).toBeVisible();
  await expect(waveformCard).toBeVisible();
  await expect(videoCard).toBeVisible();
  await wavCard.click();
  await expect(page.locator("#control-sampleRate")).toHaveValue("Source sample rate");
  await expect(page.locator("#control-audioChannels")).toHaveValue("Source channels");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Tone-converted.wav")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("not an audio file") });
  await expect(page.getByText("0 available conversions")).toBeVisible();
});
