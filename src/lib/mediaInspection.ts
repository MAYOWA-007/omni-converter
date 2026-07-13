import type { FileFamily, FileInspection } from "./types";
import { hasBundledAudioEncoder } from "./audioEncoders";

export async function inspectMediaContainer(file: File, fallbackFamily: "audio" | "video"): Promise<Partial<FileInspection>> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) return unreadable(fallbackFamily);
    const [format, videoTrack, audioTrack] = await Promise.all([
      input.getFormat(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack()
    ]);
    if (!videoTrack && !audioTrack) return unreadable(fallbackFamily);

    const family: FileFamily = videoTrack ? "video" : "audio";
    const exactFormat = mediaFormatId(format.mimeType, family, file.name);
    const duration = await input.computeDuration();
    const [width, height, videoCodec, sampleRate, audioChannels, audioCodec, mp4Video, webmVideo, webmAudio] = await Promise.all([
      videoTrack?.getDisplayWidth(),
      videoTrack?.getDisplayHeight(),
      videoTrack?.getCodec(),
      audioTrack?.getSampleRate(),
      audioTrack?.getNumberOfChannels(),
      audioTrack?.getCodec(),
      media.getFirstEncodableVideoCodec(["avc"], { width: 640, height: 360 }),
      media.getFirstEncodableVideoCodec(["vp9", "vp8"], { width: 640, height: 360 }),
      media.getFirstEncodableAudioCodec(["opus"], { numberOfChannels: 1, sampleRate: 48_000 })
    ]);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const notes = [
      `${format.name} container: ${formatDuration(duration)}.`,
      ...(videoTrack ? [`Video: ${width} x ${height}${videoCodec ? ` / ${videoCodec}` : ""}.`] : []),
      ...(audioTrack ? [`Audio: ${sampleRate} Hz / ${audioChannels} channel${audioChannels === 1 ? "" : "s"}${audioCodec ? ` / ${audioCodec}` : ""}.`] : []),
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
    return unreadable(fallbackFamily);
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
  if (mimeType === "video/mp4") {
    const extension = name.split(".").pop()?.toLowerCase();
    if (family === "audio" && extension === "m4a") return "m4a";
    if (extension === "m4v") return "m4v";
    return "mp4";
  }
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/x-matroska") return "mkv";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/ogg" || mimeType === "application/ogg") return "ogg";
  if (mimeType === "audio/flac") return "flac";
  if (mimeType === "audio/aac") return "aac";
  if (mimeType === "video/mp2t") return "ts";
  return "unrecognized-media";
}

function extensionsMatch(format: string, extension: string) {
  if (format === "mp4") return ["mp4", "m4a", "m4v"].includes(extension);
  return format === extension;
}

function unreadable(family: "audio" | "video"): Partial<FileInspection> {
  return { family, exactFormat: "unrecognized-media", signatureSource: "unknown", notes: ["The media container could not be parsed, so conversion options are unavailable."] };
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
