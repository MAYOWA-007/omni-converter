import type { ConversionSettings } from "./types";

export interface ResolvedMediaTrimRange {
  start: number;
  end: number;
  duration: number;
}

export function resolveMediaTrimRange(settings: ConversionSettings, sourceDuration: number): ResolvedMediaTrimRange {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    throw new Error("The media track has no positive duration.");
  }

  const presetSeconds = Number(settings.trim?.match(/First\s+([\d.]+)\s+second/i)?.[1]);
  if (Number.isFinite(presetSeconds) && presetSeconds > 0) {
    const end = Math.min(sourceDuration, presetSeconds);
    return { start: 0, end, duration: end };
  }

  if (settings.trim !== "Custom range") {
    return { start: 0, end: sourceDuration, duration: sourceDuration };
  }

  const requestedStart = settings.trimStart ?? 0;
  const requestedEnd = settings.trimEnd ?? sourceDuration;
  if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd)) {
    throw new Error("Custom trim bounds must be finite numbers.");
  }
  const start = Math.min(sourceDuration, Math.max(0, requestedStart));
  const end = Math.min(sourceDuration, Math.max(0, requestedEnd));
  if (end <= start) {
    throw new Error("Custom trim end must be after trim start.");
  }
  return { start, end, duration: end - start };
}
