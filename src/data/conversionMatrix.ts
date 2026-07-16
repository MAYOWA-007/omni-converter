import type { ConversionImplementation, ConversionRecipe, EditorControl, FileFamily, RecipeMaturity, RecipeRuntime } from "../lib/types";
import { PDF_PAGE_SELECTION_OPTIONS } from "../lib/pdfPageSelection";
import { VERIFIED_IMAGE_RECIPE_IDS } from "./verifiedImageRecipes";
import { VERIFIED_PDF_RECIPE_IDS } from "./verifiedPdfRecipes";
import { VERIFIED_TABULAR_RECIPE_IDS } from "./verifiedTabularRecipes";
import { VERIFIED_OFFICE_RECIPE_IDS } from "./verifiedOfficeRecipes";
import { VERIFIED_ARCHIVE_RECIPE_IDS } from "./verifiedArchiveRecipes";
import { VERIFIED_EBOOK_RECIPE_IDS } from "./verifiedEbookRecipes";
import { VERIFIED_MEDIA_RECIPE_IDS } from "./verifiedMediaRecipes";
import { VERIFIED_UNIVERSAL_RECIPE_IDS } from "./verifiedUniversalRecipes";

export const FAMILY_LABELS: Record<FileFamily, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  document: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  archive: "Archive",
  data: "Data",
  code: "Code",
  font: "Font",
  model3d: "3D model",
  ebook: "Ebook",
  application: "Application",
  unknown: "Unknown"
};

export const DEFAULT_CONTROL_OPTIONS: Record<EditorControl, string[]> = {
  archiveSelection: ["All files", "Top-level files", "Documents", "Images", "Audio and video"],
  outputFormat: ["Auto", "PNG", "JPEG", "WebP", "AVIF", "PDF", "TXT", "Markdown", "HTML", "ZIP"],
  timeline: ["Full file", "Marked range", "Current clip", "Intro only", "Outro only", "Custom marks"],
  trim: ["None", "Start/end handles", "First 5 seconds", "First 15 seconds", "First 30 seconds", "Custom range"],
  crop: ["None", "Fit entire source", "Fill target", "Center crop", "Trim transparent edges", "Safe social crop", "Custom crop"],
  rotation: ["90 degrees clockwise", "180 degrees", "90 degrees counterclockwise"],
  aspectRatio: ["Original", "1:1 square", "4:5 portrait", "5:4 landscape", "16:9 widescreen", "9:16 vertical", "3:2 photo", "2:3 portrait", "A4 page", "Letter page", "Custom"],
  resolution: ["Original", "512 px", "1024 px", "1080 px", "1920 px", "2K", "4K", "150 DPI", "300 DPI", "Custom"],
  frameRate: ["Source", "12 fps", "15 fps", "24 fps", "25 fps", "30 fps", "60 fps", "Custom"],
  frameInterval: ["Every frame", "Every 0.5 seconds", "Every 1 second", "Every 2 seconds", "Every 5 seconds", "Every 10 seconds", "Scene changes", "Custom interval"],
  chapterInterval: ["None", "Every minute", "Every 2 minutes", "Every 5 minutes", "Detected chapters", "Scene breaks", "Custom chapter marks"],
  audioGain: ["Keep source", "Normalize", "-6 dB", "-3 dB", "+3 dB", "+6 dB", "Mute", "Custom"],
  audioFade: ["None", "Fade in", "Fade out", "Fade in and out", "Crossfade clips", "Custom"],
  sampleRate: ["Source sample rate", "44.1 kHz", "48 kHz", "96 kHz"],
  audioChannels: ["Source channels", "Mono", "Stereo"],
  bitDepth: ["16-bit PCM", "24-bit PCM", "32-bit float"],
  waveform: ["None", "PNG waveform", "SVG waveform", "Audiogram background", "Timeline peaks JSON"],
  typography: ["Editorial serif", "Modern sans", "Compact label", "Minimal mono", "No title"],
  captions: ["None", "Import SRT", "Import VTT", "Export SRT", "Export VTT", "Burn in later", "Transcript package"],
  color: ["Original", "sRGB", "Display P3", "Grayscale", "CMYK prep", "Transparent matte", "White matte", "Black matte"],
  compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview", "Custom"],
  dataTypes: ["Preserve detected types", "Infer CSV value types", "Convert all values to text"],
  formulaSafety: ["Protect spreadsheet formulas", "Preserve exact text"],
  headerMode: ["First row is headers", "No header row"],
  pageOrder: ["All pages", "Current page", "First page", "Last page", "Odd pages", "Even pages", "Custom range", "Split every page", "Reverse order"],
  pageLayout: ["2 pages per sheet", "4 pages per sheet"],
  pageSize: ["Auto", "Original", "Letter", "Legal", "A4", "A5", "16:9 slide", "4:5 carousel", "1:1 square", "Custom"],
  sheetSelection: ["All sheets", "First sheet"],
  slideSelection: ["All slides", "First slide", "Last slide", "Odd slides", "Even slides", "Reverse order"],
  margins: ["None", "Narrow", "Standard", "Wide", "Bleed", "Safe area", "Custom"],
  metadata: ["Keep", "Strip", "Inspect report", "Normalize", "Rename title", "Replace author/company", "Redact hidden fields"],
  watermark: ["None", "Text watermark", "Image watermark", "Page number", "Date stamp", "Custom"],
  batchNaming: ["Keep source name", "Clean filename", "Numbered sequence", "Page number suffix", "Size suffix", "Date suffix", "Custom pattern"],
  bundle: ["Single file", "ZIP", "ZIP with manifest", "ZIP with README", "Folder by page", "Folder by format", "Checksum manifest"]
};

export const UNIVERSAL_TREATMENTS = [
  "Inspect metadata",
  "Rename and normalize",
  "Compress",
  "Bundle as ZIP",
  "Generate preview",
  "Extract embedded assets",
  "Create shareable export pack",
  "Strip metadata where possible",
  "Attach readme / manifest",
  "Estimate processing time"
];

const VERIFIED_BROWSER_RECIPE_IDS = new Set([...VERIFIED_IMAGE_RECIPE_IDS, ...VERIFIED_PDF_RECIPE_IDS, ...VERIFIED_TABULAR_RECIPE_IDS, ...VERIFIED_OFFICE_RECIPE_IDS, ...VERIFIED_ARCHIVE_RECIPE_IDS, ...VERIFIED_EBOOK_RECIPE_IDS, ...VERIFIED_MEDIA_RECIPE_IDS, ...VERIFIED_UNIVERSAL_RECIPE_IDS]);

type RecipeInput = Omit<ConversionRecipe, "implementation" | "localOnly" | "maturity" | "runtimes"> & Partial<Pick<ConversionRecipe, "implementation">>;

function recipe(config: RecipeInput): ConversionRecipe {
  const implementation = config.implementation ?? "ready";

  return {
    ...config,
    implementation,
    maturity: legacyRecipeMaturity(config.id, implementation),
    runtimes: legacyRecipeRuntimes(config.id),
    localOnly: true,
  };
}

function legacyRecipeMaturity(id: string, implementation: ConversionImplementation): RecipeMaturity {
  if (VERIFIED_BROWSER_RECIPE_IDS.has(id)) return "verified";
  return implementation === "planned" ? "planned" : "implemented";
}

function legacyRecipeRuntimes(id: string): RecipeRuntime[] {
  return VERIFIED_BROWSER_RECIPE_IDS.has(id) ? ["browser"] : [];
}

function options(values: Partial<Record<EditorControl, string[]>>) {
  return values;
}

const imageFormatOptions = options({
  resolution: ["Original", "512 px wide", "1024 px wide", "1920 px wide"],
  crop: ["Fit entire source", "Center square crop", "Center 4:5 crop", "Center 16:9 crop"],
  compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview"],
  color: ["Preserve transparency", "White matte", "Black matte"],
  batchNaming: ["Keep source name", "Clean filename", "Format suffix"]
});

const pdfPageOptions = options({
  pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
  resolution: ["96 DPI", "150 DPI", "200 DPI", "300 DPI"],
  compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
  batchNaming: ["Page number suffix", "Page number only", "Clean filename"],
  bundle: ["Store ZIP", "Balanced ZIP", "Balanced ZIP with manifest", "Maximum ZIP with manifest"]
});

function videoTranscodeOptions() {
  return options({
    trim: MEDIA_TRIM_OPTIONS,
    aspectRatio: ["Original", "16:9 widescreen", "9:16 vertical", "1:1 square", "4:5 portrait"],
    crop: ["Fit inside", "Fill and crop", "Stretch"],
    resolution: ["Source resolution", "360p preview", "720p", "1080p", "1440p", "4K"],
    frameRate: ["Source frame rate", "12 fps", "24 fps", "30 fps", "60 fps"],
    compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
    metadata: ["Keep tags", "Strip tags"],
    batchNaming: ["Converted suffix", "Clean filename"]
  });
}

const MEDIA_TRIM_OPTIONS = ["Full file", "First 1 second", "First 5 seconds", "First 15 seconds", "First 30 seconds", "Custom range"];
const VIDEO_INPUT_FORMATS = ["mp4", "webm", "mov", "m4v", "mkv", "ts"];
const AUDIO_INPUT_FORMATS = [
  "wav",
  "mp3",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "webm",
  "mka",
  "mov",
  "m4r",
  "aiff",
  "caf",
  "ac3",
  "eac3",
  "oga",
  "wma",
  "wv",
  "tta",
  "mp2",
  "au",
  "w64",
  "3gp"
];
const AUDIO_SAMPLE_RATE_OPTIONS = ["Source sample rate", "44.1 kHz", "48 kHz", "96 kHz"];
const AUDIO_CHANNEL_OPTIONS = ["Source channels", "Mono", "Stereo"];
const AUDIO_BITRATE_OPTIONS = ["320 kbps", "256 kbps", "192 kbps", "160 kbps", "128 kbps", "96 kbps", "64 kbps"];
const AUDIO_METADATA_OPTIONS = ["Keep tags", "Strip tags"];
const AUDIO_NAMING_OPTIONS = ["Converted suffix", "Clean filename"];
const LOSSY_AUDIO_OPTIONS = options({
  trim: MEDIA_TRIM_OPTIONS,
  sampleRate: AUDIO_SAMPLE_RATE_OPTIONS,
  audioChannels: AUDIO_CHANNEL_OPTIONS,
  compression: AUDIO_BITRATE_OPTIONS,
  metadata: AUDIO_METADATA_OPTIONS,
  batchNaming: AUDIO_NAMING_OPTIONS
});
const LOSSLESS_AUDIO_OPTIONS = options({
  trim: MEDIA_TRIM_OPTIONS,
  sampleRate: AUDIO_SAMPLE_RATE_OPTIONS,
  audioChannels: AUDIO_CHANNEL_OPTIONS,
  bitDepth: ["16-bit lossless", "24-bit lossless"],
  metadata: AUDIO_METADATA_OPTIONS,
  batchNaming: AUDIO_NAMING_OPTIONS
});

const TEXT_INPUT_FORMATS = [
  "txt", "text", "md", "markdown", "html", "htm", "css", "scss", "sass", "less", "js", "mjs", "cjs", "jsx", "ts", "tsx",
  "py", "pyw", "java", "c", "h", "cpp", "cc", "cxx", "hpp", "cs", "go", "rs", "rb", "php", "swift", "kt", "kts", "sh", "bash",
  "zsh", "fish", "ps1", "bat", "cmd", "lua", "r", "scala", "dart", "vue", "svelte", "toml", "ini", "cfg", "conf", "sql", "log",
  "tex", "latex", "org", "adoc", "asciidoc", "csv", "tsv", "json", "jsonl", "ndjson", "xml", "yaml", "yml"
];

const UNIVERSAL_RECIPES: ConversionRecipe[] = [
  recipe({ id: "file-to-zip", input: ["unknown"], category: "Universal", output: "ZIP", title: "Compress any file to ZIP", description: "Preserve the original bytes inside a standards-based ZIP archive.", treatments: ["Any file", "Original preserved", "ZIP"], keywords: ["zip", "compress", "archive", "any format", "universal"], editorControls: ["compression"], controlOptions: { compression: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] }, requiredCapabilities: ["zip", "worker"], intensity: "standard", engine: "zip.js" }),
  recipe({ id: "file-to-gzip", input: ["unknown"], category: "Universal", output: "GZIP", title: "Compress any file to gzip", description: "Create a portable .gz stream using the browser's native compression pipeline.", treatments: ["Any file", "gzip", "Portable"], keywords: ["gzip", "gz", "compress", "archive", "universal"], editorControls: [], requiredCapabilities: [], intensity: "standard", engine: "CompressionStream" }),
  recipe({ id: "file-checksum-manifest", input: ["unknown"], category: "Integrity", output: "JSON", title: "Create checksum manifest", description: "Calculate SHA-256, SHA-384, and SHA-512 fingerprints for any file.", treatments: ["SHA-256", "SHA-384", "SHA-512", "JSON"], keywords: ["checksum", "hash", "sha256", "integrity", "verify"], editorControls: [], requiredCapabilities: ["worker"], intensity: "standard", engine: "Web Crypto" }),
  recipe({ id: "file-metadata-report", input: ["unknown"], category: "Inspection", output: "JSON", title: "Export file metadata report", description: "Export detected format, dimensions, duration, document facts, risk notes, and source details.", treatments: ["Detection", "Metadata", "Safety", "JSON"], keywords: ["metadata", "inspect", "report", "details", "format"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Omni inspection core" }),
  recipe({ id: "file-byte-analysis", input: ["unknown"], category: "Inspection", output: "JSON", title: "Analyze file bytes", description: "Measure entropy, byte distribution, printable content, sample coverage, and header bytes.", treatments: ["Entropy", "Histogram", "Magic bytes", "JSON"], keywords: ["binary", "bytes", "entropy", "histogram", "forensic", "inspect"], editorControls: [], requiredCapabilities: ["worker"], intensity: "light", engine: "Typed arrays" }),
  recipe({ id: "file-to-base64", input: ["unknown"], category: "Developer", output: "TXT", title: "Encode file as Base64", description: "Convert any file into portable Base64 text.", treatments: ["Base64", "Text", "Portable"], keywords: ["base64", "encode", "developer", "text", "binary"], editorControls: [], requiredCapabilities: ["worker"], intensity: "standard", engine: "Typed arrays + Base64" }),
  recipe({ id: "file-to-data-uri", input: ["unknown"], category: "Developer", output: "TXT", title: "Create a Data URI", description: "Create a MIME-aware data: URI for embedding a file in code or markup.", treatments: ["Data URI", "MIME", "Base64", "Embed"], keywords: ["data uri", "embed", "inline", "base64", "developer"], editorControls: [], requiredCapabilities: ["worker"], intensity: "standard", engine: "Typed arrays + Base64" }),
  recipe({ id: "file-to-hex", input: ["unknown"], category: "Developer", output: "TXT", title: "Create readable hex dump", description: "Export byte offsets, hexadecimal values, and printable ASCII for any file.", treatments: ["Hex", "Offsets", "ASCII", "Text"], keywords: ["hex", "hexdump", "binary", "bytes", "forensic", "developer"], editorControls: [], requiredCapabilities: ["worker"], intensity: "standard", engine: "Typed arrays" }),
  recipe({ id: "file-chunk-zip", input: ["unknown"], category: "Universal", output: "Chunk ZIP", title: "Split file into portable chunks", description: "Split a file into ordered 10 MiB parts and package them with a reconstruction manifest.", treatments: ["10 MiB parts", "Manifest", "ZIP", "Original bytes"], keywords: ["split", "chunk", "parts", "zip", "large file", "manifest"], editorControls: ["compression"], controlOptions: { compression: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] }, requiredCapabilities: ["zip", "worker"], intensity: "heavy", engine: "Blob slicing + zip.js" }),
  recipe({ id: "text-to-html", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Text", output: "HTML", title: "Text to standalone HTML", description: "Turn UTF-8 text into a readable, responsive HTML document with escaped content.", treatments: ["Standalone", "Responsive", "Escaped", "HTML"], keywords: ["text", "html", "web", "document", "readable"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native UTF-8 + HTML" }),
  recipe({ id: "text-to-markdown", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Text", output: "Markdown", title: "Text to Markdown document", description: "Create a clean Markdown document with a source-derived heading.", treatments: ["Markdown", "Heading", "UTF-8"], keywords: ["text", "markdown", "md", "document"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native UTF-8" }),
  recipe({ id: "text-to-json", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Text", output: "JSON", title: "Text to JSON record", description: "Wrap text with source name, MIME type, character count, line count, and content.", treatments: ["Structured", "Source facts", "JSON"], keywords: ["text", "json", "record", "structured", "metadata"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON" }),
  recipe({ id: "text-to-pdf", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Document", output: "PDF", title: "Text to paginated PDF", description: "Create a clean Letter-size PDF with line wrapping and automatic pagination.", treatments: ["Paginated", "Letter", "Wrapped text", "PDF"], keywords: ["text", "pdf", "print", "document", "pages"], editorControls: [], requiredCapabilities: ["pdf"], intensity: "standard", engine: "pdf-lib" }),
  recipe({ id: "text-line-numbered", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Text", output: "TXT", title: "Add line numbers", description: "Export UTF-8 text with stable, zero-padded line numbers for review and reference.", treatments: ["Line numbers", "Review", "TXT"], keywords: ["line number", "numbered", "code", "review", "text"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native UTF-8" }),
  recipe({ id: "text-word-frequency", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Analysis", output: "JSON", title: "Analyze word frequency", description: "Count total and unique words and export the top 500 terms as JSON.", treatments: ["Word count", "Top terms", "Unicode", "JSON"], keywords: ["words", "frequency", "count", "analysis", "terms"], editorControls: [], requiredCapabilities: ["worker"], intensity: "light", engine: "Unicode text analysis" }),
  recipe({ id: "text-case-pack", input: ["document", "data", "code"], inputFormats: TEXT_INPUT_FORMATS, category: "Text", output: "ZIP", title: "Create text case pack", description: "Bundle original, lowercase, uppercase, and title-case copies in one ZIP.", treatments: ["Original", "Lowercase", "Uppercase", "Title case"], keywords: ["case", "uppercase", "lowercase", "title case", "zip", "text"], editorControls: ["compression"], controlOptions: { compression: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] }, requiredCapabilities: ["zip", "worker"], intensity: "light", engine: "Unicode text + zip.js" }),
  recipe({ id: "json-pretty", input: ["data"], inputFormats: ["json"], category: "Data", output: "JSON", title: "Pretty-print JSON", description: "Validate and format JSON with stable two-space indentation.", treatments: ["Validate", "Indent", "JSON"], keywords: ["json", "pretty", "format", "indent", "beautify"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON" }),
  recipe({ id: "json-minify", input: ["data"], inputFormats: ["json"], category: "Data", output: "JSON", title: "Minify JSON", description: "Validate JSON and remove unnecessary whitespace.", treatments: ["Validate", "Minify", "JSON"], keywords: ["json", "minify", "compact", "whitespace"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON" }),
  recipe({ id: "json-to-jsonl", input: ["data"], inputFormats: ["json"], category: "Data", output: "JSON Lines", title: "JSON to JSON Lines", description: "Convert a JSON array into one valid JSON record per line.", treatments: ["JSON", "JSONL", "Records"], keywords: ["json", "jsonl", "ndjson", "lines", "records"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON" }),
  recipe({ id: "jsonl-to-json", input: ["data"], inputFormats: ["jsonl", "ndjson"], category: "Data", output: "JSON", title: "JSON Lines to JSON", description: "Validate every JSON Lines record and combine them into one JSON array.", treatments: ["JSONL", "NDJSON", "Array", "Validate"], keywords: ["jsonl", "ndjson", "json", "array", "records"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON" }),
  recipe({ id: "csv-to-tsv", input: ["data"], inputFormats: ["csv"], category: "Data", output: "TSV", title: "CSV to TSV", description: "Parse quoted CSV fields and export a tab-separated table.", treatments: ["CSV", "TSV", "Quoted fields"], keywords: ["csv", "tsv", "table", "tabs", "spreadsheet"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Bounded delimited parser" }),
  recipe({ id: "tsv-to-csv", input: ["data"], inputFormats: ["tsv"], category: "Data", output: "CSV", title: "TSV to CSV", description: "Parse tab-separated values and export correctly quoted CSV.", treatments: ["TSV", "CSV", "Quoted fields"], keywords: ["tsv", "csv", "table", "comma", "spreadsheet"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Bounded delimited parser" }),
  recipe({ id: "xml-to-json", input: ["data"], inputFormats: ["xml"], category: "Data", output: "JSON", title: "XML to JSON", description: "Parse well-formed XML without DTDs or entities and preserve attributes, text, and repeated elements.", treatments: ["XML", "JSON", "Attributes", "Safe parser"], keywords: ["xml", "json", "convert", "attributes", "elements"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "DOMParser + native JSON" }),
  recipe({ id: "json-to-xml", input: ["data"], inputFormats: ["json"], category: "Data", output: "XML", title: "JSON to XML", description: "Convert JSON objects and arrays into well-formed UTF-8 XML with safe element names.", treatments: ["JSON", "XML", "Escaped", "UTF-8"], keywords: ["json", "xml", "convert", "elements", "objects"], editorControls: [], requiredCapabilities: [], intensity: "light", engine: "Native JSON + XML writer" })
];

export const CONVERSION_RECIPES: ConversionRecipe[] = [
  ...UNIVERSAL_RECIPES,
  recipe({
    id: "image-to-pdf",
    input: ["image"],
    category: "PDF",
    output: "PDF",
    title: "Image to PDF",
    description: "Convert the image into a clean single-page PDF.",
    treatments: ["Single page", "Original size", "PDF"],
    keywords: ["document", "paper", "print", "portable document", "share", "page"],
    editorControls: ["pageSize", "margins", "crop", "compression", "metadata", "batchNaming"],
    controlOptions: options({
      pageSize: ["Original image size at 96 PPI", "Letter", "A4", "16:9 slide", "4:5 carousel", "1:1 square"],
      margins: ["None", "Narrow", "Standard", "Wide"],
      crop: ["Fit entire source", "Fill page"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Keep source filename", "Strip source details"],
      batchNaming: ["Keep source name", "Clean filename", "PDF suffix"]
    }),
    requiredCapabilities: ["canvas", "pdf", "image"],
    intensity: "light",
    engine: "pdf-lib + Canvas",
    implementation: "ready"
  }),
  recipe({
    id: "image-print-pdf",
    input: ["image"],
    category: "PDF",
    output: "Print PDF",
    title: "Image to print PDF",
    description: "Place the image on a print page with safe margins.",
    treatments: ["Letter/A4", "Centered", "Margins"],
    keywords: ["print", "paper", "letter", "page", "pdf", "document", "handout"],
    editorControls: ["pageSize", "margins", "crop", "compression", "metadata", "batchNaming"],
    controlOptions: options({
      pageSize: ["Letter", "A4", "Legal", "A5"],
      margins: ["None", "Narrow", "Standard", "Wide"],
      crop: ["Fit entire source", "Fill page"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Keep source filename", "Strip source details"],
      batchNaming: ["Keep source name", "Clean filename", "Print suffix"]
    }),
    requiredCapabilities: ["canvas", "pdf", "image"],
    intensity: "light",
    engine: "pdf-lib + Canvas",
    implementation: "ready"
  }),
  recipe({
    id: "image-to-png",
    input: ["image"],
    category: "Image format",
    output: "PNG",
    title: "Image to PNG",
    description: "Convert to PNG for transparency and lossless exports.",
    treatments: ["Lossless", "Transparency", "PNG"],
    keywords: ["transparent", "alpha", "lossless", "picture", "photo", "graphic", "screenshot"],
    editorControls: ["resolution", "crop", "color", "batchNaming"],
    controlOptions: imageFormatOptions,
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    implementation: "ready"
  }),
  recipe({
    id: "image-to-jpeg",
    input: ["image"],
    category: "Image format",
    output: "JPEG",
    title: "Image to JPEG",
    description: "Convert to JPEG for photos, previews, and smaller files.",
    treatments: ["Photo", "White matte", "JPG"],
    keywords: ["jpg", "jpeg", "photo", "picture", "small", "compressed", "web"],
    editorControls: ["resolution", "crop", "color", "compression", "batchNaming"],
    controlOptions: { ...imageFormatOptions, color: ["White matte", "Black matte"] },
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    implementation: "ready"
  }),
  recipe({
    id: "image-to-webp",
    input: ["image"],
    category: "Image format",
    output: "WebP",
    title: "Image to WebP",
    description: "Convert to WebP for modern web use and compact previews.",
    treatments: ["Modern web", "Quality", "Small file"],
    keywords: ["web", "site", "browser", "small", "compressed", "preview", "photo"],
    editorControls: ["resolution", "crop", "color", "compression", "batchNaming"],
    controlOptions: imageFormatOptions,
    requiredCapabilities: ["canvas", "image", "webpEncoder"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    implementation: "ready"
  }),
  recipe({
    id: "image-to-avif",
    input: ["image"],
    category: "Image format",
    output: "AVIF",
    title: "Image to AVIF",
    description: "Convert to AVIF when the browser encoder is available.",
    treatments: ["Modern web", "High compression", "AVIF"],
    keywords: ["avif", "web", "small", "compressed", "photo", "picture", "modern"],
    editorControls: ["resolution", "crop", "color", "compression", "batchNaming"],
    controlOptions: imageFormatOptions,
    requiredCapabilities: ["canvas", "image", "avifEncoder"],
    intensity: "light",
    engine: "Canvas / browser encoder",
    implementation: "ready"
  }),
  recipe({
    id: "image-to-bmp",
    input: ["image"],
    category: "Image format",
    output: "BMP",
    title: "Image to BMP",
    description: "Convert to a standard bitmap file for older apps.",
    treatments: ["Bitmap", "Legacy", "No alpha"],
    keywords: ["bmp", "bitmap", "windows", "legacy", "raw", "image", "picture"],
    editorControls: ["resolution", "crop", "color", "batchNaming"],
    controlOptions: { ...imageFormatOptions, color: ["White matte", "Black matte"] },
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas + BMP encoder",
    implementation: "ready"
  }),
  recipe({
    id: "image-svg-wrapper",
    input: ["image"],
    category: "Web embed",
    output: "SVG",
    title: "Image to SVG wrapper",
    description: "Wrap the original raster pixels inside an SVG frame; this does not vectorize the image.",
    treatments: ["SVG wrapper", "Embedded raster", "Scalable frame"],
    keywords: ["svg", "vector", "wrapper", "embed", "xml", "graphic", "image"],
    editorControls: ["resolution", "batchNaming"],
    controlOptions: { resolution: imageFormatOptions.resolution, batchNaming: imageFormatOptions.batchNaming },
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "SVG data wrapper",
    implementation: "ready"
  }),
  recipe({
    id: "image-data-uri",
    input: ["image"],
    category: "Web embed",
    output: "TXT",
    title: "Image to data URI",
    description: "Export the image as a Base64 data URI text file.",
    treatments: ["Base64", "Data URI", "Text"],
    keywords: ["base64", "data uri", "embed", "inline", "css", "html", "text"],
    editorControls: ["batchNaming"],
    controlOptions: { batchNaming: imageFormatOptions.batchNaming },
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "FileReader / Base64",
    implementation: "ready"
  }),
  recipe({
    id: "image-html-embed",
    input: ["image"],
    category: "Web embed",
    output: "HTML",
    title: "Image to HTML embed",
    description: "Create a standalone HTML file with the image embedded.",
    treatments: ["HTML", "Embedded", "Portable"],
    keywords: ["html", "webpage", "embed", "inline", "browser", "site", "share"],
    editorControls: ["resolution", "batchNaming"],
    controlOptions: { resolution: imageFormatOptions.resolution, batchNaming: imageFormatOptions.batchNaming },
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "HTML data embed",
    implementation: "ready"
  }),
  recipe({
    id: "image-thumbnail-set",
    input: ["image"],
    category: "Image package",
    output: "ZIP",
    title: "Image thumbnail ZIP",
    description: "Generate web-ready thumbnails in multiple sizes.",
    treatments: ["WebP or JPEG", "Multiple widths", "Manifest"],
    keywords: ["thumbnail", "thumb", "preview", "sizes", "web", "social", "zip", "bundle"],
    editorControls: ["outputFormat", "resolution", "compression", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["WebP", "JPEG"],
      resolution: ["160/320/640 set", "320/640/1080/1920 set", "512/1024/2048 set"],
      compression: ["Maximum quality", "Balanced", "Small file"],
      batchNaming: ["Width suffix", "Numbered sequence"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "image-favicon-set",
    input: ["image"],
    category: "Image package",
    output: "ZIP",
    title: "Favicon and app icon ZIP",
    description: "Create browser and app icon PNG sizes plus a manifest.",
    treatments: ["16", "32", "180", "512"],
    keywords: ["icon", "favicon", "app icon", "logo", "manifest", "png", "site", "zip"],
    editorControls: ["crop", "resolution", "batchNaming", "bundle"],
    controlOptions: {
      crop: ["Fit inside transparent square", "Center square crop"],
      resolution: ["16/32/48/180/192/512 set", "Full PWA set", "Browser-only set"],
      batchNaming: ["Source and size", "Standard icon names"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["canvas", "image", "zip"],
    intensity: "light",
    engine: "Canvas + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "image-format-bundle",
    input: ["image"],
    category: "Image package",
    output: "ZIP",
    title: "PNG JPEG WebP ZIP",
    description: "Download PNG, JPEG, and WebP versions together.",
    treatments: ["PNG", "JPEG", "WebP", "ZIP"],
    keywords: ["bundle", "zip", "all", "multiple", "formats", "png", "jpg", "webp"],
    editorControls: ["outputFormat", "resolution", "crop", "color", "compression", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["PNG + JPEG + WebP", "PNG + JPEG", "PNG + WebP", "JPEG + WebP"],
      resolution: imageFormatOptions.resolution,
      crop: imageFormatOptions.crop,
      color: imageFormatOptions.color,
      compression: ["Maximum quality", "Balanced", "Small file"],
      batchNaming: imageFormatOptions.batchNaming,
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "image-social-pack",
    input: ["image"],
    category: "Image package",
    output: "ZIP",
    title: "Social image size ZIP",
    description: "Create exact post, story, banner, thumbnail, and open-graph image sizes.",
    treatments: ["Open Graph", "Story", "Square", "Banner"],
    keywords: ["social", "linkedin", "instagram", "youtube", "thumbnail", "banner", "open graph"],
    editorControls: ["outputFormat", "aspectRatio", "crop", "resolution", "compression", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["JPEG", "WebP"],
      aspectRatio: ["All platform ratios", "Square only", "Portrait only", "Landscape only"],
      crop: ["Fill frame", "Fit entire source"],
      resolution: ["Platform size", "Half-size preview"],
      compression: ["Maximum quality", "Balanced", "Small file"],
      batchNaming: ["Platform names", "Source prefix"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["canvas", "image", "zip"],
    intensity: "light",
    engine: "Canvas + zip.js social presets"
  }),
  recipe({
    id: "image-ocr-text",
    input: ["image"],
    category: "Text extraction",
    output: "TXT",
    title: "Image OCR to text",
    description: "Read visible text from an image and export a plain text file.",
    treatments: ["OCR", "Text", "Language select"],
    keywords: ["ocr", "text", "read", "scan", "extract", "copy"],
    editorControls: ["outputFormat", "resolution", "metadata", "batchNaming"],
    controlOptions: { outputFormat: ["TXT", "Markdown", "Searchable sidecar JSON"], resolution: ["Original", "2x OCR scale", "4x OCR scale"], metadata: ["Keep", "Attach confidence report"] },
    requiredCapabilities: ["ocr", "worker"],
    intensity: "heavy",
    engine: "Tesseract.js"
  }),
  recipe({
    id: "image-to-motion-card",
    input: ["image"],
    category: "Motion",
    output: "MP4",
    title: "Image to motion card",
    description: "Turn a still image into a short MP4, WebM, or GIF loop.",
    treatments: ["2s loop", "5s loop", "Zoom", "Pan"],
    keywords: ["mp4", "webm", "gif", "motion", "video", "loop", "animate"],
    editorControls: ["outputFormat", "timeline", "aspectRatio", "resolution", "frameRate", "compression", "bundle"],
    controlOptions: { outputFormat: ["MP4", "WebM", "GIF"], timeline: ["2 seconds", "5 seconds", "10 seconds"], frameRate: ["12 fps", "24 fps", "30 fps"] },
    requiredCapabilities: ["canvas", "wasm", "worker", "video"],
    intensity: "heavy",
    engine: "Canvas + MediaRecorder / FFmpeg WASM"
  }),

  recipe({
    id: "pdf-to-text",
    input: ["pdf"],
    category: "Text extraction",
    output: "TXT",
    title: "PDF to plain text",
    description: "Extract selectable PDF text into a clean text file.",
    treatments: ["Text", "Page breaks", "TXT"],
    keywords: ["pdf", "text", "extract", "copy", "ocr", "read"],
    editorControls: ["pageOrder", "metadata", "batchNaming"],
    controlOptions: { pageOrder: [...PDF_PAGE_SELECTION_OPTIONS], metadata: ["Add page headings", "Keep page breaks", "Remove page breaks"], batchNaming: ["TXT suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "PDF.js text extraction",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-to-markdown",
    input: ["pdf"],
    category: "Text extraction",
    output: "Markdown",
    title: "PDF to Markdown",
    description: "Extract PDF text into a Markdown document with page sections.",
    treatments: ["Markdown", "Page headings", "MD"],
    keywords: ["pdf", "markdown", "md", "text", "extract", "document"],
    editorControls: ["pageOrder", "metadata", "batchNaming"],
    controlOptions: { pageOrder: [...PDF_PAGE_SELECTION_OPTIONS], metadata: ["Page headings", "Minimal headings", "Include source metadata"], batchNaming: ["Markdown suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "PDF.js text extraction",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-to-html",
    input: ["pdf"],
    category: "Text extraction",
    output: "HTML",
    title: "PDF to HTML text page",
    description: "Export extracted PDF text into a standalone HTML page.",
    treatments: ["HTML", "Page sections", "Embedded style"],
    keywords: ["pdf", "html", "web", "text", "extract", "document"],
    editorControls: ["pageOrder", "metadata", "batchNaming"],
    controlOptions: { pageOrder: [...PDF_PAGE_SELECTION_OPTIONS], metadata: ["Include source metadata", "Minimal"], batchNaming: ["HTML suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "PDF.js text extraction",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-page-png-set",
    input: ["pdf"],
    category: "Page images",
    output: "PNG ZIP",
    title: "PDF pages to PNG ZIP",
    description: "Render each PDF page as a PNG image and download a ZIP.",
    treatments: ["Page images", "PNG", "ZIP"],
    keywords: ["pdf", "png", "image", "pages", "render", "slides", "deck"],
    editorControls: ["pageOrder", "resolution", "batchNaming", "bundle"],
    controlOptions: pdfPageOptions,
    requiredCapabilities: ["pdf", "canvas", "worker", "zip"],
    intensity: "standard",
    engine: "PDF.js canvas renderer + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-page-jpeg-set",
    input: ["pdf"],
    category: "Page images",
    output: "JPEG ZIP",
    title: "PDF pages to JPEG ZIP",
    description: "Render each PDF page as a JPEG image bundle.",
    treatments: ["Page images", "JPEG", "ZIP"],
    keywords: ["pdf", "jpg", "jpeg", "image", "pages", "render", "small"],
    editorControls: ["pageOrder", "resolution", "compression", "batchNaming", "bundle"],
    controlOptions: pdfPageOptions,
    requiredCapabilities: ["pdf", "canvas", "worker", "zip"],
    intensity: "standard",
    engine: "PDF.js canvas renderer + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-split-pages",
    input: ["pdf"],
    category: "PDF edit",
    output: "PDF ZIP",
    title: "Split PDF into page PDFs",
    description: "Create one PDF file per page and bundle them in a ZIP.",
    treatments: ["Split", "One PDF per page", "ZIP"],
    keywords: ["pdf", "split", "pages", "separate", "extract", "zip"],
    editorControls: ["pageOrder", "batchNaming", "bundle"],
    controlOptions: { pageOrder: [...PDF_PAGE_SELECTION_OPTIONS], batchNaming: ["Page number suffix", "Page number only", "Clean filename"], bundle: ["Store ZIP", "Balanced ZIP", "Balanced ZIP with manifest", "Maximum ZIP with manifest"] },
    requiredCapabilities: ["pdf", "zip", "worker"],
    intensity: "standard",
    engine: "pdf-lib + zip.js",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-extract-pages",
    input: ["pdf"],
    category: "PDF edit",
    output: "PDF",
    title: "Extract selected pages",
    description: "Create one PDF from the pages and order you choose.",
    treatments: ["Select pages", "Reorder", "PDF"],
    keywords: ["pdf", "extract", "select", "pages", "reorder", "subset"],
    editorControls: ["pageOrder", "metadata", "batchNaming"],
    controlOptions: {
      pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
      metadata: ["Keep document details", "Strip document details"],
      batchNaming: ["Extracted suffix", "Clean filename"]
    },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "light",
    engine: "pdf-lib page copier",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-reorder-pages",
    input: ["pdf"],
    category: "PDF edit",
    output: "PDF",
    title: "Reorder PDF pages",
    description: "Create a PDF with every page in a new deterministic order.",
    treatments: ["Reverse", "Odd/even order", "PDF"],
    keywords: ["pdf", "reorder", "reverse", "sort", "pages", "odd", "even"],
    editorControls: ["pageOrder", "metadata", "batchNaming"],
    controlOptions: {
      pageOrder: ["Reverse order", "Odd pages, then even pages", "Even pages, then odd pages", "All pages"],
      metadata: ["Keep document details", "Strip document details"],
      batchNaming: ["Reordered suffix", "Clean filename"]
    },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "light",
    engine: "pdf-lib page copier",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-rotate-pages",
    input: ["pdf"],
    category: "PDF edit",
    output: "PDF",
    title: "Rotate PDF pages",
    description: "Rotate all or selected pages while preserving the rest of the document.",
    treatments: ["Select pages", "90 or 180 degrees", "PDF"],
    keywords: ["pdf", "rotate", "turn", "portrait", "landscape", "pages"],
    editorControls: ["pageOrder", "rotation", "metadata", "batchNaming"],
    controlOptions: {
      pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
      rotation: ["90 degrees clockwise", "180 degrees", "90 degrees counterclockwise"],
      metadata: ["Keep document details", "Strip document details"],
      batchNaming: ["Rotated suffix", "Clean filename"]
    },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "light",
    engine: "pdf-lib page rotation",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-metadata-report",
    input: ["pdf"],
    category: "Inspect",
    output: "JSON",
    title: "PDF metadata report",
    description: "Export page count, title fields, and basic document facts as JSON.",
    treatments: ["Metadata", "Page count", "JSON"],
    keywords: ["pdf", "metadata", "inspect", "json", "manifest", "report"],
    editorControls: ["metadata", "batchNaming"],
    controlOptions: { metadata: ["Full metadata report", "Document info only"], batchNaming: ["Metadata suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "light",
    engine: "PDF.js + pdf-lib",
    implementation: "ready"
  }),
  recipe({
    id: "pdf-slide-images",
    input: ["pdf"],
    category: "Presentation",
    output: "PNG ZIP",
    title: "PDF to slide images",
    description: "Render selected pages as exact 16:9 or 4:3 PNG slides.",
    treatments: ["16:9 or 4:3", "Slide PNGs", "ZIP"],
    keywords: ["presentation", "deck", "slides", "ppt", "keynote", "pdf", "images"],
    editorControls: ["pageOrder", "aspectRatio", "resolution", "color", "batchNaming", "bundle"],
    controlOptions: {
      pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
      aspectRatio: ["16:9 widescreen", "4:3 classic slides"],
      resolution: ["1024 px wide", "1920 px wide", "4K wide"],
      color: ["White letterbox", "Black letterbox"],
      batchNaming: ["Slide number suffix", "Page number only", "Clean filename"],
      bundle: ["Store ZIP", "Balanced ZIP", "Balanced ZIP with manifest", "Maximum ZIP with manifest"]
    },
    requiredCapabilities: ["pdf", "canvas", "worker", "zip"],
    intensity: "standard",
    engine: "PDF.js slide renderer"
  }),
  recipe({
    id: "pdf-pptx-outline",
    input: ["pdf"],
    category: "Presentation",
    output: "PPTX outline",
    title: "PDF to PPTX outline",
    description: "Create an editable PPTX text outline from selected page text; this is not a visual replica of the PDF.",
    treatments: ["Editable text", "Title and body", "PPTX outline"],
    keywords: ["presentation", "deck", "pptx", "powerpoint", "outline", "speaker notes"],
    editorControls: ["pageOrder", "metadata", "batchNaming", "bundle"],
    controlOptions: {
      pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
      metadata: ["Include source note", "Slide text only"],
      batchNaming: ["Outline suffix", "Clean filename"],
      bundle: ["Store compression", "Balanced compression", "Maximum compression"]
    },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "PDF.js + PPTX writer"
  }),
  recipe({
    id: "pdf-carousel-images",
    input: ["pdf"],
    category: "Social",
    output: "Carousel ZIP",
    title: "PDF to LinkedIn carousel images",
    description: "Render each page into carousel-ready images with exact ratios.",
    treatments: ["4:5", "1:1", "Page images", "ZIP"],
    keywords: ["linkedin", "carousel", "social", "slides", "images", "pdf"],
    editorControls: ["pageOrder", "aspectRatio", "resolution", "crop", "batchNaming", "bundle"],
    controlOptions: {
      pageOrder: [...PDF_PAGE_SELECTION_OPTIONS],
      aspectRatio: ["4:5 portrait", "1:1 square", "16:9 widescreen"],
      resolution: ["1080 px wide", "1920 px wide", "4K wide"],
      crop: ["Fit entire page", "Fill target"],
      batchNaming: ["Carousel number suffix", "Page number only", "Clean filename"],
      bundle: ["Store ZIP", "Balanced ZIP", "Balanced ZIP with manifest", "Maximum ZIP with manifest"]
    },
    requiredCapabilities: ["pdf", "canvas", "worker", "zip"],
    intensity: "standard",
    engine: "PDF.js social renderer"
  }),
  recipe({
    id: "pdf-handout-pdf",
    input: ["pdf"],
    category: "PDF edit",
    output: "Handout PDF",
    title: "PDF to handout PDF",
    description: "Place multiple pages per sheet for printable handouts.",
    treatments: ["2-up", "4-up", "Margins", "PDF"],
    keywords: ["handout", "print", "pages per sheet", "pdf", "presentation"],
    editorControls: ["pageOrder", "pageLayout", "pageSize", "margins", "metadata", "batchNaming"],
    controlOptions: { pageOrder: [...PDF_PAGE_SELECTION_OPTIONS], pageLayout: ["2 pages per sheet", "4 pages per sheet"], pageSize: ["Letter", "A4"], margins: ["Narrow", "Standard", "Wide"], metadata: ["Keep document details", "Strip document details"], batchNaming: ["Handout suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "pdf-lib page layout"
  }),
  recipe({
    id: "pdf-extract-images",
    input: ["pdf"],
    category: "Asset extraction",
    output: "Image ZIP",
    title: "Extract images from PDF",
    description: "Extract embedded images when the PDF structure exposes them.",
    treatments: ["Images", "Manifest", "ZIP"],
    keywords: ["extract", "images", "assets", "pdf", "zip"],
    editorControls: ["pageOrder", "resolution", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["pdf", "worker", "zip"],
    intensity: "heavy",
    engine: "PDF object parser"
  }),
  recipe({
    id: "pdf-ocr-searchable",
    input: ["pdf"],
    category: "OCR",
    output: "Searchable PDF",
    title: "Scanned PDF to searchable PDF",
    description: "Run OCR on rendered pages and create a searchable companion document.",
    treatments: ["OCR", "Text layer", "PDF"],
    keywords: ["ocr", "scan", "searchable", "text layer", "pdf"],
    editorControls: ["pageOrder", "resolution", "outputFormat", "metadata", "batchNaming"],
    controlOptions: { outputFormat: ["Searchable PDF", "TXT sidecar", "Markdown sidecar"], resolution: ["150 DPI", "200 DPI", "300 DPI"] },
    requiredCapabilities: ["pdf", "canvas", "ocr", "worker"],
    intensity: "extreme",
    engine: "PDF.js + Tesseract.js + pdf-lib"
  }),
  recipe({
    id: "pdf-compress",
    input: ["pdf"],
    category: "PDF edit",
    output: "Optimized PDF",
    title: "Optimize or visually compress PDF",
    description: "Rewrite PDF structure losslessly, or flatten pages at 150 or 96 DPI for stronger visual compression with selectable text removed.",
    treatments: ["Lossless rewrite", "Visual flattening", "PDF"],
    keywords: ["compress", "optimize", "small", "pdf", "metadata"],
    editorControls: ["compression", "metadata", "batchNaming"],
    controlOptions: { compression: ["Lossless structure rewrite", "Balanced visual flattening (150 DPI)", "Smallest visual flattening (96 DPI)"], metadata: ["Keep document details", "Strip document details"], batchNaming: ["Optimized suffix", "Clean filename"] },
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "pdf-lib optimizer"
  }),

  recipe({
    id: "video-to-frames",
    input: ["video"],
    inputFormats: VIDEO_INPUT_FORMATS,
    category: "Frames",
    output: "Frame ZIP",
    title: "Video to image frames",
    description: "Decode every frame or exact timeline intervals into a validated image ZIP with optional manifest.",
    treatments: ["Every frame", "Timed sampling", "PNG/JPEG/WebP", "Manifest"],
    keywords: ["video", "frames", "stills", "png", "jpg", "jpeg", "webp", "extract", "sequence", "zip"],
    editorControls: ["outputFormat", "trim", "frameInterval", "resolution", "compression", "metadata", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["PNG", "JPEG", "WebP"],
      trim: MEDIA_TRIM_OPTIONS,
      frameInterval: ["Every 0.5 seconds", "Every 1 second", "Every 2 seconds", "Every 5 seconds", "Every frame"],
      resolution: ["Source resolution", "80 px wide", "720 px wide", "1280 px wide", "1920 px wide"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Include manifest", "Files only"],
      batchNaming: ["Timestamp names", "Sequence names"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["video", "canvas", "webcodecs", "worker", "zip"],
    intensity: "standard",
    engine: "Mediabunny VideoSampleSink + Canvas + zip.js"
  }),
  recipe({
    id: "video-to-mp4",
    input: ["video"],
    inputFormats: VIDEO_INPUT_FORMATS,
    category: "Video format",
    output: "MP4",
    title: "Video to MP4",
    description: "Transcode the primary video and audio tracks to AVC/AAC MP4 with real trim, geometry, frame-rate, quality, tag, and naming controls.",
    treatments: ["AVC video", "AAC audio", "Trim", "Resize/crop"],
    keywords: ["video", "mp4", "h264", "avc", "aac", "transcode", "resize", "crop", "compress"],
    editorControls: ["trim", "aspectRatio", "crop", "resolution", "frameRate", "compression", "metadata", "batchNaming"],
    controlOptions: videoTranscodeOptions(),
    requiredCapabilities: ["video", "webcodecs", "worker"],
    intensity: "heavy",
    engine: "Mediabunny Conversion + WebCodecs AVC/AAC"
  }),
  recipe({
    id: "video-to-webm",
    input: ["video"],
    inputFormats: VIDEO_INPUT_FORMATS,
    category: "Video format",
    output: "WebM",
    title: "Video to WebM",
    description: "Transcode the primary tracks to VP9/Opus WebM with real trim, geometry, frame-rate, quality, tag, and naming controls.",
    treatments: ["VP9 video", "Opus audio", "Trim", "Resize/crop"],
    keywords: ["video", "webm", "vp9", "opus", "browser", "transcode", "resize", "crop", "compress"],
    editorControls: ["trim", "aspectRatio", "crop", "resolution", "frameRate", "compression", "metadata", "batchNaming"],
    controlOptions: videoTranscodeOptions(),
    requiredCapabilities: ["video", "webcodecs", "worker"],
    intensity: "heavy",
    engine: "Mediabunny Conversion + WebCodecs VP9/Opus"
  }),
  recipe({
    id: "video-to-gif",
    input: ["video"],
    category: "Motion",
    output: "GIF",
    title: "Video to GIF",
    description: "Trim a short section and export a looping GIF.",
    treatments: ["GIF", "Loop", "Trim", "Palette"],
    editorControls: ["timeline", "trim", "aspectRatio", "resolution", "frameRate", "compression", "batchNaming"],
    requiredCapabilities: ["video", "canvas", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM"
  }),
  recipe({
    id: "video-to-audio",
    input: ["video"],
    inputFormats: VIDEO_INPUT_FORMATS,
    category: "Audio extraction",
    output: "Audio",
    title: "Video to audio file",
    description: "Extract the primary audio track as PCM WAV, AAC, M4A, or Opus OGG with trim, resampling, channels, quality, tags, and naming controls.",
    treatments: ["WAV", "M4A", "AAC", "OGG"],
    keywords: ["video", "audio", "extract", "wav", "m4a", "aac", "ogg", "opus", "sound"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: {
      outputFormat: ["WAV", "M4A", "AAC", "OGG"],
      trim: MEDIA_TRIM_OPTIONS,
      sampleRate: ["Source sample rate", "44.1 kHz", "48 kHz"],
      audioChannels: ["Source channels", "Mono", "Stereo"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Keep tags", "Strip tags"],
      batchNaming: ["Audio suffix", "Clean filename"]
    },
    requiredCapabilities: ["audio", "video", "webcodecs", "worker"],
    intensity: "standard",
    engine: "Mediabunny Conversion + PCM/AAC/Opus encoders"
  }),
  recipe({
    id: "video-thumbnail-sheet",
    input: ["video"],
    inputFormats: VIDEO_INPUT_FORMATS,
    category: "Frames",
    output: "Contact sheet",
    title: "Video thumbnail contact sheet",
    description: "Sample the full timeline into a 2x2, 3x3, 4x3, or 4x4 raster contact sheet with optional timestamps.",
    treatments: ["Timeline overview", "Grid", "PNG/JPEG/WebP", "Timestamps"],
    keywords: ["video", "thumbnail", "contact sheet", "storyboard", "timeline", "grid", "png", "jpg", "webp"],
    editorControls: ["outputFormat", "trim", "pageLayout", "crop", "resolution", "metadata", "batchNaming"],
    controlOptions: {
      outputFormat: ["PNG", "JPEG", "WebP"],
      trim: MEDIA_TRIM_OPTIONS,
      pageLayout: ["3 x 3 grid", "2 x 2 grid", "4 x 3 grid", "4 x 4 grid"],
      crop: ["Fill cells", "Fit inside cells", "Stretch to cells"],
      resolution: ["1200 px wide", "800 px wide", "1920 px wide", "2400 px wide"],
      metadata: ["Show timestamps", "No timestamps"],
      batchNaming: ["Contact sheet suffix", "Clean filename"]
    },
    requiredCapabilities: ["video", "canvas", "webcodecs", "worker"],
    intensity: "standard",
    engine: "Mediabunny VideoSampleSink + Canvas"
  }),
  recipe({
    id: "audio-to-mp3",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "MP3",
    title: "Audio to MP3",
    description: "Encode a real LAME MP3 with trim, sample-rate, channel, bitrate, tag, and naming controls.",
    treatments: ["LAME MP3", "64-320 kbps", "Trim", "Mono/stereo"],
    keywords: ["mp3", "mpeg audio", "music", "podcast", "compressed audio", "bitrate", "trim"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny + LAME WASM"
  }),
  recipe({
    id: "audio-to-flac",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "FLAC",
    title: "Audio to FLAC",
    description: "Encode lossless FLAC with real 16/24-bit output, resampling, channel, trim, tag, and naming controls.",
    treatments: ["Lossless FLAC", "16/24-bit", "Resample", "Trim"],
    keywords: ["flac", "lossless", "archive audio", "24 bit", "music", "wav compression"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"],
    controlOptions: LOSSLESS_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny + libFLAC WASM"
  }),
  recipe({
    id: "audio-to-m4a",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "M4A",
    title: "Audio to M4A",
    description: "Encode AAC-LC audio in an M4A container with trim, resampling, channels, bitrate, tags, and fast-start metadata.",
    treatments: ["AAC-LC", "M4A", "64-320 kbps", "Fast start"],
    keywords: ["m4a", "aac", "apple audio", "music", "podcast", "compressed audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny + AAC-LC WASM"
  }),
  recipe({
    id: "audio-to-aac",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "AAC",
    title: "Audio to AAC",
    description: "Encode raw AAC-LC frames in an ADTS file with trim, sample-rate, channel, bitrate, and naming controls.",
    treatments: ["AAC-LC", "ADTS", "64-320 kbps", "Trim"],
    keywords: ["aac", "adts", "audio codec", "compressed audio", "streaming audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny + AAC-LC WASM"
  }),
  recipe({
    id: "audio-to-ogg",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "OGG",
    title: "Audio to OGG",
    description: "Encode Opus audio in an Ogg container with trim, channel, bitrate, tag, and naming controls.",
    treatments: ["Ogg", "Opus", "64-320 kbps", "Trim"],
    keywords: ["ogg", "opus", "open audio", "web audio", "podcast", "voice"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "opusEncoder", "worker"],
    intensity: "standard",
    engine: "Mediabunny + WebCodecs Opus"
  }),
  recipe({
    id: "audio-to-opus",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "OPUS",
    title: "Audio to OPUS",
    description: "Encode Opus in its standard Ogg-based .opus file with trim, channels, bitrate, tags, and naming controls.",
    treatments: [".opus", "Ogg Opus", "Voice/music", "Trim"],
    keywords: ["opus", "ogg opus", "voice", "discord", "web", "compressed audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "opusEncoder", "worker"],
    intensity: "standard",
    engine: "Mediabunny + WebCodecs Opus"
  }),
  recipe({
    id: "audio-to-webm",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "Audio WebM",
    title: "Audio to WebM",
    description: "Create an audio-only WebM containing a real Opus track and no video track.",
    treatments: ["Audio-only WebM", "Opus", "Web delivery", "Trim"],
    keywords: ["webm", "audio webm", "opus", "browser", "web audio", "no video"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "opusEncoder", "worker"],
    intensity: "standard",
    engine: "Mediabunny WebM + WebCodecs Opus"
  }),
  recipe({
    id: "audio-to-mka",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "MKA",
    title: "Audio to MKA",
    description: "Create Matroska audio with a selectable FLAC, Opus, AC-3, or E-AC-3 track.",
    treatments: ["Matroska audio", "FLAC", "Opus", "AC-3 / E-AC-3"],
    keywords: ["mka", "matroska", "flac", "opus", "ac3", "eac3", "dolby digital"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSY_AUDIO_OPTIONS, outputFormat: ["Opus in MKA", "FLAC in MKA", "AC-3 in MKA", "E-AC-3 in MKA"], bitDepth: ["16-bit lossless", "24-bit lossless"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny Matroska + local audio encoders"
  }),
  recipe({
    id: "audio-to-mov",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "MOV audio",
    title: "Audio to MOV",
    description: "Create an audio-only QuickTime MOV with selectable AAC or uncompressed 16-bit PCM audio.",
    treatments: ["QuickTime MOV", "AAC", "PCM", "Audio only"],
    keywords: ["mov", "quicktime", "audio only", "aac", "pcm", "editing"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSY_AUDIO_OPTIONS, outputFormat: ["AAC in MOV", "16-bit PCM in MOV"], bitDepth: ["16-bit PCM"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny QuickTime + AAC/PCM writer"
  }),
  recipe({
    id: "audio-to-m4r",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "M4R",
    title: "Audio to M4R ringtone",
    description: "Encode an AAC ringtone file with precise trim, bitrate, channel, tag, and filename controls.",
    treatments: ["M4R", "AAC ringtone", "Precise trim", "Apple compatible"],
    keywords: ["m4r", "ringtone", "iphone", "ios", "aac", "trim audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Mediabunny M4A + AAC-LC WASM"
  }),
  recipe({
    id: "audio-to-aiff",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "AIFF",
    title: "Audio to AIFF",
    description: "Create an uncompressed AIFF for music production with selectable 16-bit, 24-bit, or 32-bit float PCM.",
    treatments: ["AIFF", "PCM", "16/24-bit", "32-bit float"],
    keywords: ["aiff", "aif", "apple audio", "pro tools", "logic", "production", "pcm", "uncompressed"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, bitDepth: ["16-bit PCM", "24-bit PCM", "32-bit float"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM AIFF encoder"
  }),
  recipe({
    id: "audio-to-alac",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "ALAC",
    title: "Audio to ALAC",
    description: "Encode Apple Lossless audio in an M4A container with selectable 16-bit or 24-bit precision.",
    treatments: ["Apple Lossless", "M4A", "16/24-bit", "Music library"],
    keywords: ["alac", "apple lossless", "m4a lossless", "itunes", "music", "archive audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"],
    controlOptions: LOSSLESS_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM ALAC encoder"
  }),
  recipe({
    id: "audio-to-caf",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "CAF",
    title: "Audio to CAF",
    description: "Create an Apple Core Audio file containing ALAC, 16/24-bit PCM, or 32-bit float audio.",
    treatments: ["Core Audio", "ALAC", "PCM", "32-bit float"],
    keywords: ["caf", "core audio", "apple", "garageband", "logic", "alac", "pcm"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, outputFormat: ["24-bit PCM in CAF", "16-bit PCM in CAF", "32-bit float in CAF", "ALAC in CAF"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM CAF muxer"
  }),
  recipe({
    id: "audio-to-ac3",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "AC-3",
    title: "Audio to AC-3",
    description: "Encode a standalone Dolby Digital AC-3 file for broadcast, disc, and home-theater workflows.",
    treatments: ["Dolby Digital", "Up to 5.1", "48 kHz", "AC-3"],
    keywords: ["ac3", "ac-3", "dolby", "dolby digital", "5.1", "surround", "broadcast", "dvd"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSY_AUDIO_OPTIONS, compression: ["640 kbps", "448 kbps", "384 kbps", "320 kbps", "256 kbps", "192 kbps", "128 kbps"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM AC-3 encoder"
  }),
  recipe({
    id: "audio-to-eac3",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "E-AC-3",
    title: "Audio to E-AC-3",
    description: "Encode a standalone Dolby Digital Plus E-AC-3 file with trim, channel, sample-rate, and bitrate control.",
    treatments: ["Dolby Digital Plus", "Up to 5.1", "48 kHz", "E-AC-3"],
    keywords: ["eac3", "e-ac-3", "ec3", "dolby", "dolby digital plus", "5.1", "surround", "streaming"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSY_AUDIO_OPTIONS, compression: ["1024 kbps", "768 kbps", "640 kbps", "448 kbps", "384 kbps", "256 kbps", "192 kbps"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM E-AC-3 encoder"
  }),
  recipe({
    id: "audio-to-vorbis",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "OGA Vorbis",
    title: "Audio to Ogg Vorbis",
    description: "Encode Vorbis audio in a standard .oga Ogg Audio file instead of an Opus stream.",
    treatments: ["Ogg Audio", "Vorbis", "64-320 kbps", "Open format"],
    keywords: ["oga", "ogg vorbis", "vorbis", "open audio", "legacy ogg", "music", "game audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM libvorbis encoder"
  }),
  recipe({
    id: "audio-to-wma",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "WMA",
    title: "Audio to WMA",
    description: "Encode Windows Media Audio 2 in an ASF/WMA file for legacy Windows and hardware compatibility.",
    treatments: ["WMA 2", "ASF", "Windows", "64-320 kbps"],
    keywords: ["wma", "windows media audio", "asf", "windows", "legacy audio", "wmav2"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM WMA encoder"
  }),
  recipe({
    id: "audio-to-wavpack",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "WavPack",
    title: "Audio to WavPack",
    description: "Encode lossless WavPack audio with selectable speed versus compression effort.",
    treatments: ["WavPack", "Lossless", "Fast/maximum", "Archive audio"],
    keywords: ["wv", "wavpack", "lossless", "archive", "compressed wav", "music"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, compression: ["Fast", "Balanced", "Maximum compression"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM WavPack encoder"
  }),
  recipe({
    id: "audio-to-tta",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "TTA",
    title: "Audio to TTA",
    description: "Encode True Audio lossless data in a standalone .tta file for archival and compatible players.",
    treatments: ["True Audio", "Lossless", "TTA", "Archive audio"],
    keywords: ["tta", "true audio", "lossless", "archive", "music"],
    editorControls: ["trim", "sampleRate", "audioChannels", "metadata", "batchNaming"],
    controlOptions: LOSSLESS_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM TTA encoder"
  }),
  recipe({
    id: "audio-to-mp2",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "MP2",
    title: "Audio to MP2",
    description: "Encode MPEG-1 Layer II audio for radio, broadcast, and legacy video production systems.",
    treatments: ["MPEG Layer II", "Broadcast", "64-320 kbps", "48 kHz"],
    keywords: ["mp2", "mpeg layer 2", "mpeg audio", "broadcast", "radio", "legacy audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM MP2 encoder"
  }),
  recipe({
    id: "audio-to-au",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "AU",
    title: "Audio to AU",
    description: "Create a Sun/NeXT AU file with 16-bit PCM, G.711 A-law, or G.711 mu-law audio.",
    treatments: ["Sun AU", "PCM", "G.711 A-law", "G.711 mu-law"],
    keywords: ["au", "snd", "sun audio", "next audio", "g711", "a-law", "mu-law", "telephony"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, outputFormat: ["16-bit PCM", "G.711 A-law", "G.711 mu-law"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM AU muxer"
  }),
  recipe({
    id: "audio-to-wave64",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "Wave64",
    title: "Audio to Wave64",
    description: "Create Sony Wave64 PCM audio for large-file and professional production workflows.",
    treatments: ["Sony Wave64", "PCM", "16/24-bit", "32-bit float"],
    keywords: ["w64", "wave64", "sony wave64", "large wav", "pcm", "production audio"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, bitDepth: ["16-bit PCM", "24-bit PCM", "32-bit float"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM Wave64 muxer"
  }),
  recipe({
    id: "audio-to-pcm",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "Raw PCM",
    title: "Audio to raw PCM",
    description: "Export headerless little-endian PCM samples with explicit sample rate, channels, and sample representation.",
    treatments: ["Headerless PCM", "16/24-bit", "32-bit float", "Little-endian"],
    keywords: ["pcm", "raw audio", "s16le", "s24le", "f32le", "headerless", "samples"],
    editorControls: ["outputFormat", "trim", "sampleRate", "audioChannels", "batchNaming"],
    controlOptions: options({ ...LOSSLESS_AUDIO_OPTIONS, outputFormat: ["16-bit little-endian", "24-bit little-endian", "32-bit float little-endian"] }),
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM raw PCM writer"
  }),
  recipe({
    id: "audio-to-3gp",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "3GP",
    title: "Audio to 3GP",
    description: "Create an audio-only 3GPP file with AAC audio for mobile and legacy messaging compatibility.",
    treatments: ["3GPP", "AAC", "Audio only", "Mobile"],
    keywords: ["3gp", "3gpp", "mobile audio", "aac", "feature phone", "messaging"],
    editorControls: ["trim", "sampleRate", "audioChannels", "compression", "metadata", "batchNaming"],
    controlOptions: LOSSY_AUDIO_OPTIONS,
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM 3GPP muxer"
  }),
  recipe({
    id: "audio-format-bundle",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio bundle",
    output: "Multi-format ZIP",
    title: "All audio formats",
    description: "Create all 25 verified audio file targets plus a format manifest in one ZIP.",
    treatments: ["25 real audio files", "One ZIP", "Modern + professional", "Format manifest"],
    keywords: ["all formats", "audio bundle", "zip", "wav mp3 flac m4a aac ogg opus webm aiff alac caf ac3 eac3 wma wavpack tta mp2 au wave64 pcm 3gp", "batch convert"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "compression", "metadata", "bundle"],
    controlOptions: options({ ...LOSSY_AUDIO_OPTIONS, bitDepth: ["16-bit lossless", "24-bit lossless"], bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] }),
    requiredCapabilities: ["audio", "opusEncoder", "wasm", "worker", "zip"],
    intensity: "heavy",
    engine: "Mediabunny + FFmpeg WASM multi-encoder + zip.js"
  }),
  recipe({
    id: "audio-to-wav",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio format",
    output: "WAV",
    title: "Audio to WAV",
    description: "Export a parsed audio track as PCM WAV with real sample-rate, channel, bit-depth, trim, tag, and naming controls.",
    treatments: ["16/24-bit PCM", "32-bit float", "Resample", "Mono/stereo", "Trim"],
    keywords: ["wav", "wave", "pcm", "lossless", "audio", "sample rate", "bit depth", "mono", "stereo", "trim"],
    editorControls: ["trim", "sampleRate", "audioChannels", "bitDepth", "metadata", "batchNaming"],
    controlOptions: {
      trim: MEDIA_TRIM_OPTIONS,
      sampleRate: ["Source sample rate", "44.1 kHz", "48 kHz", "96 kHz"],
      audioChannels: ["Source channels", "Mono", "Stereo"],
      bitDepth: ["16-bit PCM", "24-bit PCM", "32-bit float"],
      metadata: ["Keep tags", "Strip tags"],
      batchNaming: ["Converted suffix", "Clean filename"]
    },
    requiredCapabilities: ["audio", "worker"],
    intensity: "standard",
    engine: "Mediabunny container parser + PCM writer"
  }),
  recipe({
    id: "audio-to-video",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Video",
    output: "MP4 / WebM",
    title: "Audio to video",
    description: "Encode audio and a generated waveform or progress visual directly into MP4 or WebM without real-time playback.",
    treatments: ["Waveform video", "MP4 AVC/AAC", "WebM VP9/Opus", "Title metadata"],
    keywords: ["audio", "video", "music", "podcast", "audiogram", "waveform", "mp4", "webm", "sound"],
    editorControls: ["outputFormat", "trim", "aspectRatio", "resolution", "frameRate", "waveform", "typography", "color", "compression", "metadata", "batchNaming"],
    controlOptions: {
      outputFormat: ["WebM", "MP4"],
      trim: MEDIA_TRIM_OPTIONS,
      aspectRatio: ["16:9 widescreen", "9:16 vertical", "1:1 square", "4:5 portrait"],
      resolution: ["1080p", "720p", "1440p", "4K", "360p preview"],
      frameRate: ["24 fps", "30 fps", "60 fps", "12 fps"],
      waveform: ["Animated waveform", "Static waveform", "Progress bar", "Cover card"],
      typography: ["Editorial serif", "Modern sans", "Compact label", "Minimal mono", "No title"],
      color: ["Gold on charcoal", "Emerald on cream", "Monochrome"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Embed title tag", "Strip title tag"],
      batchNaming: ["Converted suffix", "Clean filename"]
    },
    requiredCapabilities: ["audio", "canvas", "webcodecs", "worker"],
    intensity: "heavy",
    engine: "Mediabunny CanvasSource + AudioBufferSource + WebCodecs"
  }),
  recipe({
    id: "audio-waveform",
    input: ["audio"],
    inputFormats: AUDIO_INPUT_FORMATS,
    category: "Audio visual",
    output: "SVG / PNG / JSON / ZIP",
    title: "Audio to waveform assets",
    description: "Decode the selected audio range into truthful peak data and export a vector, raster, JSON, or complete waveform bundle.",
    treatments: ["SVG", "PNG", "Peak data", "Asset ZIP"],
    keywords: ["waveform", "audio", "svg", "png", "peaks", "json", "visual", "audiogram", "thumbnail"],
    editorControls: ["outputFormat", "trim", "resolution", "color", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["SVG waveform", "PNG waveform", "Peaks JSON", "Waveform ZIP"],
      trim: MEDIA_TRIM_OPTIONS,
      resolution: ["1200 x 400", "1920 x 640", "2400 x 800"],
      color: ["Gold on charcoal", "Emerald on cream", "Monochrome"],
      batchNaming: ["Waveform suffix", "Clean filename"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["audio", "canvas", "worker"],
    intensity: "standard",
    engine: "Mediabunny AudioBufferSink + Canvas/SVG"
  }),

  recipe({
    id: "spreadsheet-to-csv",
    input: ["spreadsheet"],
    inputFormats: ["xlsx"],
    category: "Table format",
    output: "CSV",
    title: "Spreadsheet to CSV",
    description: "Export one sheet or every workbook sheet as truthful CSV or TSV files.",
    treatments: ["CSV", "TSV", "Every sheet"],
    keywords: ["xlsx", "excel", "workbook", "sheet", "csv", "tsv", "table", "formula safe"],
    editorControls: ["outputFormat", "sheetSelection", "formulaSafety", "bundle"],
    controlOptions: { outputFormat: ["CSV", "TSV"], sheetSelection: ["All sheets", "First sheet"], formulaSafety: ["Protect spreadsheet formulas", "Preserve exact text"], bundle: ["Balanced ZIP with manifest", "Maximum ZIP with manifest", "Store ZIP", "ZIP without manifest"] },
    requiredCapabilities: ["spreadsheet", "worker", "zip"],
    intensity: "standard",
    engine: "read-excel-file + CSV writer"
  }),
  recipe({
    id: "spreadsheet-to-json",
    input: ["spreadsheet"],
    inputFormats: ["xlsx"],
    category: "Table format",
    output: "JSON",
    title: "Spreadsheet to JSON",
    description: "Convert one sheet or an entire workbook into typed JSON records, rows, or JSON Lines.",
    treatments: ["JSON objects", "JSON rows", "JSON Lines", "Every sheet"],
    keywords: ["xlsx", "excel", "workbook", "json", "jsonl", "records", "rows", "types"],
    editorControls: ["outputFormat", "sheetSelection", "headerMode", "dataTypes", "bundle"],
    controlOptions: { outputFormat: ["Combined workbook JSON", "JSON objects by sheet", "JSON rows by sheet", "JSON Lines by sheet"], sheetSelection: ["All sheets", "First sheet"], headerMode: ["First row is headers", "No header row"], dataTypes: ["Preserve detected types", "Convert all values to text"], bundle: ["Balanced ZIP with manifest", "Maximum ZIP with manifest", "Store ZIP", "ZIP without manifest"] },
    requiredCapabilities: ["spreadsheet", "worker", "zip"],
    intensity: "standard",
    engine: "read-excel-file + JSON writer"
  }),
  recipe({
    id: "spreadsheet-chart-pack",
    input: ["spreadsheet", "data"],
    category: "Report",
    output: "Chart ZIP",
    title: "Spreadsheet to chart images",
    description: "Generate bar, line, pie, and summary chart images from selected columns.",
    treatments: ["Charts", "PNG/SVG", "ZIP"],
    editorControls: ["outputFormat", "pageSize", "color", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PNG charts", "SVG charts", "PNG + SVG ZIP"], pageSize: ["16:9 slide", "Letter report", "Square card"] },
    requiredCapabilities: ["spreadsheet", "canvas", "worker", "zip"],
    intensity: "standard",
    engine: "read-excel-file + Canvas/SVG charts"
  }),
  recipe({
    id: "data-json-csv",
    input: ["data"],
    inputFormats: ["json", "jsonl", "ndjson", "csv", "tsv"],
    category: "Data format",
    output: "JSON / CSV / TSV / Markdown",
    title: "Structured data conversion",
    description: "Convert JSON, JSON Lines, CSV, and TSV into clean table formats without inventing unsupported syntax.",
    treatments: ["JSON", "JSON Lines", "CSV", "TSV", "Markdown"],
    keywords: ["json", "jsonl", "ndjson", "csv", "tsv", "table", "records", "markdown", "convert data"],
    editorControls: ["outputFormat", "headerMode", "dataTypes", "formulaSafety", "batchNaming"],
    controlOptions: { outputFormat: ["JSON objects", "JSON rows", "JSON Lines", "CSV", "TSV", "Markdown table"], headerMode: ["First row is headers", "No header row"], dataTypes: ["Keep source types", "Infer CSV value types", "Convert all values to text"], formulaSafety: ["Protect spreadsheet formulas", "Preserve exact text"], batchNaming: ["Clean filename", "Format suffix"] },
    requiredCapabilities: ["worker"],
    intensity: "light",
    engine: "Strict native JSON / CSV / TSV parsers"
  }),
  recipe({
    id: "document-to-markdown",
    input: ["document"],
    inputFormats: ["docx"],
    category: "Document format",
    output: "Markdown",
    title: "DOCX to Markdown",
    description: "Convert Word headings, emphasis, links, lists, and tables into semantic Markdown.",
    treatments: ["Markdown", "Headings", "Links", "Lists", "Tables"],
    keywords: ["docx", "word", "markdown", "md", "headings", "table", "list", "link"],
    editorControls: ["metadata", "batchNaming"],
    controlOptions: { metadata: ["Content only", "Include source filename"], batchNaming: ["Converted suffix", "Clean filename"] },
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "Mammoth + ZIP/XML readers"
  }),
  recipe({
    id: "document-to-html",
    input: ["document"],
    inputFormats: ["docx"],
    category: "Document format",
    output: "HTML",
    title: "DOCX to HTML",
    description: "Export semantic Word content as sanitized standalone HTML with embedded or omitted images.",
    treatments: ["HTML", "Sanitized", "Embedded images", "Tables"],
    keywords: ["docx", "word", "html", "web", "embed images", "table", "link"],
    editorControls: ["metadata", "batchNaming"],
    controlOptions: { metadata: ["Embed images", "Omit images"], batchNaming: ["Converted suffix", "Clean filename"] },
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "Mammoth + ZIP/XML readers"
  }),
  recipe({
    id: "document-assets",
    input: ["document"],
    inputFormats: ["docx"],
    category: "Asset extraction",
    output: "Asset ZIP",
    title: "Extract document assets",
    description: "Extract embedded Word media files into a clean ZIP without exposing internal XML parts.",
    treatments: ["Images", "Media", "Manifest", "ZIP"],
    keywords: ["docx", "word", "extract", "images", "media", "assets", "zip"],
    editorControls: ["metadata", "batchNaming", "bundle"],
    controlOptions: { metadata: ["Include manifest", "Assets only"], batchNaming: ["Assets suffix", "Clean filename"], bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "ZIP/XML readers"
  }),
  recipe({
    id: "presentation-slide-images",
    input: ["presentation"],
    category: "Presentation",
    output: "Slide image ZIP",
    title: "Presentation slide rendering",
    description: "Requires a full Office-compatible visual renderer and is not available in the browser yet.",
    treatments: ["Slide images", "PNG/JPEG", "ZIP"],
    editorControls: ["outputFormat", "pageOrder", "aspectRatio", "resolution", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PNG", "JPEG", "WebP"], aspectRatio: ["16:9 widescreen", "4:3 classic"], resolution: ["1080 px", "1920 px", "2K", "4K"] },
    requiredCapabilities: ["canvas", "worker", "zip"],
    intensity: "standard",
    engine: "Desktop Office renderer required",
    implementation: "planned"
  }),
  recipe({
    id: "presentation-assets",
    input: ["presentation"],
    inputFormats: ["pptx"],
    category: "Asset extraction",
    output: "Media ZIP",
    title: "Extract presentation media",
    description: "Extract embedded PowerPoint images, audio, and video with an optional source manifest.",
    treatments: ["Images", "Audio", "Video", "Manifest", "ZIP"],
    keywords: ["pptx", "powerpoint", "extract", "images", "audio", "video", "media", "assets", "zip"],
    editorControls: ["metadata", "batchNaming", "bundle"],
    controlOptions: { metadata: ["Include manifest", "Assets only"], batchNaming: ["Assets suffix", "Clean filename"], bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "Bounded zip.js Office package reader"
  }),
  recipe({
    id: "presentation-notes",
    input: ["presentation"],
    inputFormats: ["pptx"],
    category: "Text extraction",
    output: "TXT / Markdown",
    title: "Presentation to notes text",
    description: "Extract slides in declared presentation order with visible text and actual speaker notes.",
    treatments: ["Speaker notes", "Text", "Markdown"],
    keywords: ["pptx", "powerpoint", "notes", "speaker notes", "text", "outline", "markdown", "json"],
    editorControls: ["outputFormat", "slideSelection", "metadata", "batchNaming"],
    controlOptions: { outputFormat: ["Markdown", "TXT", "JSON outline"], slideSelection: ["All slides", "First slide", "Last slide", "Odd slides", "Even slides", "Reverse order"], metadata: ["Visible text + speaker notes", "Visible text only", "Speaker notes only"], batchNaming: ["Notes suffix", "Clean filename"] },
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "PPTX ZIP/XML reader"
  }),
  recipe({
    id: "archive-inspect",
    input: ["archive"],
    inputFormats: ["zip"],
    category: "Archive",
    output: "JSON report",
    title: "Inspect ZIP contents",
    description: "Report every file, size, compression method, expansion ratio, and optional SHA-256 checksum.",
    treatments: ["File list", "Sizes", "Compression methods", "SHA-256"],
    keywords: ["zip", "inspect", "list", "contents", "size", "ratio", "checksum", "sha256", "report"],
    editorControls: ["metadata", "batchNaming"],
    controlOptions: { metadata: ["File list", "File list + SHA-256"], batchNaming: ["Report suffix", "Clean filename"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "light",
    engine: "Bounded zip.js reader + Web Crypto"
  }),
  recipe({
    id: "archive-extract",
    input: ["archive"],
    inputFormats: ["zip"],
    category: "Archive",
    output: "Extracted ZIP",
    title: "Create extracted file bundle",
    description: "Select ZIP entries by exact file or useful type group and place them in a clean export bundle.",
    treatments: ["Exact file", "Type filters", "Manifest", "ZIP"],
    keywords: ["zip", "extract", "unpack", "files", "images", "documents", "media", "selected"],
    editorControls: ["archiveSelection", "metadata", "compression", "batchNaming"],
    controlOptions: { archiveSelection: ["All files", "Top-level files", "Documents", "Images", "Audio and video"], metadata: ["Include manifest", "Files only"], compression: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"], batchNaming: ["Extracted suffix", "Clean filename"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "Bounded zip.js reader/writer"
  }),
  recipe({
    id: "archive-repack-zip",
    input: ["archive"],
    inputFormats: ["zip"],
    category: "Archive",
    output: "ZIP",
    title: "Repack archive as ZIP",
    description: "Recompress a ZIP, optionally remove operating-system junk, and add a collision-safe manifest.",
    treatments: ["Repack", "OS junk cleanup", "Compression", "Manifest"],
    keywords: ["zip", "repack", "recompress", "clean", "macos", "ds store", "thumbs", "manifest"],
    editorControls: ["metadata", "compression", "batchNaming"],
    controlOptions: { metadata: ["Remove OS junk + manifest", "Keep all + manifest", "Remove OS junk, files only"], compression: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"], batchNaming: ["Repacked suffix", "Clean filename"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "Bounded zip.js reader/writer"
  }),
  recipe({
    id: "font-web-pack",
    input: ["font"],
    category: "Font",
    output: "Web font ZIP",
    title: "Font to web font kit",
    description: "Package font files, CSS, specimen page, and usage notes.",
    treatments: ["WOFF", "WOFF2", "CSS", "Specimen"],
    editorControls: ["outputFormat", "pageSize", "color", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["WOFF2 + CSS", "WOFF + CSS", "Specimen only", "Full web kit"] },
    requiredCapabilities: ["canvas", "worker", "zip"],
    intensity: "standard",
    engine: "FontFace API + font parser"
  }),
  recipe({
    id: "font-specimen",
    input: ["font"],
    category: "Font",
    output: "PDF / PNG",
    title: "Font specimen sheet",
    description: "Create a glyph sheet and type specimen card.",
    treatments: ["Glyph sheet", "PDF", "PNG"],
    editorControls: ["outputFormat", "pageSize", "color", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PDF", "PNG", "SVG", "ZIP all"] },
    requiredCapabilities: ["canvas", "pdf", "worker"],
    intensity: "standard",
    engine: "FontFace API + Canvas + pdf-lib"
  }),
  recipe({
    id: "model3d-preview",
    input: ["model3d"],
    category: "3D preview",
    output: "Preview ZIP",
    title: "3D model preview images",
    description: "Render thumbnails, turntable stills, and a material summary.",
    treatments: ["Thumbnail", "Turntable", "Material summary"],
    editorControls: ["outputFormat", "resolution", "color", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PNG stills", "WebP stills", "GLB preview bundle"], resolution: ["1024 px", "1920 px", "2K", "4K"] },
    requiredCapabilities: ["webgl", "worker"],
    intensity: "heavy",
    engine: "Three.js loaders"
  }),
  recipe({
    id: "ebook-to-text",
    input: ["ebook"],
    inputFormats: ["epub"],
    category: "Readable export",
    output: "TXT / Markdown / HTML / chapter ZIP",
    title: "EPUB to readable chapters",
    description: "Follow the EPUB reading-order spine and export sanitized chapters as text, Markdown, HTML, or individual chapter files.",
    treatments: ["Reading-order spine", "Sanitized HTML", "Chapter files", "Manifest"],
    keywords: ["epub", "ebook", "book", "chapter", "read", "text", "txt", "markdown", "md", "html", "extract", "split", "zip"],
    editorControls: ["outputFormat", "metadata", "batchNaming", "bundle"],
    controlOptions: {
      outputFormat: ["Markdown", "TXT", "Sanitized HTML", "Text ZIP by chapter", "HTML ZIP by chapter"],
      metadata: ["Include chapter labels", "Content only"],
      batchNaming: ["Converted suffix", "Clean filename"],
      bundle: ["Store ZIP", "Balanced ZIP", "Maximum ZIP"]
    },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "zip.js + EPUB container/OPF spine reader"
  }),
  recipe({
    id: "application-compress-zip",
    input: ["application"],
    category: "Compression",
    output: "Compressed ZIP",
    title: "Compress application or binary",
    description: "Preserve an executable, installer, application package, or binary inside a level-selectable ZIP with SHA-256 and an exact ratio report.",
    treatments: ["Maximum ZIP compression", "SHA-256 checksum", "Manifest", "Original preserved"],
    keywords: ["exe", "msi", "installer", "app", "apk", "dmg", "binary", "compress", "zip", "checksum", "package"],
    editorControls: ["compression", "batchNaming"],
    controlOptions: {
      compression: ["Maximum ZIP", "Balanced ZIP", "Store ZIP"],
      batchNaming: ["Compressed suffix", "Clean filename"]
    },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "zip.js + Web Crypto"
  })
];

export function recipesForFamily(family: FileFamily) {
  return CONVERSION_RECIPES.filter((recipe) => recipe.input.includes(family) || recipe.input.includes("unknown"));
}

export function recipeCategories(recipes: ConversionRecipe[]) {
  return Array.from(new Set(recipes.map((recipe) => recipe.category))).sort((a, b) => a.localeCompare(b));
}

export function recipeOutputs(recipes: ConversionRecipe[]) {
  return Array.from(new Set(recipes.map((recipe) => recipe.output))).sort((a, b) => a.localeCompare(b));
}

const SEARCH_ALIASES: Record<string, string[]> = {
  image: ["image", "photo", "picture", "pic", "graphic", "artwork", "screenshot", "card", "visual", "png", "jpg", "jpeg", "webp"],
  photo: ["photo", "image", "picture", "jpg", "jpeg", "webp", "avif"],
  picture: ["picture", "image", "photo", "png", "jpg", "jpeg"],
  jpg: ["jpg", "jpeg", "photo", "image"],
  jpeg: ["jpeg", "jpg", "photo", "image"],
  png: ["png", "transparent", "alpha", "lossless", "icon", "image"],
  transparent: ["transparent", "alpha", "png", "webp"],
  alpha: ["alpha", "transparent", "png", "webp"],
  web: ["web", "site", "browser", "html", "webp", "avif", "thumbnail", "favicon", "embed", "open graph"],
  website: ["web", "site", "browser", "html", "webp", "favicon", "embed"],
  social: ["social", "thumbnail", "preview", "web", "sizes", "carousel", "linkedin", "story"],
  document: ["document", "pdf", "paper", "print", "page", "doc", "docx", "markdown"],
  pdf: ["pdf", "document", "page", "print", "text", "split", "images", "slides"],
  deck: ["presentation", "deck", "slides", "ppt", "pptx", "keynote"],
  presentation: ["presentation", "deck", "slides", "ppt", "pptx", "keynote", "speaker notes"],
  paper: ["paper", "print", "pdf", "document", "page"],
  print: ["print", "pdf", "paper", "letter", "page", "handout"],
  text: ["text", "txt", "markdown", "html", "ocr", "extract"],
  markdown: ["markdown", "md", "text", "document", "html"],
  html: ["html", "web", "embed", "document", "markdown"],
  icon: ["icon", "favicon", "app icon", "logo", "png", "manifest"],
  favicon: ["favicon", "icon", "app icon", "logo", "manifest", "png"],
  embed: ["embed", "inline", "html", "svg", "data uri", "base64", "web"],
  base64: ["base64", "data uri", "inline", "embed", "text"],
  bundle: ["bundle", "zip", "all", "multiple", "pack", "set"],
  zip: ["zip", "bundle", "all", "multiple", "pack", "set", "archive"],
  archive: ["archive", "zip", "extract", "repack", "manifest"],
  thumbnail: ["thumbnail", "thumb", "preview", "social", "web", "sizes"],
  audio: ["audio", "mp3", "wav", "m4a", "aac", "waveform", "sound", "music", "podcast", "audiogram"],
  audtio: ["audio", "mp3", "wav", "sound", "music", "podcast"],
  auido: ["audio", "mp3", "wav", "sound", "music", "podcast"],
  aduio: ["audio", "mp3", "wav", "sound", "music", "podcast"],
  video: ["video", "mp4", "webm", "gif", "frames", "clips", "motion", "audiogram"],
  videdo: ["video", "mp4", "webm", "motion", "audiogram"],
  vidoe: ["video", "mp4", "webm", "motion", "audiogram"],
  vedio: ["video", "mp4", "webm", "motion", "audiogram"],
  spreadsheet: ["spreadsheet", "excel", "xlsx", "csv", "chart", "table", "data"],
  data: ["data", "json", "csv", "xml", "yaml", "table", "schema"],
  font: ["font", "ttf", "otf", "woff", "woff2", "glyph", "specimen"],
  model: ["3d", "model", "glb", "gltf", "obj", "stl", "preview"],
  exe: ["exe", "application", "binary", "installer", "compress", "zip", "package"],
  msi: ["msi", "application", "installer", "compress", "zip", "package"],
  installer: ["installer", "exe", "msi", "application", "binary", "compress", "zip"],
  application: ["application", "app", "exe", "installer", "binary", "compress", "zip", "package"],
  binary: ["binary", "application", "exe", "compress", "zip", "checksum"]
};

export function filterRecipesByQuery(recipes: ConversionRecipe[], query: string) {
  const terms = expandSearchQuery(query);
  if (!terms.length) return recipes;

  return recipes.filter((recipe) => {
    const index = buildRecipeSearchIndex(recipe);
    const indexTokens = index.split(" ");
    return terms.every((group) => group.some((term) => index.includes(term) || fuzzyIncludes(indexTokens, term)));
  });
}

function expandSearchQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[\s,;/|]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => [token, ...(SEARCH_ALIASES[token] ?? [])].map(normalizeSearchText));
}

function buildRecipeSearchIndex(recipe: ConversionRecipe) {
  return normalizeSearchText(
    [
      recipe.id,
      recipe.category,
      recipe.output,
      recipe.title,
      recipe.description,
      recipe.engine,
      recipe.implementation,
      ...recipe.input.map((family) => FAMILY_LABELS[family] ?? family),
      ...recipe.treatments,
      ...recipe.editorControls,
      ...Object.values(recipe.controlOptions ?? {}).flat(),
      ...(recipe.keywords ?? [])
    ].join(" ")
  );
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyIncludes(indexTokens: string[], term: string) {
  if (term.length < 4) return false;
  return indexTokens.some((token) => token.length >= 4 && Math.abs(token.length - term.length) <= 2 && editDistanceWithin(term, token, term.length > 6 ? 2 : 1));
}

function editDistanceWithin(a: string, b: string, limit: number) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
}
