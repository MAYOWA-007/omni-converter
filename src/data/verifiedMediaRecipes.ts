import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedMediaRecipeContract {
  recipeId: "audio-to-wav" | "audio-to-mp3" | "audio-to-flac" | "audio-to-m4a" | "audio-to-aac" | "audio-to-ogg" | "audio-to-opus" | "audio-to-webm" | "audio-to-mka" | "audio-to-mov" | "audio-to-m4r" | "audio-to-aiff" | "audio-to-alac" | "audio-to-caf" | "audio-to-ac3" | "audio-to-eac3" | "audio-to-vorbis" | "audio-to-wma" | "audio-to-wavpack" | "audio-to-tta" | "audio-to-mp2" | "audio-to-au" | "audio-to-wave64" | "audio-to-pcm" | "audio-to-3gp" | "audio-format-bundle" | "audio-waveform" | "audio-to-video" | "video-to-frames" | "video-thumbnail-sheet" | "video-to-mp4" | "video-to-webm" | "video-to-gif" | "video-to-audio";
  fixture: "sine-wav" | "video-webm" | "video-mp4";
  engineId: "browser-media";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_MEDIA_RECIPE_CONTRACTS: readonly VerifiedMediaRecipeContract[] = [
  contract("audio-to-mp3", ["mp3"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-flac", ["flac"], ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit lossless", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-m4a", ["m4a"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-aac", ["aac"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-ogg", ["ogg"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "160 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-opus", ["opus"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "160 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-webm", ["webm"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "160 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-mka", ["mka"], ["outputFormat", "trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "batchNaming"], {
    outputFormat: "Opus in MKA", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit lossless", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-mov", ["mov"], ["outputFormat", "trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "batchNaming"], {
    outputFormat: "AAC in MOV", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit PCM", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-m4r", ["m4r"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "First 30 seconds", sampleRate: "44.1 kHz", audioChannels: "Stereo", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-aiff", ["aiff"], ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit PCM", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-alac", ["m4a"], ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit lossless", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-caf", ["caf"], ["outputFormat", "trim", "sampleRate", "audioChannels", "metadata", "batchNaming"], {
    outputFormat: "24-bit PCM in CAF", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-ac3", ["ac3"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "640 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-eac3", ["eac3"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "1024 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-vorbis", ["oga"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-wma", ["wma"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-wavpack", ["wv"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "Fast", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-tta", ["tta"], ["trim", "sampleRate", "audioChannels", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-mp2", ["mp2"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-au", ["au"], ["outputFormat", "trim", "sampleRate", "audioChannels", "metadata", "batchNaming"], {
    outputFormat: "16-bit PCM", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-wave64", ["w64"], ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit PCM", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-to-pcm", ["pcm"], ["outputFormat", "trim", "sampleRate", "audioChannels", "batchNaming"], {
    outputFormat: "16-bit little-endian", trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", batchNaming: "Converted suffix"
  }),
  contract("audio-to-3gp", ["3gp"], ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", compression: "192 kbps", metadata: "Keep tags", batchNaming: "Converted suffix"
  }),
  contract("audio-format-bundle", ["zip"], ["trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "bundle"], {
    trim: "Full file", sampleRate: "Source sample rate", audioChannels: "Source channels", bitDepth: "16-bit lossless", compression: "160 kbps", metadata: "Keep tags", bundle: "Store ZIP"
  }),
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
  contract("audio-to-video", ["webm"], ["outputFormat", "trim", "aspectRatio", "resolution", "frameRate", "waveform", "typography", "color", "compression", "metadata", "batchNaming"], {
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
  contract("video-to-gif", ["gif"], ["trim", "resolution", "frameRate"], {
    trim: "First 1 second",
    resolution: "360 px wide",
    frameRate: "8 fps"
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
