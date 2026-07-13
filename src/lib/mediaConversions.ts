import { baseFileName, canvasToBlob, escapeHtml, zipLevelFromCompression, zipOutputs, type ConversionOutput } from "./conversionHelpers";
import { ensureAudioEncoder } from "./audioEncoders";
import { canConvertFfmpegAudioRecipe, convertFfmpegAudioRecipe, FFMPEG_AUDIO_RECIPE_IDS } from "./ffmpegAudioConversions";
import { resolveMediaTrimRange } from "./mediaTrim";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";
import type { LegacyExecutionContext } from "../engines/types";

const MEDIA_RECIPE_IDS = new Set([
  ...FFMPEG_AUDIO_RECIPE_IDS,
  "audio-to-wav",
  "audio-to-mp3",
  "audio-to-flac",
  "audio-to-m4a",
  "audio-to-aac",
  "audio-to-ogg",
  "audio-to-opus",
  "audio-to-webm",
  "audio-to-mka",
  "audio-to-mov",
  "audio-to-m4r",
  "audio-format-bundle",
  "audio-waveform",
  "audio-to-video",
  "video-to-frames",
  "video-thumbnail-sheet",
  "video-to-mp4",
  "video-to-webm",
  "video-to-audio"
]);

export function canConvertMediaRecipe(recipe: ConversionRecipe) {
  return MEDIA_RECIPE_IDS.has(recipe.id);
}

export async function convertMediaRecipe(
  file: File,
  inspection: FileInspection,
  recipe: ConversionRecipe,
  settings: ConversionSettings = {},
  execution?: LegacyExecutionContext
): Promise<ConversionOutput[]> {
  throwIfAborted(execution?.signal);
  const baseName = baseFileName(file.name, "converted-media");
  execution?.reportProgress({ completed: 0, total: 100, label: "Reading media container" });
  let output: ConversionOutput;
  if (canConvertFfmpegAudioRecipe(recipe.id)) {
    output = await convertFfmpegAudioRecipe(file, inspection, recipe.id, settings, execution);
  } else {
    switch (recipe.id) {
      case "audio-to-wav":
        output = await convertAudioToWav(file, baseName, settings, execution);
        break;
      case "audio-to-mp3":
      case "audio-to-flac":
      case "audio-to-m4a":
      case "audio-to-aac":
      case "audio-to-ogg":
      case "audio-to-opus":
      case "audio-to-webm":
      case "audio-to-mka":
      case "audio-to-mov":
      case "audio-to-m4r":
        output = await convertAudioToFormat(file, baseName, recipe.id, settings, execution);
        break;
      case "audio-format-bundle":
        output = await createAudioFormatBundle(file, inspection, baseName, settings, execution);
        break;
      case "audio-to-video":
        output = await createAudioVideo(file, baseName, settings, execution);
        break;
      case "audio-waveform":
        output = await createWaveformOutput(file, baseName, settings, execution);
        break;
      case "video-to-frames":
        output = await createVideoFrames(file, baseName, settings, execution);
        break;
      case "video-thumbnail-sheet":
        output = await createVideoContactSheet(file, baseName, settings, execution);
        break;
      case "video-to-mp4":
        output = await transcodeVideo(file, baseName, settings, "mp4", execution);
        break;
      case "video-to-webm":
        output = await transcodeVideo(file, baseName, settings, "webm", execution);
        break;
      case "video-to-audio":
        output = await extractVideoAudio(file, baseName, settings, execution);
        break;
      default:
        throw new Error("This media converter is not available.");
    }
  }
  throwIfAborted(execution?.signal);
  execution?.reportProgress({ completed: 100, total: 100, label: "Media conversion complete" });
  return [output];
}

async function convertAudioToWav(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  const target = new media.BufferTarget();
  try {
    if (!await input.canRead()) throw new Error("The audio container could not be parsed.");
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("The media file has no readable audio track.");
    const range = resolveMediaTrimRange(settings, await input.computeDuration([track]));
    const output = new media.Output({ format: new media.WavOutputFormat(), target });
    const conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: {
        codec: wavCodec(settings.bitDepth),
        sampleRate: sampleRateValue(settings.sampleRate),
        numberOfChannels: channelCount(settings.audioChannels),
        sampleFormat: wavSampleFormat(settings.bitDepth),
        forceTranscode: true
      },
      trim: { start: range.start, end: range.end },
      tags: settings.metadata === "Strip tags" ? {} : undefined,
      showWarnings: false
    });
    if (!conversion.isValid) throw new Error(`WAV conversion is unavailable: ${conversion.discardedTracks.map((entry) => entry.reason).join(", ") || "no usable audio track"}.`);
    const cancel = () => void conversion.cancel();
    execution?.signal.addEventListener("abort", cancel, { once: true });
    conversion.onProgress = (progress) => execution?.reportProgress({ completed: 10 + progress * 85, total: 100, label: "Encoding WAV audio" });
    try {
      await conversion.execute();
    } finally {
      execution?.signal.removeEventListener("abort", cancel);
    }
    if (!target.buffer) throw new Error("WAV conversion produced no output bytes.");
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
    return { name: `${baseName}${suffix}.wav`, blob: new Blob([target.buffer], { type: "audio/wav" }) };
  } finally {
    input.dispose();
  }
}

interface AudioTargetSpec {
  codec: import("mediabunny").AudioCodec;
  extension: string;
  format: import("mediabunny").OutputFormat;
  maxChannels: number;
  mime: string;
  preferredSampleRate?: number;
  sampleFormat?: "s16" | "s32";
}

async function convertAudioToFormat(
  file: File,
  baseName: string,
  recipeId: string,
  settings: ConversionSettings,
  execution?: LegacyExecutionContext
): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  const target = new media.BufferTarget();
  try {
    if (!await input.canRead()) throw new Error("The audio container could not be parsed.");
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("The media file has no readable audio track.");
    const spec = audioTargetSpec(media, recipeId, settings);
    const [sourceDuration, sourceChannels, sourceSampleRate] = await Promise.all([
      input.computeDuration([track]),
      track.getNumberOfChannels(),
      track.getSampleRate()
    ]);
    const range = resolveMediaTrimRange(settings, sourceDuration);
    const channels = channelCount(settings.audioChannels) ?? Math.min(spec.maxChannels, sourceChannels);
    const sampleRate = sampleRateValue(settings.sampleRate) ?? spec.preferredSampleRate ?? sourceSampleRate;
    const bitrate = audioBitrate(settings.compression, channels);
    await ensureAudioEncoder(media, spec.codec, { numberOfChannels: channels, sampleRate, bitrate });

    const output = new media.Output({ format: spec.format, target });
    const conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: {
        codec: spec.codec,
        sampleRate,
        numberOfChannels: channels,
        sampleFormat: spec.sampleFormat,
        bitrate: isLosslessAudioCodec(spec.codec) ? undefined : bitrate,
        forceTranscode: true
      },
      trim: { start: range.start, end: range.end },
      tags: settings.metadata === "Strip tags" ? {} : undefined,
      showWarnings: false
    });
    if (!conversion.isValid) {
      throw new Error(`${spec.extension.toUpperCase()} conversion is unavailable: ${conversion.discardedTracks.map((entry) => entry.reason).join(", ") || "no usable audio track"}.`);
    }
    const cancel = () => void conversion.cancel();
    execution?.signal.addEventListener("abort", cancel, { once: true });
    conversion.onProgress = (progress) => execution?.reportProgress({ completed: 10 + progress * 85, total: 100, label: `Encoding ${spec.extension.toUpperCase()} audio` });
    try {
      await conversion.execute();
    } catch (error) {
      if (execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
      throw error;
    } finally {
      execution?.signal.removeEventListener("abort", cancel);
    }
    if (!target.buffer) throw new Error(`${spec.extension.toUpperCase()} conversion produced no output bytes.`);
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
    return { name: `${baseName}${suffix}.${spec.extension}`, blob: new Blob([target.buffer], { type: spec.mime }) };
  } finally {
    input.dispose();
  }
}

async function createAudioFormatBundle(
  file: File,
  inspection: FileInspection,
  baseName: string,
  settings: ConversionSettings,
  execution?: LegacyExecutionContext
) {
  const recipeIds = [
    "audio-to-aac",
    "audio-to-ac3",
    "audio-to-aiff",
    "audio-to-alac",
    "audio-to-au",
    "audio-to-caf",
    "audio-to-eac3",
    "audio-to-flac",
    "audio-to-m4a",
    "audio-to-m4r",
    "audio-to-mka",
    "audio-to-mov",
    "audio-to-mp2",
    "audio-to-mp3",
    "audio-to-ogg",
    "audio-to-opus",
    "audio-to-pcm",
    "audio-to-3gp",
    "audio-to-tta",
    "audio-to-vorbis",
    "audio-to-wav",
    "audio-to-wave64",
    "audio-to-wavpack",
    "audio-to-webm",
    "audio-to-wma"
  ];
  const outputs: ConversionOutput[] = [];
  const selectedRangeDuration = inspection.duration ? resolveMediaTrimRange(settings, inspection.duration).duration : 0;
  for (let index = 0; index < recipeIds.length; index += 1) {
    throwIfAborted(execution?.signal);
    const reportProgress = execution && ((progress: Parameters<LegacyExecutionContext["reportProgress"]>[0]) => {
      const completed = Math.max(0, Math.min(100, progress.completed ?? 0));
      execution.reportProgress({ completed: ((index + completed / 100) / recipeIds.length) * 90, total: 100, label: `Building format ${index + 1} of ${recipeIds.length}` });
    });
    const nestedExecution = execution ? { ...execution, reportProgress: reportProgress! } : undefined;
    const recipeId = recipeIds[index];
    const nestedSettings = {
      ...settings,
      batchNaming: "Converted suffix",
      ...(recipeId === "audio-to-m4r" && selectedRangeDuration > 30 ? { trim: "First 30 seconds" } : {})
    };
    outputs.push(recipeId === "audio-to-wav"
      ? await convertAudioToWav(file, baseName, nestedSettings, nestedExecution)
      : canConvertFfmpegAudioRecipe(recipeId)
        ? await convertFfmpegAudioRecipe(file, inspection, recipeId, nestedSettings, nestedExecution)
        : await convertAudioToFormat(file, baseName, recipeId, nestedSettings, nestedExecution));
  }
  outputs.push(jsonOutput("format-manifest.json", {
    source: file.name,
    outputs: outputs.map((output) => output.name),
    rawPcm: {
      file: outputs.find((output) => output.name.endsWith(".pcm"))?.name,
      sampleFormat: settings.outputFormat ?? "16-bit little-endian",
      sampleRate: settings.sampleRate ?? "Source sample rate",
      channels: settings.audioChannels ?? "Source channels"
    },
    ringtone: "The M4R output is capped at the first 30 seconds when the selected range is longer."
  }));
  outputs.sort((left, right) => left.name.localeCompare(right.name));
  return zipOutputs(`${baseName}-audio-formats.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

function audioTargetSpec(media: typeof import("mediabunny"), recipeId: string, settings: ConversionSettings): AudioTargetSpec {
  if (recipeId === "audio-to-mp3") return { codec: "mp3", extension: "mp3", format: new media.Mp3OutputFormat(), maxChannels: 2, mime: "audio/mpeg" };
  if (recipeId === "audio-to-flac") return { codec: "flac", extension: "flac", format: new media.FlacOutputFormat(), maxChannels: 8, mime: "audio/flac", sampleFormat: settings.bitDepth === "24-bit lossless" ? "s32" : "s16" };
  if (recipeId === "audio-to-m4a") return { codec: "aac", extension: "m4a", format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), maxChannels: 8, mime: "audio/mp4" };
  if (recipeId === "audio-to-aac") return { codec: "aac", extension: "aac", format: new media.AdtsOutputFormat(), maxChannels: 8, mime: "audio/aac" };
  if (recipeId === "audio-to-ogg") return { codec: "opus", extension: "ogg", format: new media.OggOutputFormat(), maxChannels: 2, mime: "audio/ogg", preferredSampleRate: 48_000 };
  if (recipeId === "audio-to-opus") return { codec: "opus", extension: "opus", format: new media.OggOutputFormat(), maxChannels: 2, mime: "audio/ogg", preferredSampleRate: 48_000 };
  if (recipeId === "audio-to-webm") return { codec: "opus", extension: "webm", format: new media.WebMOutputFormat(), maxChannels: 2, mime: "audio/webm", preferredSampleRate: 48_000 };
  if (recipeId === "audio-to-m4r") return { codec: "aac", extension: "m4r", format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), maxChannels: 2, mime: "audio/mp4" };
  if (recipeId === "audio-to-mov") {
    const pcm = settings.outputFormat === "16-bit PCM in MOV";
    return { codec: pcm ? "pcm-s16" : "aac", extension: "mov", format: new media.MovOutputFormat({ fastStart: "in-memory" }), maxChannels: 8, mime: "video/quicktime", sampleFormat: pcm ? "s16" : undefined };
  }
  if (recipeId === "audio-to-mka") {
    const selected = settings.outputFormat ?? "Opus in MKA";
    const codec = selected === "Opus in MKA" ? "opus" : selected === "AC-3 in MKA" ? "ac3" : selected === "E-AC-3 in MKA" ? "eac3" : "flac";
    return {
      codec,
      extension: "mka",
      format: new media.MkvOutputFormat(),
      maxChannels: codec === "opus" ? 2 : codec === "ac3" || codec === "eac3" ? 6 : 8,
      mime: "audio/x-matroska",
      preferredSampleRate: 48_000,
      sampleFormat: codec === "flac" ? settings.bitDepth === "24-bit lossless" ? "s32" : "s16" : undefined
    };
  }
  throw new Error(`Unknown audio output recipe: ${recipeId}`);
}

function isLosslessAudioCodec(codec: import("mediabunny").AudioCodec) {
  return codec === "flac" || codec.startsWith("pcm-");
}

async function createWaveformOutput(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const size = waveformSize(settings.resolution);
  const points = size.width;
  const waveform = await decodeWaveform(file, points, settings, execution);
  const theme = waveformTheme(settings.color);
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-waveform";
  const stem = `${baseName}${suffix}`;
  const svg = textOutput(`${stem}.svg`, waveformSvg(waveform.peaks, size, theme, file.name), "image/svg+xml;charset=utf-8");
  const png = { name: `${stem}.png`, blob: await waveformPng(waveform.peaks, size, theme, file.name) };
  const json = jsonOutput(`${stem}-peaks.json`, { source: file.name, duration: waveform.duration, points, peaks: waveform.peaks });
  const format = settings.outputFormat ?? "SVG waveform";
  if (format === "PNG waveform") return png;
  if (format === "Peaks JSON") return json;
  if (format === "Waveform ZIP") return zipOutputs(`${baseName}-waveform-assets.zip`, [svg, png, json], zipLevelFromCompression(settings.bundle));
  return svg;
}

async function createAudioVideo(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const size = audioVideoSize(settings.aspectRatio, settings.resolution);
  const fps = Math.max(1, Math.min(60, Number(settings.frameRate?.match(/\d+/)?.[0] ?? 24)));
  const waveform = await decodeWaveform(file, 220, settings, execution, { start: 5, end: 25 });
  const theme = waveformTheme(settings.color);
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  const target = new media.BufferTarget();
  const mp4 = settings.outputFormat === "MP4";
  const format = mp4 ? new media.Mp4OutputFormat({ fastStart: "in-memory" }) : new media.WebMOutputFormat();
  const output = new media.Output({ format, target });
  try {
    if (!await input.canRead()) throw new Error("The audio container could not be parsed.");
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("The media file has no readable audio track.");
    const [sourceDuration, sourceChannels] = await Promise.all([
      input.computeDuration([track]),
      track.getNumberOfChannels()
    ]);
    const range = resolveMediaTrimRange(settings, sourceDuration);
    const duration = range.end - range.start;
    const targetAudioRate = 48_000;
    const targetAudioChannels = Math.min(2, sourceChannels);
    const targetAudioCodec = mp4 ? "aac" : "opus";
    const targetAudioBitrate = audioBitrate(settings.compression, targetAudioChannels);
    await ensureAudioEncoder(media, targetAudioCodec, {
      numberOfChannels: targetAudioChannels,
      sampleRate: targetAudioRate,
      bitrate: targetAudioBitrate
    }, { preferBundled: mp4 });
    const videoCodec = await media.getFirstEncodableVideoCodec(mp4 ? ["avc"] : ["vp9", "vp8"], { width: size.width, height: size.height });
    const audioCodec = await media.getFirstEncodableAudioCodec([targetAudioCodec], { numberOfChannels: targetAudioChannels, sampleRate: targetAudioRate });
    if (!videoCodec || !audioCodec) throw new Error(`${mp4 ? "MP4" : "WebM"} encoding is not supported by this browser and device.`);

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");
    const videoSource = new media.CanvasSource(canvas, {
      codec: videoCodec,
      bitrate: videoQuality(media, settings.compression),
      keyFrameInterval: 2,
      latencyMode: "quality"
    });
    const audioSource = new media.AudioBufferSource({
      codec: audioCodec,
      bitrate: targetAudioBitrate,
      transform: { numberOfChannels: targetAudioChannels, sampleRate: targetAudioRate }
    });
    output.addVideoTrack(videoSource);
    output.addAudioTrack(audioSource);
    const visibleTitle = settings.metadata === "No title" ? "" : file.name.replace(/\.[^.]+$/, "");
    if (visibleTitle) output.setMetadataTags({ title: visibleTitle });

    const cancel = () => void output.cancel();
    execution?.signal.addEventListener("abort", cancel, { once: true });
    try {
      await output.start();
      const sink = new media.AudioBufferSink(track);
      const addAudio = async () => {
        for await (const wrapped of sink.buffers(range.start, range.end)) {
          throwIfAborted(execution?.signal);
          const clipped = clipAudioBuffer(wrapped.buffer, wrapped.timestamp, range);
          if (clipped) await audioSource.add(clipped);
        }
      };
      const addVideo = async () => {
        const frameDuration = 1 / fps;
        const frameCount = Math.max(1, Math.ceil(duration * fps));
        for (let frame = 0; frame < frameCount; frame += 1) {
          throwIfAborted(execution?.signal);
          const timestamp = frame * frameDuration;
          const progress = Math.min(1, timestamp / duration);
          drawAudioVideoFrame(context, canvas, waveform.peaks, progress, visibleTitle, duration, settings, theme);
          await videoSource.add(timestamp, Math.min(frameDuration, duration - timestamp), { keyFrame: frame === 0 || frame % Math.max(1, fps * 2) === 0 });
          execution?.reportProgress({ completed: 25 + (frame + 1) / frameCount * 70, total: 100, label: `Encoding ${mp4 ? "MP4" : "WebM"} video` });
        }
      };
      await Promise.all([addAudio(), addVideo()]);
      await output.finalize();
    } catch (error) {
      if (output.state === "started" || output.state === "finalizing") await output.cancel().catch(() => undefined);
      if (execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
      throw error;
    } finally {
      execution?.signal.removeEventListener("abort", cancel);
    }
    if (!target.buffer) throw new Error("Audio-to-video conversion produced no output bytes.");
    canvas.width = 1;
    canvas.height = 1;
    const extension = mp4 ? "mp4" : "webm";
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
    return { name: `${baseName}${suffix}.${extension}`, blob: new Blob([target.buffer], { type: `video/${extension}` }) };
  } finally {
    input.dispose();
  }
}

async function createVideoFrames(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) throw new Error("The video container could not be parsed.");
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("The media file has no readable video track.");
    const [duration, sourceWidth, sourceHeight] = await Promise.all([input.computeDuration([track]), track.getDisplayWidth(), track.getDisplayHeight()]);
    const range = resolveMediaTrimRange(settings, duration);
    const sink = new media.VideoSampleSink(track);
    const format = rasterFormat(settings.outputFormat);
    const width = frameWidth(settings.resolution, sourceWidth);
    const height = Math.max(1, Math.round(width / sourceWidth * sourceHeight));
    const outputs: ConversionOutput[] = [];
    const manifest: Array<{ name: string; timestamp: number }> = [];
    const addSample = async (sample: import("mediabunny").VideoSample, timestamp: number) => {
      if (outputs.length >= 1200) throw new Error("This frame selection exceeds the 1,200-frame browser bundle limit.");
      throwIfAborted(execution?.signal);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not available in this browser.");
        sample.drawWithFit(context, { fit: "contain" });
        if (format.mime === "image/png") quantizePngCanvas(context, width, height, settings.compression);
        const sequence = outputs.length + 1;
        const stem = settings.batchNaming === "Sequence names"
          ? `${baseName}-frame-${String(sequence).padStart(4, "0")}`
          : `${baseName}-${frameTimestamp(timestamp - range.start)}`;
        const name = `frames/${stem}.${format.extension}`;
        outputs.push({ name, blob: await canvasToBlob(canvas, format.mime, rasterQuality(settings.compression)) });
        manifest.push({ name, timestamp: round(timestamp - range.start) });
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }
      execution?.reportProgress({ completed: 10 + Math.min(80, ((timestamp - range.start) / (range.end - range.start)) * 80), total: 100, label: "Decoding video frames" });
    };

    if (settings.frameInterval === "Every frame") {
      for await (const sample of sink.samples(range.start, range.end)) {
        try {
          await addSample(sample, sample.timestamp);
        } finally {
          sample.close();
        }
      }
    } else {
      const times = sampleTimes(range, frameInterval(settings.frameInterval));
      let index = 0;
      for await (const sample of sink.samplesAtTimestamps(times)) {
        if (sample) {
          try {
            await addSample(sample, times[index]);
          } finally {
            sample.close();
          }
        }
        index += 1;
      }
    }
    if (!outputs.length) throw new Error("No video frames were decoded for the selected range.");
    if (settings.metadata !== "Files only") outputs.push(jsonOutput("manifest.json", { source: file.name, width, height, format: format.extension, frames: manifest }));
    return zipOutputs(`${baseName}-frames.zip`, outputs, zipLevelFromCompression(settings.bundle));
  } finally {
    input.dispose();
  }
}

async function createVideoContactSheet(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) throw new Error("The video container could not be parsed.");
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("The media file has no readable video track.");
    const duration = await input.computeDuration([track]);
    const range = resolveMediaTrimRange(settings, duration);
    const grid = contactSheetGrid(settings.pageLayout);
    const width = frameWidth(settings.resolution, 1200);
    const height = Math.max(1, Math.round(width * 9 / 16));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");
    context.fillStyle = "#111111";
    context.fillRect(0, 0, width, height);
    const cellWidth = width / grid.columns;
    const cellHeight = height / grid.rows;
    const count = grid.columns * grid.rows;
    const times = Array.from({ length: count }, (_, index) => range.start + (index / Math.max(1, count - 1)) * Math.max(0, range.end - range.start - 0.001));
    const sink = new media.VideoSampleSink(track);
    let index = 0;
    let decoded = 0;
    for await (const sample of sink.samplesAtTimestamps(times)) {
      if (sample) {
        const cell = document.createElement("canvas");
        cell.width = Math.ceil(cellWidth);
        cell.height = Math.ceil(cellHeight);
        try {
          throwIfAborted(execution?.signal);
          const cellContext = cell.getContext("2d");
          if (!cellContext) throw new Error("Canvas is not available in this browser.");
          cellContext.fillStyle = "#111111";
          cellContext.fillRect(0, 0, cell.width, cell.height);
          sample.drawWithFit(cellContext, { fit: contactSheetFit(settings.crop) });
          const x = (index % grid.columns) * cellWidth;
          const y = Math.floor(index / grid.columns) * cellHeight;
          context.drawImage(cell, x, y, cellWidth, cellHeight);
          if (settings.metadata !== "No timestamps") drawTimestampLabel(context, x, y, cellWidth, cellHeight, times[index] - range.start);
          context.strokeStyle = "rgba(255,255,255,.3)";
          context.strokeRect(x, y, cellWidth, cellHeight);
          decoded += 1;
        } finally {
          cell.width = 1;
          cell.height = 1;
          sample.close();
        }
      } else {
        throwIfAborted(execution?.signal);
      }
      index += 1;
      execution?.reportProgress({ completed: 10 + index / count * 80, total: 100, label: "Building contact sheet" });
    }
    if (!decoded) throw new Error("No video frames were decoded for the selected range.");
    const format = rasterFormat(settings.outputFormat);
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-contact-sheet";
    const blob = await canvasToBlob(canvas, format.mime, 0.9);
    canvas.width = 1;
    canvas.height = 1;
    return { name: `${baseName}${suffix}.${format.extension}`, blob };
  } finally {
    input.dispose();
  }
}

async function transcodeVideo(
  file: File,
  baseName: string,
  settings: ConversionSettings,
  targetFormat: "mp4" | "webm",
  execution?: LegacyExecutionContext
): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  const target = new media.BufferTarget();
  try {
    if (!await input.canRead()) throw new Error("The video container could not be parsed.");
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("The media file has no readable video track.");
    const audioTrack = await input.getPrimaryAudioTrack();
    const audioChannels = audioTrack ? Math.min(2, await audioTrack.getNumberOfChannels()) : null;
    const durationTracks = audioTrack ? [videoTrack, audioTrack] : [videoTrack];
    const [sourceWidth, sourceHeight, sourceDuration] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(durationTracks)
    ]);
    const range = resolveMediaTrimRange(settings, sourceDuration);
    const geometry = videoGeometry(settings, sourceWidth, sourceHeight);
    const videoCodec = await media.getFirstEncodableVideoCodec(targetFormat === "mp4" ? ["avc"] : ["vp9", "vp8"], geometry.width && geometry.height ? { width: geometry.width, height: geometry.height } : undefined);
    if (!videoCodec) throw new Error(`${targetFormat.toUpperCase()} video encoding is not supported by this browser and device.`);
    const targetAudioCodec = targetFormat === "mp4" ? "aac" : "opus";
    if (audioTrack && audioChannels) {
      await ensureAudioEncoder(media, targetAudioCodec, {
        numberOfChannels: audioChannels,
        sampleRate: 48_000,
        bitrate: audioBitrate(settings.compression, audioChannels)
      }, { preferBundled: targetFormat === "mp4" });
    }
    const audioCodec = audioTrack && audioChannels ? await media.getFirstEncodableAudioCodec([targetAudioCodec], { sampleRate: 48_000, numberOfChannels: audioChannels }) : null;
    if (audioTrack && !audioCodec) throw new Error(`${targetFormat.toUpperCase()} audio encoding is not supported by this browser and device.`);
    const format = targetFormat === "mp4" ? new media.Mp4OutputFormat({ fastStart: "in-memory" }) : new media.WebMOutputFormat();
    const output = new media.Output({ format, target });
    const conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: videoCodec,
        width: geometry.width,
        height: geometry.height,
        fit: geometry.fit,
        frameRate: selectedFrameRate(settings.frameRate),
        bitrate: videoQuality(media, settings.compression),
        forceTranscode: true
      },
      audio: audioTrack && audioCodec && audioChannels ? {
        codec: audioCodec,
        sampleRate: 48_000,
        numberOfChannels: audioChannels,
        bitrate: audioBitrate(settings.compression, audioChannels),
        forceTranscode: true
      } : { discard: true },
      trim: { start: range.start, end: range.end },
      tags: settings.metadata === "Strip tags" ? {} : undefined,
      showWarnings: false
    });
    if (!conversion.isValid) throw new Error(`Video conversion is unavailable: ${conversion.discardedTracks.map((entry) => entry.reason).join(", ") || "no usable tracks"}.`);
    const cancel = () => void conversion.cancel();
    execution?.signal.addEventListener("abort", cancel, { once: true });
    conversion.onProgress = (progress) => execution?.reportProgress({ completed: 10 + progress * 85, total: 100, label: `Encoding ${targetFormat.toUpperCase()} video` });
    try {
      await conversion.execute();
    } catch (error) {
      if (execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
      throw error;
    } finally {
      execution?.signal.removeEventListener("abort", cancel);
    }
    if (!target.buffer) throw new Error("Video conversion produced no output bytes.");
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-converted";
    return { name: `${baseName}${suffix}.${targetFormat}`, blob: new Blob([target.buffer], { type: `video/${targetFormat}` }) };
  } finally {
    input.dispose();
  }
}

async function extractVideoAudio(file: File, baseName: string, settings: ConversionSettings, execution?: LegacyExecutionContext): Promise<ConversionOutput> {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  const target = new media.BufferTarget();
  try {
    if (!await input.canRead()) throw new Error("The video container could not be parsed.");
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("The video has no readable audio track.");
    const range = resolveMediaTrimRange(settings, await input.computeDuration([track]));
    const outputFormat = settings.outputFormat ?? "WAV";
    const spec = audioOutputSpec(media, outputFormat, settings.compression);
    const channels = channelCount(settings.audioChannels) ?? Math.min(2, await track.getNumberOfChannels());
    const sampleRate = sampleRateValue(settings.sampleRate) ?? (spec.codec === "opus" ? 48_000 : await track.getSampleRate());
    if (!spec.codec.startsWith("pcm-")) {
      await ensureAudioEncoder(media, spec.codec, {
        numberOfChannels: channels,
        sampleRate,
        bitrate: audioBitrate(settings.compression, channels)
      }, { preferBundled: spec.codec === "aac" });
    }
    const output = new media.Output({ format: spec.format, target });
    const conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: {
        codec: spec.codec,
        sampleRate,
        numberOfChannels: channels,
        sampleFormat: pcmSampleFormat(spec.codec),
        bitrate: spec.codec.startsWith("pcm-") ? undefined : audioBitrate(settings.compression, channels),
        forceTranscode: true
      },
      trim: { start: range.start, end: range.end },
      tags: settings.metadata === "Strip tags" ? {} : undefined,
      showWarnings: false
    });
    if (!conversion.isValid) throw new Error(`Audio extraction is unavailable: ${conversion.discardedTracks.map((entry) => entry.reason).join(", ") || "no usable audio track"}.`);
    const cancel = () => void conversion.cancel();
    execution?.signal.addEventListener("abort", cancel, { once: true });
    conversion.onProgress = (progress) => execution?.reportProgress({ completed: 10 + progress * 85, total: 100, label: `Encoding ${outputFormat} audio` });
    try {
      await conversion.execute();
    } catch (error) {
      if (execution?.signal.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
      throw error;
    } finally {
      execution?.signal.removeEventListener("abort", cancel);
    }
    if (!target.buffer) throw new Error("Audio extraction produced no output bytes.");
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-audio";
    return { name: `${baseName}${suffix}.${spec.extension}`, blob: new Blob([target.buffer], { type: spec.mime }) };
  } finally {
    input.dispose();
  }
}

async function decodeWaveform(
  file: File,
  points: number,
  settings: ConversionSettings,
  execution?: LegacyExecutionContext,
  progressWindow: { start: number; end: number } = { start: 10, end: 90 }
) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  try {
    if (!await input.canRead()) throw new Error("The audio container could not be parsed.");
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("The media file has no readable audio track.");
    const sourceDuration = await input.computeDuration([track]);
    const range = resolveMediaTrimRange(settings, sourceDuration);
    const duration = range.end - range.start;
    const peaks = Array.from({ length: points }, () => 0);
    const sink = new media.AudioBufferSink(track);
    for await (const wrapped of sink.buffers(range.start, range.end)) {
      throwIfAborted(execution?.signal);
      const buffer = wrapped.buffer;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) {
          const time = wrapped.timestamp + index / buffer.sampleRate;
          if (time < range.start || time >= range.end) continue;
          const bucket = Math.min(points - 1, Math.floor(((time - range.start) / duration) * points));
          peaks[bucket] = Math.max(peaks[bucket], Math.abs(samples[index]));
        }
      }
      const completed = progressWindow.start + Math.min(progressWindow.end - progressWindow.start, ((wrapped.timestamp + wrapped.duration - range.start) / duration) * (progressWindow.end - progressWindow.start));
      execution?.reportProgress({ completed, total: 100, label: "Decoding waveform peaks" });
    }
    return { duration: round(duration), peaks: peaks.map((peak) => round(peak)) };
  } finally {
    input.dispose();
  }
}

function waveformSvg(peaks: number[], size: { width: number; height: number }, theme: WaveformTheme, title: string) {
  const center = size.height / 2;
  const amplitude = size.height * 0.32;
  const path = peaks.map((peak, index) => {
    const x = (index / Math.max(1, peaks.length - 1)) * size.width;
    const height = Math.max(1, peak * amplitude);
    return `M${round(x)} ${round(center - height)}V${round(center + height)}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="Waveform for ${escapeHtml(title)}"><rect width="100%" height="100%" fill="${theme.background}"/><path d="${path}" stroke="${theme.wave}" stroke-width="1"/><text x="${round(size.width * 0.04)}" y="${round(size.height * 0.12)}" fill="${theme.text}" font-family="system-ui,sans-serif" font-size="${Math.max(16, Math.round(size.height * 0.055))}">${escapeHtml(title.replace(/\.[^.]+$/, ""))}</text></svg>`;
}

async function waveformPng(peaks: number[], size: { width: number; height: number }, theme: WaveformTheme, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.fillStyle = theme.background;
  context.fillRect(0, 0, size.width, size.height);
  context.fillStyle = theme.wave;
  const center = size.height / 2;
  const amplitude = size.height * 0.32;
  const barWidth = size.width / peaks.length;
  peaks.forEach((peak, index) => {
    const height = Math.max(1, peak * amplitude * 2);
    context.fillRect(index * barWidth, center - height / 2, Math.max(1, barWidth), height);
  });
  context.fillStyle = theme.text;
  context.font = `600 ${Math.max(16, Math.round(size.height * 0.055))}px system-ui, sans-serif`;
  context.fillText(title.replace(/\.[^.]+$/, "").slice(0, 80), size.width * 0.04, size.height * 0.12);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG waveform export is not supported.")), "image/png"));
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

function rasterFormat(value?: string): { extension: "png" | "jpg" | "webp"; mime: "image/png" | "image/jpeg" | "image/webp" } {
  if (value === "JPEG") return { extension: "jpg", mime: "image/jpeg" };
  if (value === "WebP") return { extension: "webp", mime: "image/webp" };
  return { extension: "png", mime: "image/png" };
}

function rasterQuality(value?: string) {
  if (value === "Maximum quality") return 0.98;
  if (value === "High quality") return 0.92;
  if (value === "Small file") return 0.68;
  return 0.82;
}

function quantizePngCanvas(context: CanvasRenderingContext2D, width: number, height: number, quality?: string) {
  const step = quality === "High quality" ? 4 : quality === "Small file" ? 32 : quality === "Balanced" ? 16 : 1;
  if (step === 1) return;
  const image = context.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = Math.min(255, Math.round(image.data[index] / step) * step);
    image.data[index + 1] = Math.min(255, Math.round(image.data[index + 1] / step) * step);
    image.data[index + 2] = Math.min(255, Math.round(image.data[index + 2] / step) * step);
  }
  context.putImageData(image, 0, 0);
}

function frameWidth(value: string | undefined, fallback: number) {
  if (!value || value.includes("Source")) return fallback;
  const width = Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(width) && width > 0 ? width : fallback;
}

function frameInterval(value?: string) {
  const interval = Number(value?.match(/[\d.]+/)?.[0] ?? 1);
  return Math.max(0.05, interval);
}

function sampleTimes(range: { start: number; end: number }, interval: number) {
  const times: number[] = [];
  for (let time = range.start; time < range.end; time += interval) {
    if (times.length >= 1200) throw new Error("This frame selection exceeds the 1,200-frame browser bundle limit.");
    times.push(round(time));
  }
  return times;
}

function frameTimestamp(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(minutes).padStart(2, "0")}-${String(remainder).padStart(2, "0")}-${String(milliseconds).padStart(3, "0")}`;
}

function contactSheetGrid(value?: string) {
  const match = value?.match(/(\d+)\s*x\s*(\d+)/i);
  return { columns: Number(match?.[1] ?? 3), rows: Number(match?.[2] ?? 3) };
}

function contactSheetFit(value?: string): "contain" | "cover" | "fill" {
  if (value === "Fit inside cells") return "contain";
  if (value === "Stretch to cells") return "fill";
  return "cover";
}

function drawTimestampLabel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, seconds: number) {
  const labelHeight = Math.max(18, height * 0.13);
  context.fillStyle = "rgba(0,0,0,.68)";
  context.fillRect(x, y + height - labelHeight, width, labelHeight);
  context.fillStyle = "#ffffff";
  context.font = `500 ${Math.max(11, Math.round(labelHeight * 0.52))}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.fillText(mediaTimestamp(seconds), x + Math.max(5, width * 0.025), y + height - labelHeight * 0.28);
}

function videoGeometry(settings: ConversionSettings, sourceWidth: number, sourceHeight: number): { width?: number; height?: number; fit?: "contain" | "cover" | "fill" } {
  const sourceResolution = !settings.resolution || settings.resolution === "Source resolution";
  const originalAspect = !settings.aspectRatio || settings.aspectRatio === "Original";
  if (sourceResolution && originalAspect) return {};
  const ratio = settings.aspectRatio?.includes("9:16") ? [9, 16]
    : settings.aspectRatio?.includes("1:1") ? [1, 1]
      : settings.aspectRatio?.includes("4:5") ? [4, 5]
        : settings.aspectRatio?.includes("16:9") ? [16, 9]
          : [sourceWidth, sourceHeight];
  const base = sourceResolution
    ? (ratio[0] >= ratio[1] ? sourceHeight : sourceWidth)
    : settings.resolution?.includes("360") ? 360
      : settings.resolution?.includes("720") ? 720
        : settings.resolution?.includes("1440") ? 1440
          : settings.resolution?.includes("4K") ? 2160
            : 1080;
  const width = ratio[0] >= ratio[1] ? even(base * ratio[0] / ratio[1]) : even(base);
  const height = ratio[0] >= ratio[1] ? even(base) : even(base * ratio[1] / ratio[0]);
  const fit = settings.crop === "Fill and crop" ? "cover" : settings.crop === "Stretch" ? "fill" : "contain";
  return { width, height, fit };
}

function selectedFrameRate(value?: string) {
  if (!value || value === "Source frame rate") return undefined;
  const rate = Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(rate) ? rate : undefined;
}

function audioOutputSpec(media: typeof import("mediabunny"), value: string, compression?: string) {
  if (value === "M4A") return { format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), codec: "aac" as const, extension: "m4a", mime: "audio/mp4" };
  if (value === "AAC") return { format: new media.AdtsOutputFormat(), codec: "aac" as const, extension: "aac", mime: "audio/aac" };
  if (value === "OGG") return { format: new media.OggOutputFormat(), codec: "opus" as const, extension: "ogg", mime: "audio/ogg" };
  return { format: new media.WavOutputFormat(), codec: wavCompressionCodec(compression), extension: "wav", mime: "audio/wav" };
}

function wavCompressionCodec(value?: string): "pcm-u8" | "pcm-s16" | "pcm-s24" | "pcm-f32" {
  if (value === "Maximum quality") return "pcm-f32";
  if (value === "High quality") return "pcm-s24";
  if (value === "Small file") return "pcm-u8";
  return "pcm-s16";
}

function pcmSampleFormat(codec: string): "u8" | "s16" | "s32" | "f32" | undefined {
  if (codec === "pcm-u8") return "u8";
  if (codec === "pcm-s16") return "s16";
  if (codec === "pcm-s24") return "s32";
  if (codec === "pcm-f32") return "f32";
  return undefined;
}

function drawAudioVideoFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress: number,
  title: string,
  duration: number,
  settings: ConversionSettings,
  theme: WaveformTheme
) {
  const { width, height } = canvas;
  const padding = Math.max(24, Math.round(Math.min(width, height) * 0.08));
  context.fillStyle = theme.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = theme.wave;
  context.globalAlpha = 0.55;
  context.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 260));
  context.strokeRect(padding / 2, padding / 2, width - padding, height - padding);
  context.globalAlpha = 1;

  if (title) {
    context.fillStyle = theme.text;
    context.font = `600 ${Math.max(18, Math.round(Math.min(width, height) * 0.075))}px Georgia, serif`;
    context.textAlign = "center";
    context.fillText(title.slice(0, 72), width / 2, padding * 1.45, width - padding * 2);
  }

  const visual = settings.waveform ?? "Animated waveform";
  if (visual !== "Progress bar" && visual !== "Cover card") {
    const center = height * 0.52;
    const amplitude = height * 0.27;
    const availableWidth = width - padding * 2;
    const barWidth = availableWidth / peaks.length;
    const active = visual === "Static waveform" ? 1 : progress;
    peaks.forEach((peak, index) => {
      const barHeight = Math.max(2, peak * amplitude * 2);
      context.fillStyle = index / peaks.length <= active ? theme.wave : theme.text;
      context.globalAlpha = index / peaks.length <= active ? 1 : 0.2;
      context.fillRect(padding + index * barWidth, center - barHeight / 2, Math.max(1, barWidth * 0.7), barHeight);
    });
    context.globalAlpha = 1;
  }

  const progressY = height - padding * 1.2;
  context.fillStyle = theme.text;
  context.globalAlpha = 0.22;
  context.fillRect(padding, progressY, width - padding * 2, Math.max(3, height / 150));
  context.globalAlpha = 1;
  context.fillStyle = theme.wave;
  context.fillRect(padding, progressY, (width - padding * 2) * progress, Math.max(3, height / 150));
  context.fillStyle = theme.text;
  context.font = `500 ${Math.max(11, Math.round(Math.min(width, height) * 0.04))}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.fillText(mediaTimestamp(progress * duration), padding, progressY + padding * 0.65);
  context.textAlign = "right";
  context.fillText(mediaTimestamp(duration), width - padding, progressY + padding * 0.65);
}

function clipAudioBuffer(buffer: AudioBuffer, timestamp: number, range: { start: number; end: number }) {
  const startFrame = Math.max(0, Math.ceil((range.start - timestamp) * buffer.sampleRate));
  const endFrame = Math.min(buffer.length, Math.floor((range.end - timestamp) * buffer.sampleRate));
  if (endFrame <= startFrame) return null;
  if (startFrame === 0 && endFrame === buffer.length) return buffer;
  const clipped = new AudioBuffer({ length: endFrame - startFrame, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    clipped.copyToChannel(buffer.getChannelData(channel).subarray(startFrame, endFrame), channel);
  }
  return clipped;
}

function audioVideoSize(aspectRatio?: string, resolution?: string) {
  const ratio = aspectRatio?.includes("9:16") ? [9, 16]
    : aspectRatio?.includes("1:1") ? [1, 1]
      : aspectRatio?.includes("4:5") ? [4, 5]
        : [16, 9];
  const base = resolution?.includes("360") ? 360
    : resolution?.includes("720") ? 720
      : resolution?.includes("1440") ? 1440
        : resolution?.includes("4K") ? 2160
          : 1080;
  if (ratio[0] >= ratio[1]) return { width: even(base * ratio[0] / ratio[1]), height: even(base) };
  return { width: even(base), height: even(base * ratio[1] / ratio[0]) };
}

function videoQuality(media: typeof import("mediabunny"), value?: string) {
  if (value === "Maximum quality") return media.QUALITY_VERY_HIGH;
  if (value === "High quality") return media.QUALITY_HIGH;
  if (value === "Small file") return media.QUALITY_LOW;
  return media.QUALITY_MEDIUM;
}

function audioBitrate(value: string | undefined, channels: number) {
  const explicitKbps = Number(value?.match(/(\d+)\s*kbps/i)?.[1]);
  const selected = Number.isFinite(explicitKbps) && explicitKbps > 0 ? explicitKbps * 1000
    : value === "Maximum quality" ? 256_000
    : value === "High quality" ? 192_000
      : value === "Small file" ? 96_000
        : 160_000;
  return channels === 1 && !Number.isFinite(explicitKbps) ? Math.min(128_000, selected) : selected;
}

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function mediaTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function sampleRateValue(value?: string) {
  if (!value || value === "Source sample rate") return undefined;
  const number = Number(value.match(/[\d.]+/)?.[0]);
  return Number.isFinite(number) ? Math.round(number * 1000) : undefined;
}

function channelCount(value?: string) {
  if (value === "Mono") return 1;
  if (value === "Stereo") return 2;
  return undefined;
}

function wavCodec(value?: string): "pcm-s16" | "pcm-s24" | "pcm-f32" {
  if (value === "24-bit PCM") return "pcm-s24";
  if (value === "32-bit float") return "pcm-f32";
  return "pcm-s16";
}

function wavSampleFormat(value?: string): "s16" | "s32" | "f32" {
  if (value === "24-bit PCM") return "s32";
  if (value === "32-bit float") return "f32";
  return "s16";
}

function waveformSize(value?: string) {
  const match = value?.match(/(\d+)\s*x\s*(\d+)/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1200, height: 400 };
}

interface WaveformTheme { background: string; wave: string; text: string }

function waveformTheme(value?: string): WaveformTheme {
  if (value === "Emerald on cream") return { background: "#f3eee2", wave: "#0b5a3c", text: "#173b2b" };
  if (value === "Monochrome") return { background: "#f5f5f2", wave: "#111111", text: "#111111" };
  return { background: "#11100e", wave: "#d7b76d", text: "#fff7e8" };
}

function textOutput(name: string, text: string, type: string): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return textOutput(name, JSON.stringify(value, null, 2), "application/json;charset=utf-8");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversion was cancelled.", "AbortError");
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
