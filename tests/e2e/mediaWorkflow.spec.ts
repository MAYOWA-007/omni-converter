import { expect, test } from "playwright/test";
import { createSineWavBytes } from "../fixtures/mediaFixtures";

test("valid audio exposes verified audio conversions and corrupt media falls back to universal tools", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Tone.wav", mimeType: "audio/wav", buffer: Buffer.from(createSineWavBytes()) });
  await expect(page.getByText("37 available conversions")).toBeVisible();
  await expect(page.locator(".recipe-card")).toHaveCount(37);
  if (process.env.OMNI_CAPTURE_WAV_CATALOG === "1") await page.screenshot({ path: "../.superpowers/sdd/wav-catalog-desktop.png" });
  const wavCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to WAV", { exact: true }) });
  const waveformCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to waveform assets", { exact: true }) });
  const videoCard = page.locator(".recipe-card").filter({ has: page.getByText("Audio to video", { exact: true }) });
  await expect(wavCard).toBeVisible();
  await expect(waveformCard).toBeVisible();
  await expect(videoCard).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search conversions" });
  await search.fill("mp3");
  await expect(page.locator(".recipe-card")).toHaveCount(2);
  await expect(page.getByText("Audio to MP3", { exact: true })).toBeVisible();
  await expect(page.getByText("All audio formats", { exact: true })).toBeVisible();
  await search.fill("dolby");
  await expect(page.getByText("Audio to AC-3", { exact: true })).toBeVisible();
  await expect(page.getByText("Audio to E-AC-3", { exact: true })).toBeVisible();
  await expect(page.getByText("Audio to MKA", { exact: true })).toBeVisible();
  await search.fill("");
  await wavCard.click();
  await expect(page.locator("#control-sampleRate")).toHaveValue("Source sample rate");
  await expect(page.locator("#control-audioChannels")).toHaveValue("Source channels");
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText("Tone-converted.wav")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("not an audio file") });
  await expect(page.getByText("9 available conversions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Audio to MP3" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create checksum manifest" })).toBeVisible();
});

test("the expanded WAV catalog remains searchable and contained on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "Tone.wav", mimeType: "audio/wav", buffer: Buffer.from(createSineWavBytes()) });
  await expect(page.getByText("37 available conversions")).toBeVisible();
  if (process.env.OMNI_CAPTURE_WAV_CATALOG === "1") await page.screenshot({ path: "../.superpowers/sdd/wav-catalog-mobile.png" });

  const search = page.getByRole("textbox", { name: "Search conversions" });
  await search.fill("apple lossless");
  await expect(page.getByText("Audio to ALAC", { exact: true })).toBeVisible();
  await expect(page.locator(".recipe-card")).toHaveCount(2);

  const geometry = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    pageWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    search: document.querySelector<HTMLInputElement>('input[aria-label="Search conversions"]')?.getBoundingClientRect().toJSON(),
    card: document.querySelector<HTMLElement>(".recipe-card")?.getBoundingClientRect().toJSON()
  }));
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.pageHeight).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.search?.left).toBeGreaterThanOrEqual(0);
  expect(geometry.search?.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.card?.left).toBeGreaterThanOrEqual(0);
  expect(geometry.card?.right).toBeLessThanOrEqual(geometry.viewportWidth);
});
