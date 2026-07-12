import { resolveMediaTrimRange } from "./mediaTrim";
import type { Capability, ConversionRecipe, ConversionSettings, DeviceProfile, FileInspection, Intensity, PreflightResult } from "./types";

declare global {
  interface Navigator {
    deviceMemory?: number;
    storage?: StorageManager;
  }
}

export async function getDeviceProfile(): Promise<DeviceProfile> {
  const storage = await navigator.storage?.estimate?.().catch(() => undefined);
  const [webpEncoder, avifEncoder, opusEncoder] = await Promise.all([canEncodeImage("image/webp"), canEncodeImage("image/avif"), canEncodeOpusAudio()]);
  const supports: Record<Capability, boolean> = {
    canvas: canUseCanvas(),
    webgl: canUseWebgl(),
    wasm: typeof WebAssembly !== "undefined",
    worker: typeof Worker !== "undefined",
    webcodecs: "VideoEncoder" in window || "VideoDecoder" in window,
    mediarecorder: "MediaRecorder" in window,
    mediacapabilities: "mediaCapabilities" in navigator,
    filesystem: "showSaveFilePicker" in window || "showOpenFilePicker" in window,
    opfs: Boolean(navigator.storage?.getDirectory),
    zip: true,
    ocr: typeof WebAssembly !== "undefined" && typeof Worker !== "undefined",
    pdf: true,
    spreadsheet: true,
    image: true,
    webpEncoder,
    avifEncoder,
    opusEncoder,
    audio: "AudioContext" in window || "webkitAudioContext" in window,
    video: Boolean(document.createElement("video").canPlayType)
  };

  return {
    cores: navigator.hardwareConcurrency || 2,
    memoryGb: navigator.deviceMemory,
    storageQuota: storage?.quota,
    storageUsage: storage?.usage,
    supports
  };
}

export function preflightRecipe(recipe: ConversionRecipe, inspection: FileInspection, device: DeviceProfile, settings?: ConversionSettings): PreflightResult {
  const reasons: string[] = [];
  const missing = recipe.requiredCapabilities.filter((capability) => !device.supports[capability]);
  const availableStorage = device.storageQuota != null && device.storageUsage != null ? device.storageQuota - device.storageUsage : undefined;
  const projectedOutput = projectedOutputBytes(recipe, inspection, settings);
  const projectedFrames = recipe.id === "video-to-frames" ? projectedVideoFrameCount(inspection, settings) : undefined;

  if (inspection.riskBlocked) {
    return {
      status: "blocked",
      label: "Unsafe input",
      estimate: "Not available",
      reasons: inspection.riskReasons?.length ? inspection.riskReasons : ["This input cannot be processed safely."]
    };
  }

  if (recipe.implementation === "planned") {
    return {
      status: "blocked",
      label: "Queued",
      estimate: "Not available yet",
      reasons: ["This exact converter is in the build queue."]
    };
  }

  if (missing.length) {
    reasons.push(`This browser is missing: ${missing.join(", ")}.`);
  }

  if (projectedOutput && projectedOutput > 512 * 1024 * 1024) {
    reasons.push("The projected output exceeds the current safe in-memory export limit.");
  }

  if (projectedFrames && projectedFrames > 1200) {
    reasons.push("The selected frame extraction exceeds the 1,200-frame bundle limit.");
  }

  if (recipe.id === "audio-to-video" && inspection.mediaTargets && !inspection.mediaTargets.mp4 && !inspection.mediaTargets.webm) {
    reasons.push("This browser and device do not expose a compatible MP4 or WebM encoder.");
  }

  const ringtoneTooLong = recipe.id === "audio-to-m4r" && (selectedDuration(inspection.duration, settings) ?? 0) > 40;
  if (ringtoneTooLong) {
    reasons.push("Select 40 seconds or less for an M4R ringtone.");
  }

  if (projectedOutput && device.memoryGb && projectedOutput > device.memoryGb * 1024 ** 3 * 0.2) {
    reasons.push("The projected output is too large for the memory reported by this device.");
  }

  const temporaryBytes = Math.max(inspection.size * 3, (projectedOutput ?? 0) * 2);
  if (availableStorage != null && temporaryBytes > availableStorage) {
    reasons.push("Not enough browser storage headroom for temporary files and output bundles.");
  }

  if (recipe.intensity === "extreme" && device.cores < 6) {
    reasons.push("This is a heavy media recipe and this device reports fewer than 6 CPU threads.");
  }

  if ((recipe.intensity === "heavy" || recipe.intensity === "extreme") && device.memoryGb && device.memoryGb < 4) {
    reasons.push("This device reports less than 4 GB memory.");
  }

  if (inspection.family === "video" && inspection.size > 2_500_000_000) {
    reasons.push("Large video files over 2.5 GB are blocked in this version.");
  }

  if (missing.length || ringtoneTooLong || reasons.some((reason) => reason.includes("blocked") || reason.includes("Not enough") || reason.includes("exceeds") || reason.includes("too large") || reason.includes("do not expose"))) {
    return {
      status: "blocked",
      label: "Unavailable",
      estimate: "Not available",
      reasons: reasons.map(toUserReason)
    };
  }

  const slow = shouldWarnSlow(recipe.intensity, device.cores, device.memoryGb, inspection.size);
  return {
    status: slow ? "slow" : "ready",
    label: slow ? "May be slow" : "Ready",
    estimate: estimateTime(recipe, inspection, device, settings),
    reasons: slow ? reasons.map(toUserReason).concat("This conversion may take a while.") : []
  };
}

function toUserReason(reason: string) {
  return reason
    .replace("This browser is missing: webpEncoder.", "This browser cannot export WebP images.")
    .replace("This browser is missing: avifEncoder.", "This browser cannot export AVIF images.")
    .replace("This browser is missing: opusEncoder.", "This device cannot encode Opus audio.")
    .replace("Not enough browser storage headroom for temporary files and output bundles.", "There is not enough browser storage for this file.")
    .replace("Large video files over 2.5 GB are blocked in this version.", "This video is too large for this version.")
    .replace("The projected output exceeds the current safe in-memory export limit.", "This output is too large for the current browser export path.")
    .replace("The selected frame extraction exceeds the 1,200-frame bundle limit.", "This selection is likely to exceed the 1,200-frame bundle limit.")
    .replace("The projected output is too large for the memory reported by this device.", "This device does not report enough memory for the projected output.")
    .replace("This browser and device do not expose a compatible MP4 or WebM encoder.", "This device cannot encode the available video formats.")
    .replace("This is a heavy media recipe and this device reports fewer than 6 CPU threads.", "This device is below the recommended speed for this media task.")
    .replace("This device reports less than 4 GB memory.", "This device may not have enough memory for this file.");
}

function shouldWarnSlow(intensity: Intensity, cores: number, memoryGb: number | undefined, size: number) {
  if (intensity === "light") return false;
  if (intensity === "standard") return cores < 4 || size > 750_000_000;
  if (intensity === "heavy") return cores < 6 || Boolean(memoryGb && memoryGb < 8) || size > 1_000_000_000;
  return cores < 8 || Boolean(memoryGb && memoryGb < 8) || size > 500_000_000;
}

function estimateTime(recipe: ConversionRecipe, inspection: FileInspection, device: DeviceProfile, settings?: ConversionSettings) {
  const mediaDuration = selectedDuration(inspection.duration, settings);
  const workFactors: Record<string, number> = {
    "audio-to-wav": 1.8,
    "audio-to-mp3": 0.55,
    "audio-to-flac": 0.8,
    "audio-to-m4a": 0.65,
    "audio-to-aac": 0.65,
    "audio-to-ogg": 0.6,
    "audio-to-opus": 0.6,
    "audio-to-webm": 0.65,
    "audio-to-mka": 0.75,
    "audio-to-mov": 0.7,
    "audio-to-m4r": 0.65,
    "audio-to-aiff": 0.8,
    "audio-to-alac": 1.1,
    "audio-to-caf": 0.9,
    "audio-to-ac3": 0.9,
    "audio-to-eac3": 1,
    "audio-to-vorbis": 1.1,
    "audio-to-wma": 0.9,
    "audio-to-wavpack": 1.2,
    "audio-to-tta": 1.1,
    "audio-to-mp2": 0.8,
    "audio-to-au": 0.75,
    "audio-to-wave64": 0.8,
    "audio-to-pcm": 0.7,
    "audio-to-3gp": 0.9,
    "audio-format-bundle": 4.8,
    "audio-waveform": 0.55,
    "audio-to-video": 4.5,
    "video-to-frames": 1.4,
    "video-thumbnail-sheet": 0.35,
    "video-to-mp4": 2.8,
    "video-to-webm": 3.2,
    "video-to-audio": 0.7
  };
  const workFactor = workFactors[recipe.id];
  if (workFactor && mediaDuration) {
    const estimatedSeconds = Math.max(2, (mediaDuration * workFactor) / Math.max(1, Math.min(device.cores, 8) / 4));
    return estimateRange(estimatedSeconds);
  }
  const { intensity } = recipe;
  const size = inspection.size;
  const mb = size / 1_000_000;
  if (intensity === "light") return mb < 50 ? "Usually under 10 seconds" : "Usually under 1 minute";
  if (intensity === "standard") return mb < 25 ? "Usually under 30 seconds" : mb < 250 ? "About 30 seconds to 3 minutes" : "About 3-10 minutes";
  if (intensity === "heavy") return mb < 250 ? "About 3-8 minutes" : "About 10-30 minutes";
  return mb < 500 ? "About 10-30 minutes" : "30+ minutes on many PCs";
}

function projectedOutputBytes(recipe: ConversionRecipe, inspection: FileInspection, settings?: ConversionSettings) {
  const duration = selectedDuration(inspection.duration, settings);
  if (!duration) return undefined;
  if (recipe.id === "audio-to-video") return duration * 6_000_000 / 8 + 1024 * 1024;
  if (recipe.id === "audio-to-wav") {
    const sampleRate = selectedSampleRate(settings?.sampleRate, inspection.sampleRate);
    const channels = selectedChannelCount(settings?.audioChannels, inspection.audioChannels);
    const bytesPerSample = settings?.bitDepth === "24-bit PCM" ? 3 : settings?.bitDepth === "32-bit float" ? 4 : 2;
    return duration * sampleRate * channels * bytesPerSample + 128 * 1024;
  }
  if (recipe.id === "audio-format-bundle") {
    const selectedSettings = settings ?? {};
    const sampleRate = selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate);
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    const wavBytes = duration * sampleRate * channels * (selectedSettings.bitDepth === "24-bit lossless" ? 3 : 2);
    const compressedBytes = duration * projectedAudioBitrate(selectedSettings.compression, channels) / 8;
    return wavBytes * 8 + compressedBytes * 15 + 8 * 1024 * 1024;
  }
  if (["audio-to-mp3", "audio-to-m4a", "audio-to-aac", "audio-to-ogg", "audio-to-opus", "audio-to-webm", "audio-to-m4r"].includes(recipe.id)) {
    const selectedSettings = settings ?? {};
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    return duration * projectedAudioBitrate(selectedSettings.compression, channels) / 8 + 256 * 1024;
  }
  if (recipe.id === "audio-to-flac") {
    const selectedSettings = settings ?? {};
    const sampleRate = selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate);
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    const bytesPerSample = selectedSettings.bitDepth === "24-bit lossless" ? 3 : 2;
    return duration * sampleRate * channels * bytesPerSample * 0.7 + 256 * 1024;
  }
  if (["audio-to-ac3", "audio-to-eac3", "audio-to-vorbis", "audio-to-wma", "audio-to-mp2", "audio-to-3gp"].includes(recipe.id)) {
    const selectedSettings = settings ?? {};
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    return duration * projectedAudioBitrate(selectedSettings.compression, channels) / 8 + 512 * 1024;
  }
  if (["audio-to-alac", "audio-to-wavpack", "audio-to-tta"].includes(recipe.id)) {
    const selectedSettings = settings ?? {};
    const sampleRate = selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate);
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    const bytesPerSample = selectedSettings.bitDepth === "24-bit lossless" ? 3 : 2;
    return duration * sampleRate * channels * bytesPerSample * 0.72 + 512 * 1024;
  }
  if (["audio-to-aiff", "audio-to-caf", "audio-to-au", "audio-to-wave64", "audio-to-pcm"].includes(recipe.id)) {
    const selectedSettings = settings ?? {};
    const sampleRate = selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate);
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    const format = selectedSettings.outputFormat ?? "";
    const bytesPerSample = format.includes("G.711") ? 1
      : selectedSettings.bitDepth === "24-bit PCM" || format.includes("24-bit") ? 3
        : selectedSettings.bitDepth === "32-bit float" || format.includes("32-bit float") ? 4
          : 2;
    const losslessFactor = recipe.id === "audio-to-caf" && format === "ALAC in CAF" ? 0.72 : 1;
    return duration * sampleRate * channels * bytesPerSample * losslessFactor + 512 * 1024;
  }
  if (recipe.id === "audio-to-mka") {
    const selectedSettings = settings ?? {};
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    if (selectedSettings.outputFormat === "FLAC in MKA") {
      const sampleRate = selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate);
      return duration * sampleRate * channels * (selectedSettings.bitDepth === "24-bit lossless" ? 3 : 2) * 0.7 + 512 * 1024;
    }
    return duration * projectedAudioBitrate(selectedSettings.compression, channels) / 8 + 512 * 1024;
  }
  if (recipe.id === "audio-to-mov") {
    const selectedSettings = settings ?? {};
    const channels = selectedChannelCount(selectedSettings.audioChannels, inspection.audioChannels);
    if (selectedSettings.outputFormat === "16-bit PCM in MOV") {
      return duration * selectedSampleRate(selectedSettings.sampleRate, inspection.sampleRate) * channels * 2 + 512 * 1024;
    }
    return duration * projectedAudioBitrate(selectedSettings.compression, channels) / 8 + 512 * 1024;
  }
  if (!settings) return undefined;
  if (recipe.id === "video-to-mp4" || recipe.id === "video-to-webm") {
    return duration * (projectedVideoBitrate(settings.compression) + 256_000) / 8 + 1024 * 1024;
  }
  if (recipe.id === "video-to-audio") {
    const channels = selectedChannelCount(settings.audioChannels, inspection.audioChannels);
    if ((settings.outputFormat ?? "WAV") === "WAV") {
      return duration * selectedSampleRate(settings.sampleRate, inspection.sampleRate) * channels * projectedWavBytesPerSample(settings.compression) + 128 * 1024;
    }
    return duration * projectedAudioBitrate(settings.compression, channels) / 8 + 128 * 1024;
  }
  if (recipe.id === "video-to-frames" && inspection.width && inspection.height) {
    const frameCount = Math.min(1201, projectedVideoFrameCount(inspection, settings) ?? 0);
    const width = selectedFrameWidth(settings.resolution, inspection.width);
    const height = Math.max(1, Math.round(width / inspection.width * inspection.height));
    return frameCount * width * height * projectedRasterBytesPerPixel(settings.outputFormat, settings.compression) + frameCount * 512;
  }
  return undefined;
}

function selectedDuration(duration: number | undefined, settings?: ConversionSettings) {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return undefined;
  try {
    return resolveMediaTrimRange(settings ?? {}, duration).duration;
  } catch {
    return undefined;
  }
}

function selectedSampleRate(value: string | undefined, fallback = 48_000) {
  if (!value || value === "Source sample rate") return fallback;
  const amount = Number(value.match(/[\d.]+/)?.[0]);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 1000) : fallback;
}

function selectedChannelCount(value: string | undefined, fallback = 2) {
  if (value === "Mono") return 1;
  if (value === "Stereo") return 2;
  return Math.max(1, fallback);
}

function projectedVideoBitrate(value: string | undefined) {
  if (value === "Maximum quality") return 12_000_000;
  if (value === "High quality") return 8_000_000;
  if (value === "Small file") return 2_500_000;
  return 5_000_000;
}

function projectedAudioBitrate(value: string | undefined, channels: number) {
  const explicitKbps = Number(value?.match(/(\d+)\s*kbps/i)?.[1]);
  const bitrate = Number.isFinite(explicitKbps) && explicitKbps > 0 ? explicitKbps * 1000
    : value === "Maximum quality" ? 256_000
    : value === "High quality" ? 192_000
      : value === "Small file" ? 96_000
        : 160_000;
  return channels === 1 && !Number.isFinite(explicitKbps) ? Math.min(128_000, bitrate) : bitrate;
}

function projectedWavBytesPerSample(value: string | undefined) {
  if (value === "Maximum quality") return 4;
  if (value === "High quality") return 3;
  if (value === "Small file") return 1;
  return 2;
}

function projectedVideoFrameCount(inspection: FileInspection, settings?: ConversionSettings) {
  if (!settings) return undefined;
  const duration = selectedDuration(inspection.duration, settings);
  if (!duration) return undefined;
  if (settings.frameInterval === "Every frame") return Math.ceil(duration * 30);
  const interval = Number(settings.frameInterval?.match(/[\d.]+/)?.[0] ?? 1);
  return Math.ceil(duration / Math.max(0.05, interval));
}

function selectedFrameWidth(value: string | undefined, fallback: number) {
  if (!value || value.includes("Source")) return fallback;
  const width = Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(width) && width > 0 ? width : fallback;
}

function projectedRasterBytesPerPixel(format: string | undefined, compression: string | undefined) {
  const qualityIndex = compression === "Maximum quality" ? 0
    : compression === "High quality" ? 1
      : compression === "Small file" ? 3
        : 2;
  if (format === "JPEG") return [0.5, 0.4, 0.3, 0.2][qualityIndex];
  if (format === "WebP") return [0.4, 0.32, 0.24, 0.16][qualityIndex];
  return [2.4, 2.2, 2, 1.8][qualityIndex];
}

function estimateRange(seconds: number) {
  if (seconds <= 10) return "Usually under 10 seconds";
  if (seconds <= 30) return "Usually under 30 seconds";
  if (seconds <= 60) return "Usually under 1 minute";
  if (seconds <= 180) return "About 1-3 minutes";
  if (seconds <= 600) return "About 3-10 minutes";
  return "10+ minutes on this device";
}

function canUseCanvas() {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("2d"));
}

function canUseWebgl() {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}

function canEncodeImage(type: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  if (!canvas.toBlob) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    canvas.toBlob((blob) => resolve(Boolean(blob)), type, 0.8);
  });
}

async function canEncodeOpusAudio() {
  try {
    const media = await import("mediabunny");
    return media.canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: 160_000 });
  } catch {
    return false;
  }
}
