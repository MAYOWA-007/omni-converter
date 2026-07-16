import type { FileFamily, FileInspection } from "./types";
import { hasBundledAudioEncoder } from "./audioEncoders";
import { inspectFfmpegAudio } from "./ffmpegAudioConversions";

export async function inspectMediaContainer(file: File, fallbackFamily: "audio" | "video"): Promise<Partial<FileInspection>> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) return fallbackMediaInspection(file, fallbackFamily);
    const [format, videoTrack, audioTrack] = await Promise.all([
      input.getFormat(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack()
    ]);
    if (!videoTrack && !audioTrack) return fallbackMediaInspection(file, fallbackFamily);

    const family: FileFamily = videoTrack ? "video" : "audio";
    const exactFormat = mediaFormatId(format.mimeType, family, file.name);
    const duration = await input.computeDuration();
    const [width, height, videoCodec, sampleRate, audioChannels, audioCodec, videoDecodable, audioDecodable, mp4Video, webmVideo, webmAudio] = await Promise.all([
      videoTrack?.getDisplayWidth(),
      videoTrack?.getDisplayHeight(),
      videoTrack?.getCodec(),
      audioTrack?.getSampleRate(),
      audioTrack?.getNumberOfChannels(),
      audioTrack?.getCodec(),
      videoTrack?.canDecode(),
      audioTrack?.canDecode(),
      media.getFirstEncodableVideoCodec(["avc"], { width: 640, height: 360 }),
      media.getFirstEncodableVideoCodec(["vp9", "vp8"], { width: 640, height: 360 }),
      media.getFirstEncodableAudioCodec(["opus"], { numberOfChannels: 1, sampleRate: 48_000 })
    ]);
    if (videoTrack && !videoDecodable) return unreadable("video");
    if (audioTrack && !audioDecodable) return videoTrack ? unreadable("video") : fallbackMediaInspection(file, "audio");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const notes = [
      `${format.name} container: ${formatDuration(duration)}.`,
      ...(videoTrack ? [`Video: ${width} x ${height}${videoCodec ? ` / ${videoCodec}` : ""}.`] : []),
      ...(audioTrack ? [`Audio: ${sampleRate} Hz / ${audioChannels} channel${audioChannels === 1 ? "" : "s"}${audioCodec ? ` / ${audioCodec}` : ""}.`] : []),
      "Decode path: browser.",
      ...(extension && !extensionsMatch(exactFormat, extension) ? [`File extension .${extension} does not match detected ${exactFormat.toUpperCase()} media content.`] : [])
    ];
    return {
      family,
      exactFormat,
      signatureSource: "signature",
      duration,
      width,
      height,
      videoCodec: videoCodec ?? undefined,
      sampleRate,
      audioChannels,
      audioCodec: audioCodec ?? undefined,
      mediaTargets: { mp4: Boolean(mp4Video && hasBundledAudioEncoder("aac")), webm: Boolean(webmVideo && webmAudio) },
      notes
    };
  } catch {
    return fallbackMediaInspection(file, fallbackFamily);
  } finally {
    input.dispose();
  }
}

export async function sampleMediaTimelinePeaks(file: File, pointCount = 180, signal?: AbortSignal) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) return [];
    const track = await input.getPrimaryAudioTrack();
    if (!track) return [];
    const duration = await input.computeDuration([track]);
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const count = Math.max(24, Math.min(320, Math.round(pointCount)));
    const lastTimestamp = Math.max(0, duration - 0.001);
    const timestamps = Array.from({ length: count }, (_, index) => Math.min(lastTimestamp, ((index + 0.5) / count) * duration));
    const sink = new media.AudioBufferSink(track);
    const peaks: number[] = [];
    for await (const wrapped of sink.buffersAtTimestamps(timestamps)) {
      throwIfTimelineAborted(signal);
      if (!wrapped) {
        peaks.push(0);
        continue;
      }
      const buffer = wrapped.buffer;
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const values = buffer.getChannelData(channel);
        const stride = Math.max(1, Math.floor(values.length / 256));
        for (let index = 0; index < values.length; index += stride) peak = Math.max(peak, Math.abs(values[index]));
      }
      peaks.push(peak);
    }
    const maximum = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => peak / maximum);
  } finally {
    input.dispose();
  }
}

function mediaFormatId(mimeType: string, family: FileFamily, name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType === "video/mp4") {
    if (family === "audio" && ["m4a", "m4r", "3gp"].includes(extension)) return extension;
    if (extension === "m4v") return "m4v";
    return "mp4";
  }
  if (normalizedMimeType === "video/quicktime") return "mov";
  if (normalizedMimeType === "video/webm") return "webm";
  if (normalizedMimeType === "video/x-matroska") return family === "audio" && extension === "mka" ? "mka" : "mkv";
  if (normalizedMimeType === "audio/mp4") return ["m4r", "3gp"].includes(extension) ? extension : "m4a";
  if (normalizedMimeType === "audio/mpeg") return extension === "mp2" ? "mp2" : "mp3";
  if (normalizedMimeType === "audio/wav") return "wav";
  if (normalizedMimeType === "audio/ogg" || normalizedMimeType === "application/ogg") return ["oga", "opus"].includes(extension) ? extension : "ogg";
  if (normalizedMimeType === "audio/flac") return "flac";
  if (normalizedMimeType === "audio/aac") return "aac";
  if (normalizedMimeType === "video/mp2t") return "ts";
  if (family === "audio" && AUDIO_EXTENSION_FORMATS[extension]) return AUDIO_EXTENSION_FORMATS[extension];
  return "unrecognized-media";
}

function extensionsMatch(format: string, extension: string) {
  if (format === "mp4") return ["mp4", "m4a", "m4v"].includes(extension);
  return format === extension;
}

function unreadable(family: "audio" | "video"): Partial<FileInspection> {
  return { family, exactFormat: "unrecognized-media", signatureSource: "unknown", notes: ["The media container could not be parsed, so conversion options are unavailable."] };
}

const AUDIO_EXTENSION_FORMATS: Readonly<Record<string, string>> = {
  wav: "wav", mp3: "mp3", mp2: "mp2", flac: "flac", m4a: "m4a", m4r: "m4r", aac: "aac",
  ogg: "ogg", oga: "oga", opus: "opus", webm: "webm", mka: "mka", mov: "mov",
  aif: "aiff", aiff: "aiff", aifc: "aiff", caf: "caf", ac3: "ac3", eac3: "eac3", ec3: "eac3",
  wma: "wma", asf: "wma", wv: "wv", tta: "tta", au: "au", snd: "au", w64: "w64", "3gp": "3gp"
};

async function fallbackMediaInspection(file: File, family: "audio" | "video"): Promise<Partial<FileInspection>> {
  if (family !== "audio") return unreadable(family);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const exactFormat = AUDIO_EXTENSION_FORMATS[extension];
  if (!exactFormat) return unreadable(family);
  try {
    const facts = await inspectFfmpegAudio(file);
    return {
      family: "audio",
      exactFormat,
      signatureSource: "signature",
      ...facts,
      notes: [
        `Audio container: ${facts.containerFormat ?? exactFormat}; ${formatDuration(facts.duration ?? Number.NaN)}.`,
        `Audio: ${facts.sampleRate ?? "unknown"} Hz / ${facts.audioChannels ?? "unknown"} channels${facts.audioCodec ? ` / ${facts.audioCodec}` : ""}.`,
        "Decode path: FFmpeg WASM."
      ]
    };
  } catch {
    return unreadable(family);
  }
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown duration";
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(seconds < 10 ? 2 : 0).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function throwIfTimelineAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Timeline analysis was cancelled.", "AbortError");
}
