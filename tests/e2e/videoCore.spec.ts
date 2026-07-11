import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

test("MP4 and WebM inspection reports actual tracks, codecs, dimensions, and duration", async ({ page }) => {
  const webm = await page.evaluate(() => window.__omniMediaHarness.inspectVideoFixture("video-webm"));
  expect(webm).toMatchObject({ family: "video", exactFormat: "webm", width: 160, height: 90, videoCodec: "vp9", audioCodec: "opus", mediaTargets: { mp4: true, webm: true } });
  expect(webm.duration).toBeCloseTo(1.2, 1);

  const mp4 = await page.evaluate(() => window.__omniMediaHarness.inspectVideoFixture("video-mp4"));
  expect(mp4).toMatchObject({ family: "video", exactFormat: "mp4", width: 160, height: 90, videoCodec: "avc", audioCodec: "aac" });
  expect(mp4.duration).toBeCloseTo(1.2, 1);
});

test("video frame ZIP applies interval, every-frame mode, format, dimensions, quality, naming, manifest, and ZIP level", async ({ page }) => {
  const result = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-to-frames"));
  const entries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), result.outputs[0].bytes);
  expect(result.outputs[0].name).toBe("Video-Tone-frames.zip");
  expect(entries.map((entry) => entry.name)).toEqual([
    "frames/Video-Tone-00-00-000.png",
    "frames/Video-Tone-00-00-500.png",
    "frames/Video-Tone-00-01-000.png",
    "manifest.json"
  ]);
  expect(entries.every((entry) => entry.compressionMethod === 0)).toBe(true);
  expect(await page.evaluate((entry) => window.__omniMediaHarness.inspectRaster(entry.bytes, "image/png"), entries[0])).toEqual({ width: 160, height: 90 });
  expect(JSON.parse(entries[3].text).frames.map((frame: { timestamp: number }) => frame.timestamp)).toEqual([0, 0.5, 1]);

  const everyFrame = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-to-frames", {
    outputFormat: "JPEG",
    frameInterval: "Every frame",
    resolution: "80 px wide",
    compression: "Small file",
    metadata: "Files only",
    batchNaming: "Sequence names",
    bundle: "Maximum ZIP"
  }));
  const frameEntries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), everyFrame.outputs[0].bytes);
  expect(frameEntries).toHaveLength(12);
  expect(frameEntries[0].name).toBe("frames/Video-Tone-frame-0001.jpg");
  expect(frameEntries.every((entry) => entry.compressionMethod === 8)).toBe(true);
  expect(await page.evaluate((entry) => window.__omniMediaHarness.inspectRaster(entry.bytes, "image/jpeg"), frameEntries[0])).toEqual({ width: 80, height: 45 });
});

test("PNG frame quality changes pixel depth instead of passing an ignored browser quality flag", async ({ page }) => {
  const settings = {
    outputFormat: "PNG",
    trim: "First 1 second",
    frameInterval: "Every 1 second",
    resolution: "80 px wide",
    metadata: "Files only",
    batchNaming: "Sequence names",
    bundle: "Store ZIP"
  };
  const maximum = await page.evaluate((overrides) => window.__omniMediaHarness.runVideoFixture("video-to-frames", "video-webm", { ...overrides, compression: "Maximum quality" }), settings);
  const compact = await page.evaluate((overrides) => window.__omniMediaHarness.runVideoFixture("video-to-frames", "video-webm", { ...overrides, compression: "Small file" }), settings);
  const maximumEntry = (await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), maximum.outputs[0].bytes))[0];
  const compactEntry = (await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), compact.outputs[0].bytes))[0];

  expect(compactEntry.bytes).not.toEqual(maximumEntry.bytes);
  expect(compactEntry.bytes.length).toBeLessThan(maximumEntry.bytes.length);
  expect(await page.evaluate((entry) => window.__omniMediaHarness.inspectRaster(entry.bytes, "image/png"), compactEntry)).toEqual({ width: 80, height: 45 });
});

test("contact sheet applies grid, fit, output format, width, timestamp, and naming controls", async ({ page }) => {
  const png = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-thumbnail-sheet"));
  expect(png.outputs[0].name).toBe("Video-Tone-contact-sheet.png");
  expect(await page.evaluate((output) => window.__omniMediaHarness.inspectRaster(output.bytes, output.type), png.outputs[0])).toEqual({ width: 1200, height: 675 });

  const jpeg = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-thumbnail-sheet", {
    outputFormat: "JPEG",
    pageLayout: "2 x 2 grid",
    crop: "Fit inside cells",
    resolution: "800 px wide",
    metadata: "No timestamps",
    batchNaming: "Clean filename"
  }));
  expect(jpeg.outputs[0].name).toBe("Video-Tone.jpg");
  expect(await page.evaluate((output) => window.__omniMediaHarness.inspectRaster(output.bytes, output.type), jpeg.outputs[0])).toEqual({ width: 800, height: 450 });
});

test("video transcode emits real MP4 and WebM tracks and applies geometry, trim, frame rate, tags, quality, and naming", async ({ page }) => {
  const mp4 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-to-mp4", {
    trim: "First 1 second",
    aspectRatio: "1:1 square",
    crop: "Fill and crop",
    resolution: "360p preview",
    frameRate: "12 fps",
    compression: "High quality",
    metadata: "Strip tags",
    batchNaming: "Clean filename"
  }));
  const mp4Facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), mp4.outputs[0]);
  expect(mp4.outputs[0].name).toBe("Video-Tone.mp4");
  expect(mp4Facts).toMatchObject({ readable: true, mime: "video/mp4", width: 360, height: 360, videoCodec: "avc", audioCodec: "aac" });
  expect(mp4Facts.duration).toBeCloseTo(1, 1);
  expect(mp4Facts.tags.title).toBeUndefined();

  const webm = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("video-to-webm"));
  const webmFacts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), webm.outputs[0]);
  expect(webm.outputs[0].name).toBe("Video-Tone-converted.webm");
  expect(webmFacts).toMatchObject({ readable: true, mime: "video/webm", width: 160, height: 90, videoCodec: expect.stringMatching(/^vp[89]$/), audioCodec: "opus" });
  expect(webmFacts.duration).toBeCloseTo(1.2, 1);
  expect(webmFacts.tags).toMatchObject({ title: "Omni Test Tone" });
});

test("video audio extraction emits WAV, M4A, AAC, and OGG without a video track", async ({ page }) => {
  const targets = [
    { outputFormat: "WAV", extension: "wav", codec: "pcm-s16" },
    { outputFormat: "M4A", extension: "m4a", codec: "aac" },
    { outputFormat: "AAC", extension: "aac", codec: "aac" },
    { outputFormat: "OGG", extension: "ogg", codec: "opus" }
  ];
  for (const target of targets) {
    const result = await page.evaluate((outputFormat) => window.__omniMediaHarness.runMediaRecipe("video-to-audio", { outputFormat }), target.outputFormat);
    expect(result.outputs[0].name).toBe(`Video-Tone-audio.${target.extension}`);
    const facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), result.outputs[0]);
    expect(facts).toMatchObject({ readable: true, audioCodec: target.codec });
    expect(facts.videoCodec).toBeUndefined();
  }
});

test("video-to-WAV applies trim, sample rate, channels, compression depth, tags, and naming", async ({ page }) => {
  const maximum = await page.evaluate(() => window.__omniMediaHarness.runVideoFixture("video-to-audio", "video-mp4", {
    outputFormat: "WAV",
    trim: "First 1 second",
    sampleRate: "44.1 kHz",
    audioChannels: "Mono",
    compression: "Maximum quality",
    metadata: "Keep tags",
    batchNaming: "Clean filename"
  }));
  const maximumFacts = await page.evaluate(
    (output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type),
    maximum.outputs[0]
  );
  expect(maximum.outputs[0].name).toBe("Video-Tone.wav");
  expect(maximumFacts).toMatchObject({ readable: true, audioCodec: "pcm-f32", sampleRate: 44_100, audioChannels: 1 });
  expect(maximumFacts.duration).toBeCloseTo(1, 1);
  expect(maximumFacts.tags).toMatchObject({ title: "Omni Test Tone" });

  const compact = await page.evaluate(() => window.__omniMediaHarness.runVideoFixture("video-to-audio", "video-mp4", {
    outputFormat: "WAV",
    trim: "Full file",
    sampleRate: "Source sample rate",
    audioChannels: "Source channels",
    compression: "Small file",
    metadata: "Strip tags",
    batchNaming: "Audio suffix"
  }));
  const compactFacts = await page.evaluate(
    (output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type),
    compact.outputs[0]
  );
  expect(compact.outputs[0].name).toBe("Video-Tone-audio.wav");
  expect(compactFacts).toMatchObject({ readable: true, audioCodec: "pcm-u8", sampleRate: 48_000, audioChannels: 1 });
  expect(compactFacts.tags.title).toBeUndefined();
  expect(compact.outputs[0].bytes.length).toBeLessThan(maximum.outputs[0].bytes.length);
});
