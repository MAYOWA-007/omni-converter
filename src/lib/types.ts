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
  | "avifEncoder";

export type Intensity = "light" | "standard" | "heavy" | "extreme";

export type EditorControl =
  | "outputFormat"
  | "timeline"
  | "trim"
  | "crop"
  | "aspectRatio"
  | "resolution"
  | "frameRate"
  | "frameInterval"
  | "chapterInterval"
  | "audioGain"
  | "audioFade"
  | "waveform"
  | "captions"
  | "color"
  | "compression"
  | "pageOrder"
  | "pageSize"
  | "margins"
  | "metadata"
  | "watermark"
  | "batchNaming"
  | "bundle";

export type ConversionImplementation = "ready" | "planned";

export type ConversionSettings = Partial<Record<EditorControl, string>>;

export interface ConversionRecipe {
  id: string;
  input: FileFamily[];
  category: string;
  output: string;
  title: string;
  description: string;
  treatments: string[];
  keywords?: string[];
  editorControls: EditorControl[];
  controlOptions?: Partial<Record<EditorControl, string[]>>;
  requiredCapabilities: Capability[];
  intensity: Intensity;
  engine: string;
  implementation: ConversionImplementation;
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
  pages?: number;
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
