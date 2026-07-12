import { expect, test } from "playwright/test";
import { preflightRecipe } from "../../src/lib/preflight";
import type { Capability, ConversionRecipe, DeviceProfile, FileInspection } from "../../src/lib/types";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";

const recipe: ConversionRecipe = {
  id: "test-pdf-output",
  input: ["pdf"],
  category: "test",
  output: "test",
  title: "Test output",
  description: "Test output",
  treatments: [],
  editorControls: [],
  requiredCapabilities: [],
  intensity: "light",
  engine: "test",
  implementation: "ready",
  maturity: "verified",
  runtimes: ["browser"],
  localOnly: true
};

const device: DeviceProfile = {
  cores: 8,
  supports: {} as Record<Capability, boolean>
};

test("blocks risk-marked input before normal preflight checks and preserves the reason", () => {
  const inspection: FileInspection = {
    name: "truncated.zip",
    extension: "zip",
    mime: "application/zip",
    size: 4,
    family: "archive",
    riskBlocked: true,
    riskReasons: ["ZIP metadata could not be inspected."],
    notes: []
  };

  expect(preflightRecipe(recipe, inspection, device)).toEqual({
    status: "blocked",
    label: "Unsafe input",
    estimate: "Not available",
    reasons: ["ZIP metadata could not be inspected."]
  });
});

test("gives short parsed audio a bounded device estimate", () => {
  const audioRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-wav")!;
  const audioDevice: DeviceProfile = { cores: 8, memoryGb: 8, supports: { audio: true, worker: true } as Record<Capability, boolean> };
  const inspection: FileInspection = {
    name: "tone.wav",
    extension: "wav",
    mime: "audio/wav",
    size: 32_044,
    family: "audio",
    exactFormat: "wav",
    duration: 2,
    sampleRate: 8_000,
    audioChannels: 1,
    notes: []
  };

  expect(preflightRecipe(audioRecipe, inspection, audioDevice)).toMatchObject({
    status: "ready",
    estimate: "Usually under 10 seconds"
  });
});

test("blocks a projected WAV that cannot fit the current in-memory export path", () => {
  const audioRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-wav")!;
  const audioDevice: DeviceProfile = { cores: 8, memoryGb: 8, supports: { audio: true, worker: true } as Record<Capability, boolean> };
  const inspection: FileInspection = {
    name: "marathon.wav",
    extension: "wav",
    mime: "audio/wav",
    size: 100_000_000,
    family: "audio",
    exactFormat: "wav",
    duration: 4 * 60 * 60,
    sampleRate: 48_000,
    audioChannels: 2,
    notes: []
  };

  expect(preflightRecipe(audioRecipe, inspection, audioDevice)).toMatchObject({
    status: "blocked",
    estimate: "Not available",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });
});

test("blocks a projected all-audio-format bundle before local memory exhaustion", () => {
  const bundleRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-format-bundle")!;
  const audioDevice: DeviceProfile = {
    cores: 12,
    memoryGb: 32,
    supports: { audio: true, webcodecs: true, wasm: true, worker: true, zip: true } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "archive-master.wav",
    extension: "wav",
    mime: "audio/wav",
    size: 120_000_000,
    family: "audio",
    exactFormat: "wav",
    duration: 8 * 60 * 60,
    sampleRate: 48_000,
    audioChannels: 2,
    notes: []
  };

  expect(preflightRecipe(bundleRecipe, inspection, audioDevice, {
    trim: "Full file",
    sampleRate: "48 kHz",
    audioChannels: "Stereo",
    bitDepth: "24-bit lossless",
    compression: "320 kbps"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });
});

test("preflights FFmpeg audio routes from the selected representation and device support", () => {
  const aiffRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-aiff")!;
  const inspection: FileInspection = {
    name: "master.wav", extension: "wav", mime: "audio/wav", size: 120_000_000, family: "audio", exactFormat: "wav", duration: 4 * 60 * 60, sampleRate: 48_000, audioChannels: 2, notes: []
  };
  const capable: DeviceProfile = {
    cores: 12,
    memoryGb: 16,
    supports: { audio: true, wasm: true, worker: true } as Record<Capability, boolean>
  };

  expect(preflightRecipe(aiffRecipe, inspection, capable, {
    trim: "Full file", sampleRate: "96 kHz", audioChannels: "Stereo", bitDepth: "32-bit float"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });

  const short = { ...inspection, size: 32_044, duration: 2, sampleRate: 8_000, audioChannels: 1 };
  expect(preflightRecipe(aiffRecipe, short, capable, {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit PCM"
  }).status).toBe("ready");
  expect(preflightRecipe(aiffRecipe, short, { cores: 8, supports: { audio: true, wasm: false, worker: false } as Record<Capability, boolean> }).status).toBe("blocked");
});

test("blocks audio-to-video when this device exposes no compatible encoder pair", () => {
  const videoRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-video")!;
  const audioDevice: DeviceProfile = { cores: 8, memoryGb: 8, supports: { audio: true, canvas: true, webcodecs: true, worker: true } as Record<Capability, boolean> };
  const inspection: FileInspection = {
    name: "tone.wav",
    extension: "wav",
    mime: "audio/wav",
    size: 32_044,
    family: "audio",
    exactFormat: "wav",
    duration: 2,
    sampleRate: 8_000,
    audioChannels: 1,
    mediaTargets: { mp4: false, webm: false },
    notes: []
  };

  expect(preflightRecipe(videoRecipe, inspection, audioDevice)).toMatchObject({
    status: "blocked",
    reasons: ["This device cannot encode the available video formats."]
  });
});

test("blocks Opus output before conversion when the device exposes no Opus encoder", () => {
  const opusRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-opus")!;
  const audioDevice: DeviceProfile = {
    cores: 8,
    memoryGb: 8,
    supports: { audio: true, webcodecs: true, worker: true, opusEncoder: false } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "tone.wav", extension: "wav", mime: "audio/wav", size: 32_044, family: "audio", exactFormat: "wav", duration: 2, sampleRate: 8_000, audioChannels: 1, notes: []
  };

  expect(preflightRecipe(opusRecipe, inspection, audioDevice)).toMatchObject({
    status: "blocked",
    reasons: ["This device cannot encode Opus audio."]
  });
});

test("requires an M4R selection to fit the ringtone duration limit", () => {
  const ringtoneRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "audio-to-m4r")!;
  const audioDevice: DeviceProfile = {
    cores: 8,
    memoryGb: 8,
    supports: { audio: true, wasm: true, worker: true } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "song.wav", extension: "wav", mime: "audio/wav", size: 8_000_000, family: "audio", exactFormat: "wav", duration: 180, sampleRate: 48_000, audioChannels: 2, notes: []
  };

  expect(preflightRecipe(ringtoneRecipe, inspection, audioDevice, { trim: "Full file" })).toMatchObject({
    status: "blocked",
    reasons: ["Select 40 seconds or less for an M4R ringtone."]
  });
  expect(preflightRecipe(ringtoneRecipe, inspection, audioDevice, { trim: "First 30 seconds" }).status).toBe("ready");
});

test("evaluates long video transcodes from the selected trim and compression", () => {
  const videoRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "video-to-mp4")!;
  const videoDevice: DeviceProfile = {
    cores: 8,
    memoryGb: 16,
    supports: { video: true, webcodecs: true, worker: true } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "feature.mp4",
    extension: "mp4",
    mime: "video/mp4",
    size: 500_000_000,
    family: "video",
    exactFormat: "mp4",
    duration: 60 * 60,
    width: 1920,
    height: 1080,
    sampleRate: 48_000,
    audioChannels: 2,
    notes: []
  };

  expect(preflightRecipe(videoRecipe, inspection, videoDevice).status).not.toBe("blocked");
  expect(preflightRecipe(videoRecipe, inspection, videoDevice, {
    trim: "Full file",
    compression: "Maximum quality"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });
  expect(preflightRecipe(videoRecipe, inspection, videoDevice, {
    trim: "First 30 seconds",
    compression: "Small file"
  }).status).toBe("ready");
  expect(preflightRecipe(videoRecipe, inspection, videoDevice, {
    trim: "Custom range",
    trimStart: 3_590,
    trimEnd: 3_600,
    compression: "Maximum quality"
  }).status).toBe("ready");
});

test("evaluates video frame bundles from interval, dimensions, format, and quality", () => {
  const frameRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "video-to-frames")!;
  const videoDevice: DeviceProfile = {
    cores: 8,
    memoryGb: 16,
    supports: { video: true, canvas: true, webcodecs: true, worker: true, zip: true } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "demo.webm",
    extension: "webm",
    mime: "video/webm",
    size: 20_000_000,
    family: "video",
    exactFormat: "webm",
    duration: 120,
    width: 1920,
    height: 1080,
    notes: []
  };

  expect(preflightRecipe(frameRecipe, inspection, videoDevice, {
    outputFormat: "PNG",
    trim: "Full file",
    frameInterval: "Every 0.5 seconds",
    resolution: "Source resolution",
    compression: "Maximum quality"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });
  expect(preflightRecipe(frameRecipe, inspection, videoDevice, {
    outputFormat: "JPEG",
    trim: "First 30 seconds",
    frameInterval: "Every 5 seconds",
    resolution: "720 px wide",
    compression: "Small file"
  }).status).toBe("ready");
  expect(preflightRecipe(frameRecipe, inspection, videoDevice, {
    outputFormat: "JPEG",
    trim: "Full file",
    frameInterval: "Every frame",
    resolution: "80 px wide",
    compression: "Small file"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This selection is likely to exceed the 1,200-frame bundle limit."])
  });
});

test("evaluates video audio extraction from the selected output format", () => {
  const audioRecipe = CONVERSION_RECIPES.find((entry) => entry.id === "video-to-audio")!;
  const videoDevice: DeviceProfile = {
    cores: 8,
    memoryGb: 16,
    supports: { audio: true, video: true, webcodecs: true, worker: true } as Record<Capability, boolean>
  };
  const inspection: FileInspection = {
    name: "conference.mp4",
    extension: "mp4",
    mime: "video/mp4",
    size: 100_000_000,
    family: "video",
    exactFormat: "mp4",
    duration: 4 * 60 * 60,
    sampleRate: 48_000,
    audioChannels: 2,
    notes: []
  };

  expect(preflightRecipe(audioRecipe, inspection, videoDevice, {
    outputFormat: "WAV",
    trim: "Full file",
    sampleRate: "48 kHz",
    audioChannels: "Stereo"
  })).toMatchObject({
    status: "blocked",
    reasons: expect.arrayContaining(["This output is too large for the current browser export path."])
  });
  expect(preflightRecipe(audioRecipe, inspection, videoDevice, {
    outputFormat: "AAC",
    trim: "Full file",
    audioChannels: "Stereo",
    compression: "Small file"
  }).status).toBe("ready");
});
