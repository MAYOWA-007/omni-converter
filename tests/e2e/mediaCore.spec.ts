import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("media inspection identifies the actual WAV container and audio facts", async ({ page }) => {
  const inspection = await page.evaluate(() => window.__omniMediaHarness.inspectFixture("renamed.mp3", "audio/mpeg"));
  expect(inspection).toMatchObject({ family: "audio", exactFormat: "wav", duration: 2, sampleRate: 8000, audioChannels: 1, audioCodec: "pcm-s16", mediaTargets: { mp4: true, webm: true } });
  expect(inspection.notes.join(" ")).toMatch(/does not match|wav/i);
});

test("WAV export applies trim, sample rate, channel, bit-depth, metadata, and naming controls", async ({ page }) => {
  const source = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-wav"));
  const sourceFacts = await page.evaluate((bytes) => window.__omniMediaHarness.inspectWav(bytes), source.outputs[0].bytes);
  expect(source.outputs[0].name).toBe("Tone-converted.wav");
  expect(sourceFacts).toMatchObject({ riff: "RIFF", wave: "WAVE", channels: 1, sampleRate: 8000, bitsPerSample: 16 });

  const converted = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-wav", {
    trim: "First 1 second",
    sampleRate: "48 kHz",
    audioChannels: "Stereo",
    bitDepth: "24-bit PCM",
    metadata: "Strip tags",
    batchNaming: "Clean filename"
  }));
  const convertedFacts = await page.evaluate((bytes) => window.__omniMediaHarness.inspectWav(bytes), converted.outputs[0].bytes);
  expect(converted.outputs[0].name).toBe("Tone.wav");
  expect(convertedFacts).toMatchObject({ channels: 2, sampleRate: 48000, bitsPerSample: 24 });
  expect(convertedFacts.dataBytes).toBeGreaterThan(280_000);
  expect(convertedFacts.dataBytes).toBeLessThan(300_000);
});

test("waveform exports provide real SVG, PNG, peaks JSON, and compressed bundles", async ({ page }) => {
  const svg = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-waveform"));
  expect(svg.outputs[0].name).toBe("Tone-waveform.svg");
  expect(svg.outputs[0].text).toContain('viewBox="0 0 1200 400"');
  expect(svg.outputs[0].text).toContain("#d7b76d");

  const png = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-waveform", { outputFormat: "PNG waveform", resolution: "1920 x 640", color: "Emerald on cream", batchNaming: "Clean filename" }));
  expect(png.outputs[0].name).toBe("Tone.png");
  expect(png.outputs[0].bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  const json = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-waveform", { outputFormat: "Peaks JSON", trim: "First 1 second" }));
  const peaks = JSON.parse(json.outputs[0].text!);
  expect(peaks.duration).toBeCloseTo(1, 1);
  expect(peaks.peaks).toHaveLength(1200);
  expect(Math.max(...peaks.peaks)).toBeGreaterThan(0.45);

  const stored = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-waveform", { outputFormat: "Waveform ZIP", bundle: "Store ZIP" }));
  const entries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), stored.outputs[0].bytes);
  expect(entries.map((entry) => entry.name)).toEqual(["Tone-waveform.svg", "Tone-waveform.png", "Tone-waveform-peaks.json"]);
  expect(entries.every((entry) => entry.compressionMethod === 0)).toBe(true);
});

test("WAV conversion cooperatively cancels during active encoding", async ({ page }) => {
  const result = await page.evaluate(() => window.__omniMediaHarness.cancelWavConversion());
  expect(result.canceled).toBe(true);
  expect(result.progress.some((value) => value > 10)).toBe(true);
  expect(result.progress).not.toContain(100);
});

test("audio-to-video emits native WebM and MP4 tracks with real dimensions, duration, codecs, trim, metadata, and naming", async ({ page }) => {
  const webm = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-video"));
  const webmFacts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), webm.outputs[0]);
  expect(webm.outputs[0].name).toBe("Tone-converted.webm");
  expect(webmFacts).toMatchObject({ readable: true, mime: "video/webm", width: 640, height: 360, videoCodec: expect.stringMatching(/^vp[89]$/), audioCodec: "opus" });
  expect(webmFacts.duration).toBeCloseTo(2, 1);
  expect(webmFacts.tags).toMatchObject({ title: "Tone" });

  const mp4 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-video", {
    outputFormat: "MP4",
    trim: "First 1 second",
    aspectRatio: "1:1 square",
    resolution: "360p preview",
    frameRate: "24 fps",
    waveform: "Progress bar",
    color: "Emerald on cream",
    compression: "High quality",
    metadata: "No title",
    batchNaming: "Clean filename"
  }));
  const mp4Facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), mp4.outputs[0]);
  expect(mp4.outputs[0].name).toBe("Tone.mp4");
  expect(mp4Facts).toMatchObject({ readable: true, mime: "video/mp4", width: 360, height: 360, videoCodec: "avc", audioCodec: "aac" });
  expect(mp4Facts.duration).toBeCloseTo(1, 1);
  expect(mp4Facts.tags?.title).toBeUndefined();
});
