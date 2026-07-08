import type { ConversionRecipe, FileFamily } from "../lib/types";

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
  unknown: "Unknown"
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

export const CONVERSION_RECIPES: ConversionRecipe[] = [
  {
    id: "image-to-pdf",
    input: ["image"],
    output: "PDF",
    title: "PDF document",
    description: "Convert the image into a clean single-page PDF.",
    treatments: ["PDF", "Single page", "Original size"],
    keywords: ["document", "paper", "print", "portable document", "share", "page"],
    editorControls: ["pageSize", "margins", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "pdf", "image"],
    intensity: "light",
    engine: "pdf-lib + Canvas",
    localOnly: true
  },
  {
    id: "image-print-pdf",
    input: ["image"],
    output: "Print PDF",
    title: "Print PDF",
    description: "Place the image on a letter-size PDF with safe margins.",
    treatments: ["Letter page", "Centered", "Margins"],
    keywords: ["print", "paper", "letter", "page", "pdf", "document", "handout"],
    editorControls: ["pageSize", "margins", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "pdf", "image"],
    intensity: "light",
    engine: "pdf-lib + Canvas",
    localOnly: true
  },
  {
    id: "image-to-png",
    input: ["image"],
    output: "PNG",
    title: "PNG image",
    description: "Convert to PNG for transparency and lossless exports.",
    treatments: ["PNG", "Lossless", "Transparency"],
    keywords: ["transparent", "alpha", "lossless", "picture", "photo", "graphic", "screenshot"],
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    localOnly: true
  },
  {
    id: "image-to-jpeg",
    input: ["image"],
    output: "JPEG",
    title: "JPEG image",
    description: "Convert to JPEG for photos, previews, and smaller files.",
    treatments: ["JPG", "Quality", "White matte"],
    keywords: ["jpg", "jpeg", "photo", "picture", "small", "compressed", "web"],
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    localOnly: true
  },
  {
    id: "image-to-webp",
    input: ["image"],
    output: "WebP",
    title: "WebP image",
    description: "Convert to WebP for modern web use and compact previews.",
    treatments: ["WebP", "Modern web", "Quality"],
    keywords: ["web", "site", "browser", "small", "compressed", "preview", "photo"],
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "image", "webpEncoder"],
    intensity: "light",
    engine: "Canvas / createImageBitmap",
    localOnly: true
  },
  {
    id: "image-to-avif",
    input: ["image"],
    output: "AVIF",
    title: "AVIF image",
    description: "Convert to AVIF when the browser encoder is available.",
    treatments: ["AVIF", "Modern web", "High compression"],
    keywords: ["avif", "web", "small", "compressed", "photo", "picture", "modern"],
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "image", "avifEncoder"],
    intensity: "light",
    engine: "Canvas / browser encoder",
    localOnly: true
  },
  {
    id: "image-to-bmp",
    input: ["image"],
    output: "BMP",
    title: "BMP image",
    description: "Convert to a standard bitmap file for older apps.",
    treatments: ["BMP", "Bitmap", "No alpha"],
    keywords: ["bmp", "bitmap", "windows", "legacy", "raw", "image", "picture"],
    editorControls: ["resolution", "metadata", "batchNaming"],
    requiredCapabilities: ["canvas", "image"],
    intensity: "light",
    engine: "Canvas + BMP encoder",
    localOnly: true
  },
  {
    id: "image-svg-wrapper",
    input: ["image"],
    output: "SVG",
    title: "SVG wrapper",
    description: "Embed the raster image inside an SVG file.",
    treatments: ["SVG", "Embedded image", "Scalable frame"],
    keywords: ["svg", "vector", "wrapper", "embed", "xml", "graphic", "image"],
    editorControls: ["resolution", "metadata", "batchNaming"],
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "SVG data wrapper",
    localOnly: true
  },
  {
    id: "image-data-uri",
    input: ["image"],
    output: "TXT",
    title: "Data URI",
    description: "Export the image as a Base64 data URI text file.",
    treatments: ["Base64", "Data URI", "Text"],
    keywords: ["base64", "data uri", "embed", "inline", "css", "html", "text"],
    editorControls: ["metadata", "batchNaming"],
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "FileReader / Base64",
    localOnly: true
  },
  {
    id: "image-html-embed",
    input: ["image"],
    output: "HTML",
    title: "HTML embed",
    description: "Create a standalone HTML file with the image embedded.",
    treatments: ["HTML", "Embedded", "Portable"],
    keywords: ["html", "webpage", "embed", "inline", "browser", "site", "share"],
    editorControls: ["metadata", "batchNaming"],
    requiredCapabilities: ["image"],
    intensity: "light",
    engine: "HTML data embed",
    localOnly: true
  },
  {
    id: "image-thumbnail-set",
    input: ["image"],
    output: "ZIP",
    title: "Thumbnail set",
    description: "Generate web-ready thumbnails in multiple sizes.",
    treatments: ["320", "640", "1080", "WebP"],
    keywords: ["thumbnail", "thumb", "preview", "sizes", "web", "social", "zip", "bundle"],
    editorControls: ["resolution", "compression", "batchNaming", "bundle"],
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + fflate",
    localOnly: true
  },
  {
    id: "image-favicon-set",
    input: ["image"],
    output: "ZIP",
    title: "Favicon set",
    description: "Create browser and app icon PNG sizes plus a manifest.",
    treatments: ["16", "32", "180", "512"],
    keywords: ["icon", "favicon", "app icon", "logo", "manifest", "png", "site", "zip"],
    editorControls: ["crop", "resolution", "batchNaming", "bundle"],
    requiredCapabilities: ["canvas", "image", "zip"],
    intensity: "light",
    engine: "Canvas + fflate",
    localOnly: true
  },
  {
    id: "image-format-bundle",
    input: ["image"],
    output: "ZIP",
    title: "Format bundle",
    description: "Download PNG, JPEG, and WebP versions together.",
    treatments: ["PNG", "JPEG", "WebP", "ZIP"],
    keywords: ["bundle", "zip", "all", "multiple", "formats", "png", "jpg", "webp"],
    editorControls: ["resolution", "compression", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + fflate",
    localOnly: true
  },
  {
    id: "video-to-frames",
    input: ["video"],
    output: "PNG / JPEG frames",
    title: "Video to frames",
    description: "Extract still frames by every frame, every N seconds, chapters, scene picks, or manual timeline marks.",
    treatments: ["Every frame", "Every second", "Every 2 / 5 / 10 seconds", "Custom interval", "Chapter frames", "Poster frames", "ZIP bundle"],
    editorControls: ["timeline", "trim", "frameInterval", "chapterInterval", "resolution", "batchNaming", "bundle"],
    requiredCapabilities: ["video", "canvas", "worker"],
    intensity: "standard",
    engine: "HTMLVideoElement + Canvas; FFmpeg WASM for advanced modes",
    localOnly: true
  },
  {
    id: "video-transcode",
    input: ["video"],
    output: "MP4 / WebM / GIF / audio",
    title: "Video conversion and cutdown",
    description: "Trim, crop, change aspect ratio, compress, extract audio, or create GIF/social cutdowns with clear limits before it starts.",
    treatments: ["Trim range", "Aspect ratio", "Resolution", "Frame rate", "Extract audio", "GIF loop", "Thumbnail set", "Caption burn-in later"],
    editorControls: ["timeline", "trim", "crop", "aspectRatio", "resolution", "frameRate", "audioGain", "captions", "compression", "bundle"],
    requiredCapabilities: ["video", "wasm", "worker", "webcodecs"],
    intensity: "extreme",
    engine: "Mediabunny / WebCodecs / FFmpeg WASM",
    localOnly: true
  },
  {
    id: "audio-studio",
    input: ["audio", "video"],
    output: "MP3 / WAV / captions / waveform",
    title: "Audio extraction and cleanup",
    description: "Extract, trim, normalize, fade, visualize, caption-ready package, and export audio variants.",
    treatments: ["Extract from video", "Trim", "Normalize", "Fade in/out", "Waveform image", "Audiogram-ready bundle", "Caption track later"],
    editorControls: ["timeline", "trim", "waveform", "audioGain", "audioFade", "captions", "compression", "metadata", "bundle"],
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "Web Audio + wavesurfer.js + FFmpeg WASM",
    localOnly: true
  },
  {
    id: "pdf-deck-carousel",
    input: ["pdf"],
    output: "Images / deck outline / handout",
    title: "PDF to presentation assets",
    description: "Render pages, reorder, split, make slide images, produce handouts, and prepare carousel exports.",
    treatments: ["Page images", "Page split", "Reorder", "Extract text", "Carousel crops", "Handout PDF", "Asset bundle"],
    editorControls: ["pageOrder", "pageSize", "crop", "aspectRatio", "resolution", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["pdf", "canvas", "worker"],
    intensity: "standard",
    engine: "PDF.js + pdf-lib",
    localOnly: true
  },
  {
    id: "pdf-maintenance",
    input: ["pdf"],
    output: "Optimized PDF / extracted files",
    title: "PDF maintenance",
    description: "Split, merge, rotate, extract pages, compress images, add metadata, and prepare archival bundles.",
    treatments: ["Split", "Merge later", "Rotate", "Extract pages", "Compress", "Add metadata", "Bundle"],
    editorControls: ["pageOrder", "pageSize", "margins", "compression", "metadata", "watermark", "bundle"],
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "pdf-lib + PDF.js",
    localOnly: true
  },
  {
    id: "spreadsheet-report",
    input: ["spreadsheet", "data"],
    output: "Charts / CSV / memo / report pack",
    title: "Spreadsheet to report pack",
    description: "Parse tables, clean columns, export CSV/JSON, generate chart images, and build an executive report bundle.",
    treatments: ["CSV export", "JSON export", "Column cleanup", "Chart pack", "Summary tables", "PDF report later"],
    editorControls: ["metadata", "pageSize", "color", "batchNaming", "bundle"],
    requiredCapabilities: ["spreadsheet", "canvas", "worker"],
    intensity: "standard",
    engine: "read-excel-file + CSV/JSON parsers + Canvas/SVG charts",
    localOnly: true
  },
  {
    id: "document-extract",
    input: ["document", "ebook", "presentation"],
    output: "Markdown / HTML / PDF / assets",
    title: "Document extraction and repack",
    description: "Extract text, images, headings, tables, and export to Markdown, HTML, PDF-ready pages, or asset bundles.",
    treatments: ["Text extraction", "Image extraction", "Markdown", "HTML", "Cleaned handout", "Asset ZIP"],
    editorControls: ["pageOrder", "pageSize", "margins", "metadata", "bundle"],
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "Mammoth + ZIP/XML readers + format-specific parsers",
    localOnly: true
  },
  {
    id: "archive-unpack",
    input: ["archive"],
    output: "Extracted files / repacked archive",
    title: "Archive inspect and repack",
    description: "Inspect archive contents, extract selected files, rename, recompress, and create normalized bundles.",
    treatments: ["List contents", "Extract selected", "Repack", "Rename", "Checksum manifest", "Nested archive warning"],
    editorControls: ["metadata", "batchNaming", "bundle", "compression"],
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "zip.js / fflate",
    localOnly: true
  },
  {
    id: "data-transform",
    input: ["data", "code"],
    output: "JSON / CSV / XML / YAML / Markdown",
    title: "Structured data transform",
    description: "Convert structured text, validate shape, flatten tables, prettify/minify, and create developer-ready bundles.",
    treatments: ["Prettify", "Minify", "Flatten", "CSV conversion", "Schema summary", "Diff package"],
    editorControls: ["metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["worker"],
    intensity: "light",
    engine: "Native parsers + focused libraries per format",
    localOnly: true
  },
  {
    id: "font-preview-pack",
    input: ["font"],
    output: "Preview sheet / web font pack",
    title: "Font preview and web pack",
    description: "Preview glyphs, create specimen images, package CSS, and prepare web font delivery assets.",
    treatments: ["Glyph sheet", "Specimen card", "CSS snippet", "Name table inspection", "Bundle"],
    editorControls: ["pageSize", "color", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["canvas", "worker"],
    intensity: "standard",
    engine: "FontFace API + Canvas",
    localOnly: true
  },
  {
    id: "model3d-preview",
    input: ["model3d"],
    output: "Preview images / optimized bundle",
    title: "3D model preview pack",
    description: "Render turntable stills, inspect model metadata, and package web-ready previews when browser support is available.",
    treatments: ["Turntable stills", "Thumbnail", "Material summary", "Bundle", "Size warning"],
    editorControls: ["resolution", "color", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["webgl", "worker"],
    intensity: "heavy",
    engine: "Three.js loaders",
    localOnly: true
  }
];

export function recipesForFamily(family: FileFamily) {
  return CONVERSION_RECIPES.filter((recipe) => recipe.input.includes(family) || recipe.input.includes("unknown"));
}

const SEARCH_ALIASES: Record<string, string[]> = {
  image: ["image", "photo", "picture", "pic", "graphic", "artwork", "screenshot", "card", "visual"],
  photo: ["photo", "image", "picture", "jpg", "jpeg", "webp", "avif"],
  picture: ["picture", "image", "photo", "png", "jpg", "jpeg"],
  jpg: ["jpg", "jpeg"],
  jpeg: ["jpeg", "jpg"],
  png: ["png", "transparent", "alpha", "lossless", "icon"],
  transparent: ["transparent", "alpha", "png", "webp"],
  alpha: ["alpha", "transparent", "png", "webp"],
  web: ["web", "site", "browser", "html", "webp", "avif", "thumbnail", "favicon", "embed"],
  website: ["web", "site", "browser", "html", "webp", "favicon", "embed"],
  small: ["small", "compressed", "webp", "avif", "jpeg", "thumbnail"],
  compress: ["compress", "compressed", "small", "jpeg", "jpg", "webp", "avif"],
  document: ["document", "pdf", "paper", "print", "page"],
  paper: ["paper", "print", "pdf", "document", "page"],
  print: ["print", "pdf", "paper", "letter", "page"],
  icon: ["icon", "favicon", "app icon", "logo", "png", "manifest"],
  favicon: ["favicon", "icon", "app icon", "logo", "manifest", "png"],
  embed: ["embed", "inline", "html", "svg", "data uri", "base64", "web"],
  base64: ["base64", "data uri", "inline", "embed", "text"],
  code: ["code", "html", "svg", "data uri", "base64", "embed"],
  bundle: ["bundle", "zip", "all", "multiple", "pack", "set"],
  zip: ["zip", "bundle", "all", "multiple", "pack", "set"],
  thumbnail: ["thumbnail", "thumb", "preview", "social", "web", "sizes"],
  social: ["social", "thumbnail", "preview", "web", "sizes"]
};

export function filterRecipesByQuery(recipes: ConversionRecipe[], query: string) {
  const terms = expandSearchQuery(query);
  if (!terms.length) return recipes;

  return recipes.filter((recipe) => {
    const index = buildRecipeSearchIndex(recipe);
    return terms.every((group) => group.some((term) => index.includes(term)));
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
      recipe.output,
      recipe.title,
      recipe.description,
      recipe.engine,
      ...recipe.input.map((family) => FAMILY_LABELS[family] ?? family),
      ...recipe.treatments,
      ...(recipe.keywords ?? [])
    ].join(" ")
  );
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
