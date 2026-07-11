import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedMediaRecipeContract {
  recipeId: "audio-to-wav" | "audio-waveform" | "audio-to-video" | "video-to-frames" | "video-thumbnail-sheet" | "video-to-mp4" | "video-to-webm" | "video-to-audio";
  fixture: "sine-wav" | "video-webm" | "video-mp4";
  engineId: "browser-media";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_MEDIA_RECIPE_CONTRACTS: readonly VerifiedMediaRecipeContract[] = [
  contract("audio-to-wav", ["wav"], ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"], {
    trim: "Full file",
    sampleRate: "Source sample rate",
    audioChannels: "Source channels",
    bitDepth: "16-bit PCM",
    metadata: "Keep tags",
    batchNaming: "Converted suffix"
  }),
  contract("audio-waveform", ["svg"], ["outputFormat", "trim", "resolution", "color", "batchNaming", "bundle"], {
    outputFormat: "SVG waveform",
    trim: "Full file",
    resolution: "1200 x 400",
    color: "Gold on charcoal",
    batchNaming: "Waveform suffix",
    bundle: "Balanced ZIP"
  }),
  contract("audio-to-video", ["webm"], ["outputFormat", "trim", "aspectRatio", "resolution", "frameRate", "waveform", "color", "compression", "metadata", "batchNaming"], {
    outputFormat: "WebM",
    trim: "Full file",
    aspectRatio: "16:9 widescreen",
    resolution: "360p preview",
    frameRate: "12 fps",
    waveform: "Animated waveform",
    color: "Gold on charcoal",
    compression: "Balanced",
    metadata: "Filename title",
    batchNaming: "Converted suffix"
  }),
  contract("video-to-frames", ["zip"], ["outputFormat", "trim", "frameInterval", "resolution", "compression", "metadata", "batchNaming", "bundle"], {
    outputFormat: "PNG",
    trim: "Full file",
    frameInterval: "Every 0.5 seconds",
    resolution: "Source resolution",
    compression: "Maximum quality",
    metadata: "Include manifest",
    batchNaming: "Timestamp names",
    bundle: "Store ZIP"
  }, "video-webm"),
  contract("video-thumbnail-sheet", ["png"], ["outputFormat", "trim", "pageLayout", "crop", "resolution", "metadata", "batchNaming"], {
    outputFormat: "PNG",
    trim: "Full file",
    pageLayout: "3 x 3 grid",
    crop: "Fill cells",
    resolution: "1200 px wide",
    metadata: "Show timestamps",
    batchNaming: "Contact sheet suffix"
  }, "video-mp4"),
  contract("video-to-mp4", ["mp4"], ["trim", "aspectRatio", "crop", "resolution", "frameRate", "compression", "metadata", "batchNaming"], {
    trim: "Full file",
    aspectRatio: "Original",
    crop: "Fit inside",
    resolution: "Source resolution",
    frameRate: "Source frame rate",
    compression: "Balanced",
    metadata: "Keep tags",
    batchNaming: "Converted suffix"
  }, "video-webm"),
  contract("video-to-webm", ["webm"], ["trim", "aspectRatio", "crop", "resolution", "frameRate", "compression", "metadata", "batchNaming"], {
    trim: "Full file",
    aspectRatio: "Original",
    crop: "Fit inside",
    resolution: "Source resolution",
    frameRate: "Source frame rate",
    compression: "Balanced",
    metadata: "Keep tags",
    batchNaming: "Converted suffix"
  }, "video-mp4"),
  contract("video-to-audio", ["wav"], ["outputFormat", "trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    outputFormat: "WAV",
    trim: "Full file",
    sampleRate: "Source sample rate",
    audioChannels: "Source channels",
    compression: "Balanced",
    metadata: "Keep tags",
    batchNaming: "Audio suffix"
  }, "video-webm")
];

export const VERIFIED_MEDIA_RECIPE_IDS = new Set(VERIFIED_MEDIA_RECIPE_CONTRACTS.map((contractEntry) => contractEntry.recipeId));

function contract(
  recipeId: VerifiedMediaRecipeContract["recipeId"],
  expectedExtensions: readonly string[],
  differentialControls: readonly EditorControl[],
  fixtureSettings: ConversionSettings,
  fixture: VerifiedMediaRecipeContract["fixture"] = "sine-wav"
): VerifiedMediaRecipeContract {
  return { recipeId, fixture, engineId: "browser-media", expectedExtensions, differentialControls, fixtureSettings };
}
