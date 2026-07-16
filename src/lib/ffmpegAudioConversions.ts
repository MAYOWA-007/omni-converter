import type { LegacyExecutionContext } from "../engines/types";
import { baseFileName, type ConversionOutput } from "./conversionHelpers";
import { getFfmpegCoreAssets } from "./ffmpegRuntime";
import { resolveMediaTrimRange } from "./mediaTrim";
import type { ConversionSettings, FileInspection } from "./types";

export const FFMPEG_AUDIO_RECIPE_IDS = new Set([
  "audio-to-aiff",
  "audio-to-alac",
  "audio-to-caf",
  "audio-to-ac3",
  "audio-to-eac3",
  "audio-to-vorbis",
  "audio-to-wma",
  "audio-to-wavpack",
  "audio-to-tta",
  "audio-to-mp2",
  "audio-to-au",
  "audio-to-wave64",
  "audio-to-pcm",
  "audio-to-3gp"
]);

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

interface FfmpegAudioSpec {
  extension: string;
  mime: string;
  maxChannels: number;
  preferredSampleRate?: number;
  outputArgs: string[];
}

let ffmpegPromise: Promise<FFmpegInstance> | undefined;
let jobTail: Promise<void> = Promise.resolve();
let jobCounter = 0;

export function canConvertFfmpegAudioRecipe(recipeId: string) {
  return FFMPEG_AUDIO_RECIPE_IDS.has(recipeId);
}

export async function convertFfmpegAudioRecipe(
  file: File,
  inspection: FileInspection,
  recipeId: string,
  settings: ConversionSettings,
  execution?: LegacyExecutionContext
): Promise<ConversionOutput> {
  return enqueueFfmpegJob(() => runFfmpegAudioConversion(file, inspection, recipeId, settings, execution));
}

export interface FfmpegAudioInspection {
  duration?: number;
  sampleRate?: number;
  audioChannels?: number;
  audioCodec?: string;
  containerFormat?: string;
}

export function inspectFfmpegAudio(file: File, signal?: AbortSignal): Promise<FfmpegAudioInspection> {
  throwIfAborted(signal);
  return enqueueFfmpegJob(() => runFfmpegAudioInspection(file, signal));
}

export function normalizeAudioForBrowser(file: File, execution?: LegacyExecutionContext): Promise<File> {
  return enqueueFfmpegJob(() => runFfmpegAudioNormalization(file, execution));
}

function enqueueFfmpegJob<T>(run: () => Promise<T>) {
  const job = jobTail.then(run, run);
  jobTail = job.then(() => undefined, () => undefined);
  return job;
}

async function runFfmpegAudioConversion(
  file: File,
  inspection: FileInspection,
  recipeId: string,
  settings: ConversionSettings,
  execution?: LegacyExecutionContext
) {
  throwIfAborted(execution?.signal);
  if (!inspection.duration) throw new Error("The audio track has no positive duration.");

  const spec = ffmpegAudioSpec(recipeId, settings);
  const range = resolveMediaTrimRange(settings, inspection.duration);
  const channels = selectedChannels(settings.audioChannels, inspection.audioChannels, spec.maxChannels);
  const sampleRate = selectedSampleRate(settings.sampleRate, inspection.sampleRate, spec.preferredSampleRate);
  const id = `${Date.now().toString(36)}-${(++jobCounter).toString(36)}`;
  const sourceExtension = file.name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? "wav";
  const inputName = `input-${id}.${sourceExtension}`;
  const outputName = `output-${id}.${spec.extension}`;
  const ffmpeg = await getFfmpeg();
  let aborted = false;
  const logs: string[] = [];

  const abort = () => {
    aborted = true;
    ffmpeg.terminate();
    ffmpegPromise = undefined;
  };
  const progress = ({ progress: value }: { progress: number }) => {
    const completed = 10 + Math.max(0, Math.min(1, value)) * 85;
    execution?.reportProgress({ completed, total: 100, label: `Encoding ${spec.extension.toUpperCase()} audio` });
  };
  const log = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 8) logs.shift();
  };

  execution?.signal.addEventListener("abort", abort, { once: true });
  ffmpeg.on("progress", progress);
  ffmpeg.on("log", log);
  try {
    throwIfAborted(execution?.signal);
    execution?.reportProgress({ completed: 4, total: 100, label: "Loading the local audio engine" });
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    throwIfAborted(execution?.signal);
    execution?.reportProgress({ completed: 10, total: 100, label: `Encoding ${spec.extension.toUpperCase()} audio` });

    const args = ffmpegAudioArgs(inputName, outputName, spec, range, channels, sampleRate, settings);
    const exitCode = await ffmpeg.exec(args, 180_000, { signal: execution?.signal });
    if (exitCode !== 0) throw new Error(`${spec.extension.toUpperCase()} encoding failed with code ${exitCode}${logs.length ? `: ${logs.join(" ")}` : "."}`);
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error(`${spec.extension.toUpperCase()} encoding returned text instead of audio bytes.`);
    const bytes = Uint8Array.from(data);
    if (bytes.length === 0) throw new Error(`${spec.extension.toUpperCase()} encoding produced no output bytes.`);

    const suffix = settings.batchNaming === "Clean filename" ? "" : recipeId === "audio-to-alac" ? "-alac" : "-converted";
    return {
      name: `${baseFileName(file.name, "converted-audio")}${suffix}.${spec.extension}`,
      blob: new Blob([bytes], { type: spec.mime })
    };
  } catch (error) {
    if (aborted || execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
    throw error;
  } finally {
    ffmpeg.off("progress", progress);
    ffmpeg.off("log", log);
    execution?.signal.removeEventListener("abort", abort);
    if (!aborted) {
      await Promise.all([
        ffmpeg.deleteFile(inputName).catch(() => undefined),
        ffmpeg.deleteFile(outputName).catch(() => undefined)
      ]);
    }
  }
}

async function runFfmpegAudioInspection(file: File, signal?: AbortSignal): Promise<FfmpegAudioInspection> {
  throwIfAborted(signal);
  const id = `${Date.now().toString(36)}-${(++jobCounter).toString(36)}`;
  const sourceExtension = file.name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? "bin";
  const inputName = `probe-input-${id}.${sourceExtension}`;
  const ffmpeg = await getFfmpeg();
  throwIfAborted(signal);
  let aborted = false;
  const logs: string[] = [];
  const log = ({ message }: { message: string }) => logs.push(message);
  const abort = () => {
    aborted = true;
    ffmpeg.terminate();
    ffmpegPromise = undefined;
  };
  signal?.addEventListener("abort", abort, { once: true });
  ffmpeg.on("log", log);
  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    const exitCode = await ffmpeg.exec([
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "info",
      "-i",
      inputName,
      "-map",
      "0:a:0",
      "-frames:a",
      "1",
      "-f",
      "null",
      "-"
    ], 60_000, { signal });
    if (exitCode !== 0) throw new Error(`Audio inspection failed with code ${exitCode}.`);
    return parseFfmpegAudioInspection(logs);
  } catch (error) {
    if (aborted || signal?.aborted) throw new DOMException("Inspection was cancelled.", "AbortError");
    throw error;
  } finally {
    ffmpeg.off("log", log);
    signal?.removeEventListener("abort", abort);
    if (!aborted) await ffmpeg.deleteFile(inputName).catch(() => undefined);
  }
}

async function runFfmpegAudioNormalization(file: File, execution?: LegacyExecutionContext): Promise<File> {
  throwIfAborted(execution?.signal);
  const id = `${Date.now().toString(36)}-${(++jobCounter).toString(36)}`;
  const sourceExtension = file.name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? "bin";
  const inputName = `decode-input-${id}.${sourceExtension}`;
  const outputName = `decode-output-${id}.wav`;
  const ffmpeg = await getFfmpeg();
  let aborted = false;
  const logs: string[] = [];
  const abort = () => {
    aborted = true;
    ffmpeg.terminate();
    ffmpegPromise = undefined;
  };
  const progress = ({ progress: value }: { progress: number }) => {
    execution?.reportProgress({ completed: 4 + Math.max(0, Math.min(1, value)) * 20, total: 100, label: "Preparing the source audio" });
  };
  const log = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 8) logs.shift();
  };

  execution?.signal.addEventListener("abort", abort, { once: true });
  ffmpeg.on("progress", progress);
  ffmpeg.on("log", log);
  try {
    execution?.reportProgress({ completed: 2, total: 100, label: "Loading the audio compatibility engine" });
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    throwIfAborted(execution?.signal);
    const exitCode = await ffmpeg.exec([
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputName,
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "pcm_s16le",
      "-f",
      "wav",
      outputName
    ], 180_000, { signal: execution?.signal });
    if (exitCode !== 0) throw new Error(`Audio decoding failed with code ${exitCode}${logs.length ? `: ${logs.join(" ")}` : "."}`);
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error("Audio decoding returned text instead of WAV bytes.");
    const bytes = Uint8Array.from(data);
    if (bytes.length <= 44) throw new Error("Audio decoding produced no usable samples.");
    return new File([bytes], `${baseFileName(file.name, "decoded-audio")}.wav`, { type: "audio/wav" });
  } catch (error) {
    if (aborted || execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
    throw error;
  } finally {
    ffmpeg.off("progress", progress);
    ffmpeg.off("log", log);
    execution?.signal.removeEventListener("abort", abort);
    if (!aborted) {
      await Promise.all([
        ffmpeg.deleteFile(inputName).catch(() => undefined),
        ffmpeg.deleteFile(outputName).catch(() => undefined)
      ]);
    }
  }
}

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, assets] = await Promise.all([import("@ffmpeg/ffmpeg"), getFfmpegCoreAssets()]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load(assets);
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = undefined;
      throw error;
    });
  }
  return ffmpegPromise;
}

function ffmpegAudioArgs(
  inputName: string,
  outputName: string,
  spec: FfmpegAudioSpec,
  range: { start: number; duration: number },
  channels: number,
  sampleRate: number,
  settings: ConversionSettings
) {
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", inputName];
  if (range.start > 0) args.push("-ss", preciseNumber(range.start));
  args.push("-t", preciseNumber(range.duration), "-map", "0:a:0", "-vn", "-ac", String(channels), "-ar", String(sampleRate));
  if (settings.metadata === "Strip tags") args.push("-map_metadata", "-1");
  args.push(...spec.outputArgs, outputName);
  return args;
}

function ffmpegAudioSpec(recipeId: string, settings: ConversionSettings): FfmpegAudioSpec {
  const bitrate = ffmpegAudioBitrate(settings.compression);
  if (recipeId === "audio-to-aiff") {
    return { extension: "aiff", mime: "audio/aiff", maxChannels: 8, outputArgs: ["-c:a", bigEndianPcmCodec(settings.bitDepth), "-f", "aiff"] };
  }
  if (recipeId === "audio-to-alac") {
    return { extension: "m4a", mime: "audio/mp4", maxChannels: 8, outputArgs: ["-c:a", "alac", "-sample_fmt", settings.bitDepth === "24-bit lossless" ? "s32p" : "s16p", "-f", "ipod"] };
  }
  if (recipeId === "audio-to-caf") {
    const selected = settings.outputFormat ?? "24-bit PCM in CAF";
    const codec = selected === "ALAC in CAF" ? "alac" : selected === "16-bit PCM in CAF" ? "pcm_s16be" : selected === "32-bit float in CAF" ? "pcm_f32be" : "pcm_s24be";
    return { extension: "caf", mime: "audio/x-caf", maxChannels: 8, outputArgs: ["-c:a", codec, "-f", "caf"] };
  }
  if (recipeId === "audio-to-ac3") {
    return { extension: "ac3", mime: "audio/ac3", maxChannels: 6, preferredSampleRate: 48_000, outputArgs: ["-c:a", "ac3", "-b:a", bitrate, "-f", "ac3"] };
  }
  if (recipeId === "audio-to-eac3") {
    return { extension: "eac3", mime: "audio/eac3", maxChannels: 6, preferredSampleRate: 48_000, outputArgs: ["-c:a", "eac3", "-b:a", bitrate, "-f", "eac3"] };
  }
  if (recipeId === "audio-to-vorbis") {
    return { extension: "oga", mime: "audio/ogg", maxChannels: 2, preferredSampleRate: 48_000, outputArgs: ["-c:a", "libvorbis", "-b:a", bitrate, "-f", "oga"] };
  }
  if (recipeId === "audio-to-wma") {
    return { extension: "wma", mime: "audio/x-ms-wma", maxChannels: 2, preferredSampleRate: 44_100, outputArgs: ["-c:a", "wmav2", "-b:a", bitrate, "-f", "asf"] };
  }
  if (recipeId === "audio-to-wavpack") {
    return { extension: "wv", mime: "audio/wavpack", maxChannels: 8, outputArgs: ["-c:a", "wavpack", "-compression_level", losslessCompressionLevel(settings.compression), "-f", "wv"] };
  }
  if (recipeId === "audio-to-tta") {
    return { extension: "tta", mime: "audio/x-tta", maxChannels: 8, outputArgs: ["-c:a", "tta", "-f", "tta"] };
  }
  if (recipeId === "audio-to-mp2") {
    return { extension: "mp2", mime: "audio/mpeg", maxChannels: 2, preferredSampleRate: 48_000, outputArgs: ["-c:a", "mp2", "-b:a", bitrate, "-f", "mp2"] };
  }
  if (recipeId === "audio-to-au") {
    const codec = settings.outputFormat === "G.711 A-law" ? "pcm_alaw" : settings.outputFormat === "G.711 mu-law" ? "pcm_mulaw" : "pcm_s16be";
    return { extension: "au", mime: "audio/basic", maxChannels: 2, outputArgs: ["-c:a", codec, "-f", "au"] };
  }
  if (recipeId === "audio-to-wave64") {
    return { extension: "w64", mime: "audio/x-w64", maxChannels: 8, outputArgs: ["-c:a", littleEndianPcmCodec(settings.bitDepth), "-f", "w64"] };
  }
  if (recipeId === "audio-to-pcm") {
    const format = settings.outputFormat === "24-bit little-endian" ? "s24le" : settings.outputFormat === "32-bit float little-endian" ? "f32le" : "s16le";
    return { extension: "pcm", mime: "audio/pcm", maxChannels: 8, outputArgs: ["-c:a", `pcm_${format}`, "-f", format] };
  }
  if (recipeId === "audio-to-3gp") {
    return { extension: "3gp", mime: "audio/3gpp", maxChannels: 2, preferredSampleRate: 44_100, outputArgs: ["-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", "-f", "3gp"] };
  }
  throw new Error(`Unknown FFmpeg audio recipe: ${recipeId}`);
}

function selectedChannels(value: string | undefined, sourceChannels = 2, maxChannels = 2) {
  if (value === "Mono") return 1;
  if (value === "Stereo") return Math.min(2, maxChannels);
  return Math.max(1, Math.min(maxChannels, sourceChannels));
}

function selectedSampleRate(value: string | undefined, sourceSampleRate = 44_100, preferred?: number) {
  if (value && value !== "Source sample rate") {
    const number = Number(value.match(/[\d.]+/)?.[0]);
    if (Number.isFinite(number) && number > 0) return Math.round(number * 1000);
  }
  return preferred ?? sourceSampleRate;
}

function ffmpegAudioBitrate(value?: string) {
  const explicit = Number(value?.match(/(\d+)\s*kbps/i)?.[1]);
  if (Number.isFinite(explicit) && explicit > 0) return `${explicit}k`;
  if (value === "Maximum quality") return "320k";
  if (value === "High quality") return "256k";
  if (value === "Small file") return "96k";
  return "192k";
}

function bigEndianPcmCodec(value?: string) {
  if (value === "24-bit PCM") return "pcm_s24be";
  if (value === "32-bit float") return "pcm_f32be";
  return "pcm_s16be";
}

function littleEndianPcmCodec(value?: string) {
  if (value === "24-bit PCM") return "pcm_s24le";
  if (value === "32-bit float") return "pcm_f32le";
  return "pcm_s16le";
}

function losslessCompressionLevel(value?: string) {
  if (value === "Maximum compression") return "8";
  if (value === "Fast") return "1";
  return "4";
}

function preciseNumber(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

function parseFfmpegAudioInspection(logs: readonly string[]): FfmpegAudioInspection {
  const text = logs.join("\n");
  const containerMatch = /Input #0,\s*(.+?),\s*from\s/i.exec(text);
  const durationMatch = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i.exec(text);
  const audioLine = text.split(/\r?\n/).find((line) => /Stream #.*Audio:/i.test(line));
  const streamMatch = audioLine && /Audio:\s*([^,]+),\s*(\d+)\s*Hz,\s*([^,]+)/i.exec(audioLine);
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : undefined;
  const channelLabel = streamMatch?.[3]?.trim().toLowerCase();
  const audioChannels = channelLabel === "mono" ? 1
    : channelLabel === "stereo" ? 2
      : channelLabel?.match(/^(\d+)\.(\d+)/) ? Number(channelLabel.match(/^(\d+)\.(\d+)/)?.[1]) + Number(channelLabel.match(/^(\d+)\.(\d+)/)?.[2])
        : channelLabel?.match(/^\d+$/) ? Number(channelLabel)
          : undefined;
  if (!streamMatch) throw new Error("FFmpeg found no readable audio stream.");
  return {
    duration: Number.isFinite(duration) && duration! > 0 ? duration : undefined,
    sampleRate: Number(streamMatch[2]),
    audioChannels,
    audioCodec: streamMatch[1].trim(),
    containerFormat: containerMatch?.[1].trim()
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
}
