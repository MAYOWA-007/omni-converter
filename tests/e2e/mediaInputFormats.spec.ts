import { expect, test } from "playwright/test";

const formats = ["mp3", "ogg", "flac", "aac", "m4a"] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

for (const format of formats) {
  test(`${format.toUpperCase()} is parsed and converts through every promoted audio path`, async ({ page }) => {
    const inspection = await page.evaluate((value) => window.__omniMediaHarness.inspectFormat(value), format);
    expect(inspection).toMatchObject({ family: "audio", exactFormat: format });
    expect(inspection.duration).toBeGreaterThan(0.45);
    expect(inspection.audioChannels).toBe(1);

    const wav = await page.evaluate(({ recipeId, format: value }) => window.__omniMediaHarness.runMediaFormat(recipeId, value), { recipeId: "audio-to-wav", format });
    expect(wav.outputs).toHaveLength(1);
    expect(wav.outputs[0].name).toBe("Tone-converted.wav");
    expect(wav.outputs[0].validation).toMatchObject({ valid: true, detectedFormat: "wav" });

    const waveform = await page.evaluate(({ recipeId, format: value }) => window.__omniMediaHarness.runMediaFormat(recipeId, value), { recipeId: "audio-waveform", format });
    expect(waveform.outputs).toHaveLength(1);
    expect(waveform.outputs[0].name).toBe("Tone-waveform.svg");
    expect(waveform.outputs[0].validation.valid).toBe(true);

    const video = await page.evaluate(({ recipeId, format: value }) => window.__omniMediaHarness.runMediaFormat(recipeId, value), { recipeId: "audio-to-video", format });
    expect(video.outputs).toHaveLength(1);
    expect(video.outputs[0].name).toBe("Tone-converted.webm");
    expect(video.outputs[0].validation).toMatchObject({ valid: true, detectedFormat: "webm" });
  });
}
