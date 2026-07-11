import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("every promoted audio engine honors precise start and end bounds", async ({ page }) => {
  const trim = { trim: "Custom range", trimStart: 0.5, trimEnd: 1.25 };

  const wav = await page.evaluate((settings) => window.__omniMediaHarness.runMediaRecipe("audio-to-wav", settings), trim);
  const wavFacts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), wav.outputs[0]);
  expect(wavFacts.duration).toBeCloseTo(0.75, 1);

  const waveform = await page.evaluate((settings) => window.__omniMediaHarness.runMediaRecipe("audio-waveform", { ...settings, outputFormat: "Peaks JSON" }), trim);
  expect(JSON.parse(waveform.outputs[0].text!).duration).toBeCloseTo(0.75, 2);

  const video = await page.evaluate((settings) => window.__omniMediaHarness.runMediaRecipe("audio-to-video", { ...settings, outputFormat: "WebM" }), trim);
  const videoFacts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), video.outputs[0]);
  expect(videoFacts.duration).toBeCloseTo(0.75, 1);
});

test("every promoted video engine honors precise start and end bounds", async ({ page }) => {
  const trim = { trim: "Custom range", trimStart: 0.25, trimEnd: 0.75 };

  const frames = await page.evaluate((settings) => window.__omniMediaHarness.runVideoFixture("video-to-frames", "video-mp4", {
    ...settings,
    outputFormat: "PNG",
    frameInterval: "Every 0.5 seconds",
    resolution: "80 px wide",
    metadata: "Include manifest",
    batchNaming: "Timestamp names",
    bundle: "Store ZIP"
  }), trim);
  const entries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), frames.outputs[0].bytes);
  expect(entries.map((entry) => entry.name)).toEqual(["frames/Video-Tone-00-00-000.png", "manifest.json"]);
  expect(JSON.parse(entries[1].text).frames[0].timestamp).toBe(0);

  const fullSheet = await page.evaluate(() => window.__omniMediaHarness.runVideoFixture("video-thumbnail-sheet", "video-mp4", { outputFormat: "PNG" }));
  const trimmedSheet = await page.evaluate((settings) => window.__omniMediaHarness.runVideoFixture("video-thumbnail-sheet", "video-mp4", { ...settings, outputFormat: "PNG" }), trim);
  expect(trimmedSheet.outputs[0].bytes).not.toEqual(fullSheet.outputs[0].bytes);

  for (const recipeId of ["video-to-mp4", "video-to-webm", "video-to-audio"] as const) {
    const result = await page.evaluate(({ id, settings }) => window.__omniMediaHarness.runVideoFixture(id, "video-mp4", settings), { id: recipeId, settings: trim });
    const facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), result.outputs[0]);
    expect(facts.duration, recipeId).toBeGreaterThanOrEqual(0.45);
    expect(facts.duration, recipeId).toBeLessThanOrEqual(0.6);
  }
});
