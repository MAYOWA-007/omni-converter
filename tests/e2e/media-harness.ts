import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { browserRecipesForInspection } from "../../src/core/catalog";
import { validateOutput } from "../../src/core/outputValidation";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_MEDIA_RECIPE_CONTRACTS } from "../../src/data/verifiedMediaRecipes";
import { ensureAudioEncoder } from "../../src/lib/audioEncoders";
import { convertRecipe } from "../../src/lib/conversions";
import { inspectFile } from "../../src/lib/fileInspection";
import type { ConversionSettings } from "../../src/lib/types";
import { createSineWavBytes } from "../fixtures/mediaFixtures";

const FORMAT_FIXTURES = {
  mp3: { url: new URL("../fixtures/tone.mp3", import.meta.url).href, type: "audio/mpeg" },
  ogg: { url: new URL("../fixtures/tone.ogg", import.meta.url).href, type: "audio/ogg" },
  flac: { url: new URL("../fixtures/tone.flac", import.meta.url).href, type: "audio/flac" },
  aac: { url: new URL("../fixtures/tone.aac", import.meta.url).href, type: "audio/aac" },
  m4a: { url: new URL("../fixtures/tone.m4a", import.meta.url).href, type: "audio/mp4" }
} as const;

const VIDEO_FIXTURES = {
  "video-webm": { url: new URL("../fixtures/video-tone.webm", import.meta.url).href, name: "Video Tone.webm", type: "video/webm" },
  "video-mp4": { url: new URL("../fixtures/video-tone.mp4", import.meta.url).href, name: "Video Tone.mp4", type: "video/mp4" }
} as const;

const EXPANDED_MEDIA_FIXTURES = {
  wav: ["tone.wav", "Tone.wav", "audio/wav", "audio", "wav", "audio-to-wav"],
  mp3: ["tone.mp3", "Tone.mp3", "audio/mpeg", "audio", "mp3", "audio-to-wav"],
  flac: ["tone.flac", "Tone.flac", "audio/flac", "audio", "flac", "audio-to-wav"],
  m4a: ["tone.m4a", "Tone.m4a", "audio/mp4", "audio", "m4a", "audio-to-wav"],
  aac: ["tone.aac", "Tone.aac", "audio/aac", "audio", "aac", "audio-to-wav"],
  ogg: ["tone.ogg", "Tone.ogg", "audio/ogg", "audio", "ogg", "audio-to-wav"],
  opus: ["tone.opus", "Tone.opus", "audio/opus", "audio", "opus", "audio-to-wav"],
  "audio-webm": ["tone.webm", "Tone.webm", "audio/webm", "audio", "webm", "audio-to-wav"],
  mka: ["tone.mka", "Tone.mka", "audio/x-matroska", "audio", "mka", "audio-to-wav"],
  "mka-ac3": ["tone-ac3.mka", "Tone AC3.mka", "audio/x-matroska", "audio", "mka", "audio-to-wav"],
  "audio-mov": ["tone-audio.mov", "Tone.mov", "video/quicktime", "audio", "mov", "audio-to-wav"],
  m4r: ["tone.m4r", "Tone.m4r", "audio/mp4", "audio", "m4r", "audio-to-wav"],
  aiff: ["tone.aiff", "Tone.aiff", "audio/aiff", "audio", "aiff", "audio-to-wav"],
  caf: ["tone.caf", "Tone.caf", "audio/x-caf", "audio", "caf", "audio-to-wav"],
  ac3: ["tone.ac3", "Tone.ac3", "audio/ac3", "audio", "ac3", "audio-to-wav"],
  eac3: ["tone.eac3", "Tone.eac3", "audio/eac3", "audio", "eac3", "audio-to-wav"],
  oga: ["tone.oga", "Tone.oga", "audio/ogg", "audio", "oga", "audio-to-wav"],
  wma: ["tone.wma", "Tone.wma", "audio/x-ms-wma", "audio", "wma", "audio-to-wav"],
  wv: ["tone.wv", "Tone.wv", "audio/wavpack", "audio", "wv", "audio-to-wav"],
  tta: ["tone.tta", "Tone.tta", "audio/x-tta", "audio", "tta", "audio-to-wav"],
  mp2: ["tone.mp2", "Tone.mp2", "audio/mpeg", "audio", "mp2", "audio-to-wav"],
  au: ["tone.au", "Tone.au", "audio/basic", "audio", "au", "audio-to-wav"],
  w64: ["tone.w64", "Tone.w64", "audio/x-w64", "audio", "w64", "audio-to-wav"],
  "3gp": ["tone.3gp", "Tone.3gp", "audio/3gpp", "audio", "3gp", "audio-to-wav"],
  mov: ["video.mov", "Video.mov", "video/quicktime", "video", "mov", "video-to-mp4"],
  m4v: ["video.m4v", "Video.m4v", "video/mp4", "video", "m4v", "video-to-mp4"],
  mkv: ["video.mkv", "Video.mkv", "video/x-matroska", "video", "mkv", "video-to-mp4"],
  ts: ["video.mpegts", "Video.ts", "video/mp2t", "video", "ts", "video-to-mp4"]
} as const satisfies Record<string, readonly [fileName: string, uploadName: string, mime: string, family: "audio" | "video", exactFormat: string, canonicalRecipeId: string]>;

function fixture(name = "Tone.wav", type = "audio/wav") {
  return new File([createSineWavBytes()], name, { type });
}

async function inspectFixture(name?: string, type?: string) {
  return inspectFile(fixture(name, type));
}

async function runMediaRecipe(recipeId: string, overrides: ConversionSettings = {}) {
  const contract = VERIFIED_MEDIA_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified media recipe: ${recipeId}`);
  return executeMediaRecipe(await contractFixture(contract.fixture), recipeId, overrides);
}

async function inspectFormat(format: keyof typeof FORMAT_FIXTURES) {
  return inspectFile(await formatFixture(format));
}

async function probeEncoders() {
  const media = await import("mediabunny");
  await ensureAudioEncoder(media, "aac", { numberOfChannels: 1, sampleRate: 48_000, bitrate: 160_000 }, { preferBundled: true });
  return {
    mp4Video: await media.getFirstEncodableVideoCodec(["avc"], { width: 640, height: 360 }),
    mp4Audio: await media.getFirstEncodableAudioCodec(["aac"], { numberOfChannels: 1, sampleRate: 48_000 }),
    webmVideo: await media.getFirstEncodableVideoCodec(["vp9", "vp8"], { width: 640, height: 360 }),
    webmAudio: await media.getFirstEncodableAudioCodec(["opus"], { numberOfChannels: 1, sampleRate: 48_000 })
  };
}

async function runMediaFormat(recipeId: string, format: keyof typeof FORMAT_FIXTURES) {
  const overrides = recipeId === "audio-to-video" ? {
    outputFormat: "WebM",
    trim: "Full file",
    aspectRatio: "16:9 widescreen",
    resolution: "360p preview",
    frameRate: "12 fps",
    waveform: "Animated waveform",
    typography: "Editorial serif",
    color: "Gold on charcoal",
    compression: "Balanced",
    metadata: "Embed title tag",
    batchNaming: "Converted suffix"
  } : {};
  return executeMediaRecipe(await formatFixture(format), recipeId, overrides);
}

async function runVideoFixture(recipeId: string, fixtureId: keyof typeof VIDEO_FIXTURES, overrides: ConversionSettings = {}) {
  return executeMediaRecipe(await videoFixture(fixtureId), recipeId, overrides);
}

async function roundTripAudioRecipe(sourceRecipeId: string, targetRecipeId: string) {
  const sourceContract = VERIFIED_MEDIA_RECIPE_CONTRACTS.find((entry) => entry.recipeId === sourceRecipeId);
  const sourceRecipe = CONVERSION_RECIPES.find((entry) => entry.id === sourceRecipeId);
  const targetContract = VERIFIED_MEDIA_RECIPE_CONTRACTS.find((entry) => entry.recipeId === targetRecipeId);
  const targetRecipe = CONVERSION_RECIPES.find((entry) => entry.id === targetRecipeId);
  if (!sourceContract || !sourceRecipe || !targetContract || !targetRecipe) throw new Error("Unknown audio round-trip recipe.");

  const sourceFile = fixture();
  const sourceOutputs = await convertRecipe(sourceFile, await inspectFile(sourceFile), sourceRecipe, sourceContract.fixtureSettings);
  const sourceOutput = sourceOutputs[0];
  if (!sourceOutput) throw new Error(`${sourceRecipeId} produced no output.`);

  const uploadedFile = new File([sourceOutput.blob], sourceOutput.name, { type: sourceOutput.blob.type });
  const inspection = await inspectFile(uploadedFile);
  const availableRecipeIds = browserRecipesForInspection(inspection).map((recipe) => recipe.id);
  const targetOutputs = await convertRecipe(uploadedFile, inspection, targetRecipe, targetContract.fixtureSettings);
  const targetOutput = targetOutputs[0];
  if (!targetOutput) throw new Error(`${targetRecipeId} produced no output.`);
  const targetValidation = await validateOutput(targetOutput);

  return {
    source: { name: sourceOutput.name, size: sourceOutput.blob.size, validation: await validateOutput(sourceOutput) },
    inspection,
    availableRecipeIds,
    target: { name: targetOutput.name, size: targetOutput.blob.size, validation: targetValidation }
  };
}

async function verifyExpandedMediaFixture(fixtureId: keyof typeof EXPANDED_MEDIA_FIXTURES) {
  const fixture = EXPANDED_MEDIA_FIXTURES[fixtureId];
  const file = await expandedMediaFixture(fixtureId);
  const sourceSupport = await nativeMediaSupport(file);
  const inspection = await inspectFile(file);
  const availableRecipeIds = browserRecipesForInspection(inspection).map((recipe) => recipe.id);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === fixture[5]);
  const contract = VERIFIED_MEDIA_RECIPE_CONTRACTS.find((entry) => entry.recipeId === fixture[5]);
  if (!recipe || !contract) throw new Error(`Missing canonical media contract: ${fixture[5]}`);

  const outputs = await convertRecipe(file, inspection, recipe, contract.fixtureSettings);
  const output = outputs[0];
  if (!output) throw new Error(`${fixture[5]} produced no output for ${fixtureId}.`);
  const validation = await validateOutput(output);
  const reopenedFile = new File([output.blob], output.name, { type: output.blob.type });

  return {
    expected: { family: fixture[3], exactFormat: fixture[4], canonicalRecipeId: fixture[5] },
    sourceSupport,
    inspection,
    availableRecipeIds,
    output: {
      name: output.name,
      size: output.blob.size,
      validation: { valid: validation.valid, detectedFormat: validation.detectedFormat, errors: validation.errors },
      inspection: await inspectFile(reopenedFile),
      nativeSupport: await nativeMediaSupport(reopenedFile)
    }
  };
}

async function expandedMediaFixture(fixtureId: keyof typeof EXPANDED_MEDIA_FIXTURES) {
  const [fileName, uploadName, mime] = EXPANDED_MEDIA_FIXTURES[fixtureId];
  const response = await fetch(new URL(`../fixtures/media/${fileName}`, import.meta.url).href);
  if (!response.ok) throw new Error(`Could not load expanded media fixture ${fixtureId}.`);
  return new File([await response.blob()], uploadName, { type: mime });
}

async function nativeMediaSupport(file: File) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    const containerReadable = await input.canRead();
    if (!containerReadable) return { containerReadable, audioDecodable: false, videoDecodable: false };
    const [audio, video] = await Promise.all([input.getPrimaryAudioTrack(), input.getPrimaryVideoTrack()]);
    return {
      containerReadable,
      audioDecodable: audio ? await audio.canDecode() : null,
      videoDecodable: video ? await video.canDecode() : null
    };
  } catch {
    return { containerReadable: false, audioDecodable: false, videoDecodable: false };
  } finally {
    input.dispose();
  }
}

async function cancelFfmpegAudioInspection() {
  const module = await import("../../src/lib/ffmpegAudioConversions");
  const inspect = module.inspectFfmpegAudio as unknown as (file: File, signal?: AbortSignal) => Promise<unknown>;
  const controller = new AbortController();
  controller.abort();
  try {
    await inspect(fixture("Canceled.aiff", "audio/aiff"), controller.signal);
    return { canceled: false };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.name : "UnknownError" };
  }
}

async function inspectOutputMedia(bytes: number[], name: string, type: string) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(new File([Uint8Array.from(bytes)], name, { type })), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) return { readable: false };
    const [format, video, audio] = await Promise.all([input.getFormat(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    return {
      readable: true,
      mime: format.mimeType,
      duration: await input.computeDuration([video, audio]),
      width: await video?.getDisplayWidth(),
      height: await video?.getDisplayHeight(),
      videoCodec: await video?.getCodec(),
      audioCodec: await audio?.getCodec(),
      sampleRate: await audio?.getSampleRate(),
      audioChannels: await audio?.getNumberOfChannels(),
      tags: await input.getMetadataTags()
    };
  } finally {
    input.dispose();
  }
}

async function executeMediaRecipe(file: File, recipeId: string, overrides: ConversionSettings) {
  const contract = VERIFIED_MEDIA_RECIPE_CONTRACTS.find((entry) => entry.recipeId === recipeId);
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === recipeId);
  if (!contract || !recipe) throw new Error(`Unknown verified media recipe: ${recipeId}`);
  const progress: Array<{ completed?: number; total?: number; label?: string }> = [];
  const outputs = await convertRecipe(file, await inspectFile(file), recipe, { ...contract.fixtureSettings, ...overrides }, { reportProgress: (value) => progress.push(value) });
  return {
    progress,
    outputs: await Promise.all(outputs.map(async (output) => {
      const validation = await validateOutput(output);
      return {
        name: output.name,
        type: output.blob.type,
        bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
        text: /(?:text|json|svg)/i.test(output.blob.type) ? await output.blob.text() : undefined,
        validation: { valid: validation.valid, detectedFormat: validation.detectedFormat, expectedFormat: validation.expectedFormat, errors: validation.errors }
      };
    }))
  };
}

async function formatFixture(format: keyof typeof FORMAT_FIXTURES) {
  const value = FORMAT_FIXTURES[format];
  const response = await fetch(value.url);
  if (!response.ok) throw new Error(`Could not load ${format} fixture.`);
  return new File([await response.blob()], `Tone.${format}`, { type: value.type });
}

async function inspectVideoFixture(fixtureId: keyof typeof VIDEO_FIXTURES) {
  return inspectFile(await videoFixture(fixtureId));
}

async function contractFixture(fixtureId: (typeof VERIFIED_MEDIA_RECIPE_CONTRACTS)[number]["fixture"]) {
  return fixtureId === "sine-wav" ? fixture() : videoFixture(fixtureId);
}

async function videoFixture(fixtureId: keyof typeof VIDEO_FIXTURES) {
  const value = VIDEO_FIXTURES[fixtureId];
  const response = await fetch(value.url);
  if (!response.ok) throw new Error(`Could not load ${fixtureId} fixture.`);
  return new File([await response.blob()], value.name, { type: value.type });
}

async function cancelWavConversion() {
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-wav");
  if (!recipe) throw new Error("Verified WAV recipe is missing.");
  const file = new File([createSineWavBytes(8, 48_000, 2)], "Long Tone.wav", { type: "audio/wav" });
  const controller = new AbortController();
  const progress: number[] = [];
  try {
    await convertRecipe(file, await inspectFile(file), recipe, {
      trim: "Full file",
      sampleRate: "96 kHz",
      audioChannels: "Stereo",
      bitDepth: "32-bit float",
      metadata: "Strip tags",
      batchNaming: "Converted suffix"
    }, {
      signal: controller.signal,
      reportProgress: (value) => {
        const completed = value.completed ?? 0;
        progress.push(completed);
        if (completed > 10 && !controller.signal.aborted) controller.abort();
      }
    });
    return { canceled: false, progress };
  } catch (error) {
    return { canceled: controller.signal.aborted, error: error instanceof Error ? error.name : "UnknownError", progress };
  }
}

function inspectWav(bytes: number[]) {
  const data = Uint8Array.from(bytes);
  const view = new DataView(data.buffer);
  return {
    riff: ascii(data, 0, 4),
    wave: ascii(data, 8, 4),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataBytes: view.getUint32(40, true),
    totalBytes: data.length
  };
}

async function cancelFfmpegAudioConversion() {
  const recipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-vorbis");
  if (!recipe) throw new Error("Verified Vorbis recipe is missing.");
  const file = new File([createSineWavBytes(90, 48_000, 2)], "Long Tone.wav", { type: "audio/wav" });
  const controller = new AbortController();
  const progress: number[] = [];
  try {
    await convertRecipe(file, await inspectFile(file), recipe, {
      trim: "Full file",
      sampleRate: "48 kHz",
      audioChannels: "Stereo",
      compression: "320 kbps",
      metadata: "Strip tags",
      batchNaming: "Converted suffix"
    }, {
      signal: controller.signal,
      reportProgress: (value) => {
        const completed = value.completed ?? 0;
        progress.push(completed);
        if (completed > 10 && !controller.signal.aborted) controller.abort();
      }
    });
    return { canceled: false, progress };
  } catch (error) {
    return { canceled: controller.signal.aborted, error: error instanceof Error ? error.name : "UnknownError", progress };
  }
}

function inspectFlac(bytes: number[]) {
  const data = Uint8Array.from(bytes);
  return {
    signature: ascii(data, 0, 4),
    sampleRate: (data[18] << 12) | (data[19] << 4) | (data[20] >> 4),
    channels: ((data[20] >> 1) & 7) + 1,
    bitsPerSample: (((data[20] & 1) << 4) | (data[21] >> 4)) + 1,
    totalBytes: data.length
  };
}

async function unzip(bytes: number[]) {
  const reader = new ZipReader(new BlobReader(new Blob([Uint8Array.from(bytes)], { type: "application/zip" })), { checkSignature: true, checkOverlappingEntry: true });
  try {
    const entries = await reader.getEntries();
    return Promise.all(entries.filter((entry) => !entry.directory).map(async (entry) => {
      const blob = entry.getData ? await entry.getData(new BlobWriter()) : new Blob();
      return { name: entry.filename, compressionMethod: entry.compressionMethod, bytes: [...new Uint8Array(await blob.arrayBuffer())], text: await blob.text() };
    }));
  } finally {
    await reader.close();
  }
}

async function inspectRaster(bytes: number[], type: string) {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type }));
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

declare global {
  interface Window {
    __omniMediaHarness: {
      inspectFixture: typeof inspectFixture;
      inspectFormat: typeof inspectFormat;
      probeEncoders: typeof probeEncoders;
      runMediaRecipe: typeof runMediaRecipe;
      runMediaFormat: typeof runMediaFormat;
      runVideoFixture: typeof runVideoFixture;
      roundTripAudioRecipe: typeof roundTripAudioRecipe;
      verifyExpandedMediaFixture: typeof verifyExpandedMediaFixture;
      cancelFfmpegAudioInspection: typeof cancelFfmpegAudioInspection;
      cancelWavConversion: typeof cancelWavConversion;
      cancelFfmpegAudioConversion: typeof cancelFfmpegAudioConversion;
      inspectWav: typeof inspectWav;
      inspectFlac: typeof inspectFlac;
      inspectOutputMedia: typeof inspectOutputMedia;
      inspectVideoFixture: typeof inspectVideoFixture;
      inspectRaster: typeof inspectRaster;
      unzip: typeof unzip;
    };
  }
}

window.__omniMediaHarness = { inspectFixture, inspectFormat, probeEncoders, runMediaRecipe, runMediaFormat, runVideoFixture, roundTripAudioRecipe, verifyExpandedMediaFixture, cancelFfmpegAudioInspection, cancelWavConversion, cancelFfmpegAudioConversion, inspectWav, inspectFlac, inspectOutputMedia, inspectVideoFixture, inspectRaster, unzip };
document.getElementById("status")!.textContent = "ready";
