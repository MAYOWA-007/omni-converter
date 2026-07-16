import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

const cases = [
  ["audio-to-wav", "wav"],
  ["audio-to-mp3", "mp3"],
  ["audio-to-flac", "flac"],
  ["audio-to-m4a", "m4a"],
  ["audio-to-aac", "aac"],
  ["audio-to-ogg", "ogg"],
  ["audio-to-opus", "opus"],
  ["audio-to-webm", "webm"],
  ["audio-to-mka", "mka"],
  ["audio-to-mov", "mov"],
  ["audio-to-m4r", "m4r"],
  ["audio-to-aiff", "aiff"],
  ["audio-to-caf", "caf"],
  ["audio-to-ac3", "ac3"],
  ["audio-to-eac3", "eac3"],
  ["audio-to-vorbis", "oga"],
  ["audio-to-wma", "wma"],
  ["audio-to-wavpack", "wv"],
  ["audio-to-tta", "tta"],
  ["audio-to-mp2", "mp2"],
  ["audio-to-au", "au"],
  ["audio-to-wave64", "w64"],
  ["audio-to-3gp", "3gp"]
] as const;

test("every generated audio container re-enters the full catalog and converts to MP3", async ({ page }) => {
  test.setTimeout(300_000);
  for (const [sourceRecipeId, exactFormat] of cases) {
    const result = await page.evaluate(
      ({ source }) => window.__omniMediaHarness.roundTripAudioRecipe(source, "audio-to-mp3"),
      { source: sourceRecipeId }
    );

    expect(result.source.validation.valid, sourceRecipeId).toBe(true);
    expect(result.inspection.family, sourceRecipeId).toBe("audio");
    expect(result.inspection.exactFormat, sourceRecipeId).toBe(exactFormat);
    expect(result.inspection.duration, sourceRecipeId).toBeGreaterThan(0.45);
    expect(result.availableRecipeIds, sourceRecipeId).toContain("audio-to-mp3");
    expect(result.target.validation, sourceRecipeId).toMatchObject({ valid: true, detectedFormat: "mp3" });
  }
});

test("a generated legacy container converts through waveform and audio-to-video derivatives", async ({ page }) => {
  test.setTimeout(180_000);
  const waveform = await page.evaluate(() => window.__omniMediaHarness.roundTripAudioRecipe("audio-to-aiff", "audio-waveform"));
  expect(waveform.target.validation).toMatchObject({ valid: true, detectedFormat: "svg" });

  const video = await page.evaluate(() => window.__omniMediaHarness.roundTripAudioRecipe("audio-to-aiff", "audio-to-video"));
  expect(video.target.validation).toMatchObject({ valid: true, detectedFormat: "webm" });
});

const externalAudioFixtures = [
  "wav", "mp3", "flac", "m4a", "aac", "ogg", "opus", "audio-webm", "mka", "mka-ac3", "audio-mov", "m4r",
  "aiff", "caf", "ac3", "eac3", "oga", "wma", "wv", "tta", "mp2", "au", "w64", "3gp"
] as const;

const externalVideoFixtures = ["mov", "m4v", "mkv", "ts"] as const;

for (const fixtureId of externalAudioFixtures) {
  test(`${fixtureId} external fixture executes and reopens through canonical WAV`, async ({ page }) => {
    test.setTimeout(120_000);
    const result = await page.evaluate((id) => window.__omniMediaHarness.verifyExpandedMediaFixture(id), fixtureId);

    expect(result.inspection).toMatchObject({ family: "audio", exactFormat: result.expected.exactFormat });
    expect(result.inspection.duration).toBeGreaterThan(0.4);
    expect(result.inspection.notes.join(" ")).toMatch(/Decode path: (browser|FFmpeg WASM)\./);
    expect(result.availableRecipeIds).toContain("audio-to-wav");
    expect(result.output.validation).toMatchObject({ valid: true, detectedFormat: "wav" });
    expect(result.output.inspection).toMatchObject({ family: "audio", exactFormat: "wav" });
    expect(result.output.nativeSupport).toMatchObject({ containerReadable: true, audioDecodable: true });
  });
}

for (const fixtureId of externalVideoFixtures) {
  test(`${fixtureId} external fixture executes and reopens through canonical MP4`, async ({ page }) => {
    test.setTimeout(120_000);
    const result = await page.evaluate((id) => window.__omniMediaHarness.verifyExpandedMediaFixture(id), fixtureId);

    expect(result.sourceSupport).toMatchObject({ containerReadable: true, audioDecodable: true, videoDecodable: true });
    expect(result.inspection).toMatchObject({ family: "video", exactFormat: result.expected.exactFormat });
    expect(result.inspection.duration).toBeGreaterThan(0.6);
    expect(result.inspection.notes.join(" ")).toContain("Decode path: browser.");
    expect(result.availableRecipeIds).toContain("video-to-mp4");
    expect(result.output.validation).toMatchObject({ valid: true, detectedFormat: "mp4" });
    expect(result.output.inspection).toMatchObject({ family: "video", exactFormat: "mp4" });
    expect(result.output.nativeSupport).toMatchObject({ containerReadable: true, audioDecodable: true, videoDecodable: true });
  });
}

test("FFmpeg inspection honors a pre-aborted signal before loading WASM", async ({ page }) => {
  const result = await page.evaluate(() => window.__omniMediaHarness.cancelFfmpegAudioInspection());

  expect(result).toEqual({ canceled: true, error: "AbortError" });
});
