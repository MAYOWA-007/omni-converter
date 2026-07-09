import type { Capability, ConversionRecipe, DeviceProfile, FileInspection, Intensity, PreflightResult } from "./types";

declare global {
  interface Navigator {
    deviceMemory?: number;
    storage?: StorageManager;
  }
}

export async function getDeviceProfile(): Promise<DeviceProfile> {
  const storage = await navigator.storage?.estimate?.().catch(() => undefined);
  const [webpEncoder, avifEncoder] = await Promise.all([canEncodeImage("image/webp"), canEncodeImage("image/avif")]);
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

export function preflightRecipe(recipe: ConversionRecipe, inspection: FileInspection, device: DeviceProfile): PreflightResult {
  const reasons: string[] = [];
  const missing = recipe.requiredCapabilities.filter((capability) => !device.supports[capability]);
  const availableStorage = device.storageQuota && device.storageUsage ? device.storageQuota - device.storageUsage : undefined;

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

  if (availableStorage && inspection.size * 3 > availableStorage) {
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

  if (missing.length || reasons.some((reason) => reason.includes("blocked") || reason.includes("Not enough"))) {
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
    estimate: estimateTime(recipe.intensity, inspection.size),
    reasons: slow ? reasons.map(toUserReason).concat("This conversion may take a while.") : []
  };
}

function toUserReason(reason: string) {
  return reason
    .replace("This browser is missing: webpEncoder.", "This browser cannot export WebP images.")
    .replace("This browser is missing: avifEncoder.", "This browser cannot export AVIF images.")
    .replace("Not enough browser storage headroom for temporary files and output bundles.", "There is not enough browser storage for this file.")
    .replace("Large video files over 2.5 GB are blocked in this version.", "This video is too large for this version.")
    .replace("This is a heavy media recipe and this device reports fewer than 6 CPU threads.", "This device is below the recommended speed for this media task.")
    .replace("This device reports less than 4 GB memory.", "This device may not have enough memory for this file.");
}

function shouldWarnSlow(intensity: Intensity, cores: number, memoryGb: number | undefined, size: number) {
  if (intensity === "light") return false;
  if (intensity === "standard") return cores < 4 || size > 750_000_000;
  if (intensity === "heavy") return cores < 6 || Boolean(memoryGb && memoryGb < 8) || size > 1_000_000_000;
  return cores < 8 || Boolean(memoryGb && memoryGb < 8) || size > 500_000_000;
}

function estimateTime(intensity: Intensity, size: number) {
  const mb = size / 1_000_000;
  if (intensity === "light") return mb < 50 ? "A few seconds" : "Under 1 minute";
  if (intensity === "standard") return mb < 250 ? "1-3 minutes" : "3-10 minutes";
  if (intensity === "heavy") return mb < 250 ? "3-8 minutes" : "10-30 minutes";
  return mb < 500 ? "10-30 minutes" : "30+ minutes on many PCs";
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
