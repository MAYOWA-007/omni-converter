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

test("WAV converts to every promoted audio container with truthful codecs and extensions", async ({ page }) => {
  const targets = [
    { recipeId: "audio-to-mp3", extension: "mp3", codec: "mp3" },
    { recipeId: "audio-to-flac", extension: "flac", codec: "flac" },
    { recipeId: "audio-to-m4a", extension: "m4a", codec: "aac" },
    { recipeId: "audio-to-aac", extension: "aac", codec: "aac" },
    { recipeId: "audio-to-ogg", extension: "ogg", codec: "opus" },
    { recipeId: "audio-to-opus", extension: "opus", codec: "opus" },
    { recipeId: "audio-to-webm", extension: "webm", codec: "opus" },
    { recipeId: "audio-to-mka", extension: "mka", codec: "opus" },
    { recipeId: "audio-to-mov", extension: "mov", codec: "aac" },
    { recipeId: "audio-to-m4r", extension: "m4r", codec: "aac" }
  ];

  for (const target of targets) {
    const result = await page.evaluate((recipeId) => window.__omniMediaHarness.runMediaRecipe(recipeId), target.recipeId);
    expect(result.outputs, target.recipeId).toHaveLength(1);
    expect(result.outputs[0].name, target.recipeId).toBe(`Tone-converted.${target.extension}`);
    expect(result.outputs[0].validation, target.recipeId).toMatchObject({ valid: true });
    const facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), result.outputs[0]);
    expect(facts, target.recipeId).toMatchObject({ readable: true, audioCodec: target.codec });
    expect(facts.videoCodec, target.recipeId).toBeUndefined();
    expect(facts.duration, target.recipeId).toBeGreaterThanOrEqual(1.9);
    expect(facts.duration, target.recipeId).toBeLessThanOrEqual(2.25);
  }
});

test("WAV converts to every verified professional and legacy audio file format", async ({ page }) => {
  test.setTimeout(120_000);
  const formats = [
    ["audio-to-aiff", "aiff", "aiff"],
    ["audio-to-alac", "m4a", "m4a"],
    ["audio-to-caf", "caf", "caf"],
    ["audio-to-ac3", "ac3", "ac3"],
    ["audio-to-eac3", "eac3", "eac3"],
    ["audio-to-vorbis", "oga", "ogg"],
    ["audio-to-wma", "wma", "asf"],
    ["audio-to-wavpack", "wv", "wavpack"],
    ["audio-to-tta", "tta", "tta"],
    ["audio-to-mp2", "mp2", "mp2"],
    ["audio-to-au", "au", "au"],
    ["audio-to-wave64", "w64", "wave64"],
    ["audio-to-pcm", "pcm", "pcm"],
    ["audio-to-3gp", "3gp", "3gp"]
  ] as const;

  for (const [recipeId, extension, detectedFormat] of formats) {
    const result = await page.evaluate((id) => window.__omniMediaHarness.runMediaRecipe(id), recipeId);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].name).toMatch(new RegExp(`\\.${extension}$`, "i"));
    expect(result.outputs[0].bytes.length).toBeGreaterThan(16);
    expect(result.outputs[0].validation).toMatchObject({ valid: true, detectedFormat });
  }
});

test("professional audio dropdowns change the encoded bytes they claim to control", async ({ page }) => {
  test.setTimeout(120_000);

  const pcm16 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-pcm", {
    outputFormat: "16-bit little-endian", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", batchNaming: "Clean filename"
  }));
  const pcm24 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-pcm", {
    outputFormat: "24-bit little-endian", trim: "First 1 second", sampleRate: "48 kHz", audioChannels: "Stereo", batchNaming: "Converted suffix"
  }));
  const pcmFloat = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-pcm", {
    outputFormat: "32-bit float little-endian", trim: "First 1 second", sampleRate: "48 kHz", audioChannels: "Stereo", batchNaming: "Converted suffix"
  }));
  expect(pcm16.outputs[0]).toMatchObject({ name: "Tone.pcm", validation: { valid: true } });
  expect(pcm16.outputs[0].bytes).toHaveLength(32_000);
  expect(pcm24.outputs[0].bytes).toHaveLength(288_000);
  expect(pcmFloat.outputs[0].bytes).toHaveLength(384_000);

  const cafSizes: number[] = [];
  for (const outputFormat of ["16-bit PCM in CAF", "24-bit PCM in CAF", "32-bit float in CAF", "ALAC in CAF"]) {
    const result = await page.evaluate((selected) => window.__omniMediaHarness.runMediaRecipe("audio-to-caf", { outputFormat: selected }), outputFormat);
    expect(result.outputs[0].validation.valid, outputFormat).toBe(true);
    cafSizes.push(result.outputs[0].bytes.length);
  }
  expect(new Set(cafSizes).size).toBe(4);

  const auSizes: number[] = [];
  for (const outputFormat of ["16-bit PCM", "G.711 A-law", "G.711 mu-law"]) {
    const result = await page.evaluate((selected) => window.__omniMediaHarness.runMediaRecipe("audio-to-au", { outputFormat: selected }), outputFormat);
    expect(result.outputs[0].validation.valid, outputFormat).toBe(true);
    auSizes.push(result.outputs[0].bytes.length);
  }
  expect(auSizes[0]).toBeGreaterThan(auSizes[1]);
  expect(auSizes[0]).toBeGreaterThan(auSizes[2]);

  const ac3Compact = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-ac3", { compression: "192 kbps" }));
  const ac3Maximum = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-ac3", { compression: "640 kbps" }));
  expect(ac3Maximum.outputs[0].bytes.length).toBeGreaterThan(ac3Compact.outputs[0].bytes.length * 2);
});

test("WAV all-formats bundle contains every verified audio file target and a manifest", async ({ page }) => {
  test.setTimeout(120_000);
  const result = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-format-bundle"));
  expect(result.outputs[0].validation).toMatchObject({ valid: true, detectedFormat: "zip" });
  const entries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), result.outputs[0].bytes);
  const names = entries.map((entry) => entry.name);
  expect(names).toHaveLength(26);
  expect(new Set(names).size).toBe(names.length);
  expect(names).toEqual(expect.arrayContaining([
    "Tone-converted.aac",
    "Tone-converted.ac3",
    "Tone-converted.aiff",
    "Tone-alac.m4a",
    "Tone-converted.au",
    "Tone-converted.caf",
    "Tone-converted.eac3",
    "Tone-converted.flac",
    "Tone-converted.m4a",
    "Tone-converted.m4r",
    "Tone-converted.mka",
    "Tone-converted.mov",
    "Tone-converted.mp2",
    "Tone-converted.mp3",
    "Tone-converted.ogg",
    "Tone-converted.oga",
    "Tone-converted.opus",
    "Tone-converted.pcm",
    "Tone-converted.3gp",
    "Tone-converted.tta",
    "Tone-converted.wav",
    "Tone-converted.w64",
    "Tone-converted.wv",
    "Tone-converted.webm",
    "Tone-converted.wma",
    "format-manifest.json"
  ]));
  const manifest = JSON.parse(entries.find((entry) => entry.name === "format-manifest.json")!.text);
  expect(manifest.outputs).toHaveLength(25);
});

test("compressed audio controls change bitrate, trim, sample rate, channels, and naming", async ({ page }) => {
  const maximum = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-mp3", {
    trim: "First 1 second",
    sampleRate: "48 kHz",
    audioChannels: "Stereo",
    compression: "320 kbps",
    metadata: "Strip tags",
    batchNaming: "Clean filename"
  }));
  const compact = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-mp3", {
    trim: "First 1 second",
    sampleRate: "48 kHz",
    audioChannels: "Stereo",
    compression: "64 kbps",
    metadata: "Strip tags",
    batchNaming: "Converted suffix"
  }));
  const facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), maximum.outputs[0]);

  expect(maximum.outputs[0].name).toBe("Tone.mp3");
  expect(compact.outputs[0].name).toBe("Tone-converted.mp3");
  expect(facts).toMatchObject({ readable: true, audioCodec: "mp3", sampleRate: 48_000, audioChannels: 2 });
  expect(facts.duration).toBeGreaterThanOrEqual(1);
  expect(facts.duration).toBeLessThanOrEqual(1.25);
  expect(maximum.outputs[0].bytes.length).toBeGreaterThan(compact.outputs[0].bytes.length * 2);
});

test("lossless and professional container dropdowns emit the selected audio representation", async ({ page }) => {
  test.setTimeout(90_000);
  const flac16 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-flac", { bitDepth: "16-bit lossless", sampleRate: "44.1 kHz", audioChannels: "Stereo" }));
  const flac24 = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-flac", { bitDepth: "24-bit lossless", sampleRate: "44.1 kHz", audioChannels: "Stereo" }));
  const flac16Facts = await page.evaluate((bytes) => window.__omniMediaHarness.inspectFlac(bytes), flac16.outputs[0].bytes);
  const flac24Facts = await page.evaluate((bytes) => window.__omniMediaHarness.inspectFlac(bytes), flac24.outputs[0].bytes);
  expect(flac16Facts).toMatchObject({ signature: "fLaC", sampleRate: 44_100, channels: 2, bitsPerSample: 16 });
  expect(flac24Facts).toMatchObject({ signature: "fLaC", sampleRate: 44_100, channels: 2, bitsPerSample: 24 });
  expect(flac24Facts.totalBytes).toBeGreaterThan(flac16Facts.totalBytes);

  for (const target of [
    { outputFormat: "Opus in MKA", codec: "opus" },
    { outputFormat: "FLAC in MKA", codec: "flac" },
    { outputFormat: "AC-3 in MKA", codec: "ac3" },
    { outputFormat: "E-AC-3 in MKA", codec: "eac3" }
  ]) {
    const result = await page.evaluate((outputFormat) => window.__omniMediaHarness.runMediaRecipe("audio-to-mka", { outputFormat, sampleRate: "48 kHz" }), target.outputFormat);
    const facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), result.outputs[0]);
    expect(result.outputs[0].validation, target.outputFormat).toMatchObject({ valid: true, detectedFormat: "mka" });
    expect(facts, target.outputFormat).toMatchObject({ readable: true, audioCodec: target.codec });
    expect(facts.duration, target.outputFormat).toBeGreaterThanOrEqual(1.9);
  }

  const pcmMov = await page.evaluate(() => window.__omniMediaHarness.runMediaRecipe("audio-to-mov", { outputFormat: "16-bit PCM in MOV", sampleRate: "48 kHz", audioChannels: "Stereo" }));
  const pcmMovFacts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), pcmMov.outputs[0]);
  expect(pcmMov.outputs[0].validation).toMatchObject({ valid: true, detectedFormat: "mov" });
  expect(pcmMovFacts).toMatchObject({ readable: true, audioCodec: "pcm-s16", sampleRate: 48_000, audioChannels: 2 });
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

test("FFmpeg audio conversion hard-cancels during active encoding", async ({ page }) => {
  test.setTimeout(90_000);
  const result = await page.evaluate(() => window.__omniMediaHarness.cancelFfmpegAudioConversion());
  expect(result).toMatchObject({ canceled: true, error: "AbortError" });
  expect(result.progress.some((value) => value > 10)).toBe(true);
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
    typography: "No title",
    color: "Emerald on cream",
    compression: "High quality",
    metadata: "Strip title tag",
    batchNaming: "Clean filename"
  }));
  const mp4Facts = await page.evaluate((output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type), mp4.outputs[0]);
  expect(mp4.outputs[0].name).toBe("Tone.mp4");
  expect(mp4Facts).toMatchObject({ readable: true, mime: "video/mp4", width: 360, height: 360, videoCodec: "avc", audioCodec: "aac" });
  expect(mp4Facts.duration).toBeCloseTo(1, 1);
  expect(mp4Facts.tags?.title).toBeUndefined();
});
