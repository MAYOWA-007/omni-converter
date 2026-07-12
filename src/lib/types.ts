export type FileFamily =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "data"
  | "code"
  | "font"
  | "model3d"
  | "ebook"
  | "application"
  | "unknown";

export type Capability =
  | "canvas"
  | "webgl"
  | "wasm"
  | "worker"
  | "webcodecs"
  | "mediarecorder"
  | "mediacapabilities"
  | "filesystem"
  | "opfs"
  | "zip"
  | "ocr"
  | "pdf"
  | "spreadsheet"
  | "audio"
  | "video"
  | "image"
  | "webpEncoder"
  | "avifEncoder"
  | "opusEncoder";

export type Intensity = "light" | "standard" | "heavy" | "extreme";

export type EditorControl =
  | "archiveSelection"
  | "outputFormat"
  | "timeline"
  | "trim"
  | "crop"
  | "rotation"
  | "aspectRatio"
  | "resolution"
  | "frameRate"
  | "frameInterval"
  | "chapterInterval"
  | "audioGain"
  | "audioFade"
  | "sampleRate"
  | "audioChannels"
  | "bitDepth"
  | "waveform"
  | "captions"
  | "color"
  | "compression"
  | "dataTypes"
  | "formulaSafety"
  | "headerMode"
  | "pageOrder"
  | "pageLayout"
  | "pageSize"
  | "sheetSelection"
  | "slideSelection"
  | "margins"
  | "metadata"
  | "watermark"
  | "batchNaming"
  | "bundle";

export type ConversionImplementation = "ready" | "planned";

export type RecipeMaturity = "planned" | "implemented" | "verified";

export type RecipeRuntime = "browser";

export interface RecipeAvailability {
  maturity: RecipeMaturity;
  runtime: RecipeRuntime;
  selectable: boolean;
}

export type ConversionSettings = Partial<Record<EditorControl, string>> & {
  trimStart?: number;
  trimEnd?: number;
};

export interface ConversionRecipe {
  id: string;
  input: FileFamily[];
  category: string;
  output: string;
  title: string;
  description: string;
  treatments: string[];
  keywords?: string[];
  inputFormats?: string[];
  editorControls: EditorControl[];
  controlOptions?: Partial<Record<EditorControl, string[]>>;
  requiredCapabilities: Capability[];
  intensity: Intensity;
  engine: string;
  implementation: ConversionImplementation;
  maturity: RecipeMaturity;
  runtimes: RecipeRuntime[];
  localOnly: true;
}

export interface FileInspection {
  name: string;
  extension: string;
  mime: string;
  size: number;
  family: FileFamily;
  width?: number;
  height?: number;
  duration?: number;
  sampleRate?: number;
  audioChannels?: number;
  videoCodec?: string;
  audioCodec?: string;
  mediaTargets?: { mp4: boolean; webm: boolean };
  pages?: number;
  sheets?: string[];
  slides?: number;
  archiveEntries?: Array<{ name: string; size: number }>;
  exactFormat?: string;
  signatureSource?: "signature" | "unknown";
  riskBlocked?: boolean;
  riskReasons?: string[];
  notes: string[];
}

export interface DeviceProfile {
  cores: number;
  memoryGb?: number;
  storageQuota?: number;
  storageUsage?: number;
  supports: Record<Capability, boolean>;
}

export type PreflightStatus = "ready" | "slow" | "blocked";

export interface PreflightResult {
  status: PreflightStatus;
  label: string;
  estimate: string;
  reasons: string[];
}
