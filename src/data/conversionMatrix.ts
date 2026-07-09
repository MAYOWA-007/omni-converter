import type { ConversionRecipe, EditorControl, FileFamily } from "../lib/types";

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
  outputFormat: ["Auto", "PNG", "JPEG", "WebP", "AVIF", "PDF", "TXT", "Markdown", "HTML", "ZIP"],
  timeline: ["Full file", "Marked range", "Current clip", "Intro only", "Outro only", "Custom marks"],
  trim: ["None", "Start/end handles", "First 5 seconds", "First 15 seconds", "First 30 seconds", "Custom range"],
  crop: ["None", "Fit entire source", "Fill target", "Center crop", "Trim transparent edges", "Safe social crop", "Custom crop"],
  aspectRatio: ["Original", "1:1 square", "4:5 portrait", "5:4 landscape", "16:9 widescreen", "9:16 vertical", "3:2 photo", "2:3 portrait", "A4 page", "Letter page", "Custom"],
  resolution: ["Original", "512 px", "1024 px", "1080 px", "1920 px", "2K", "4K", "150 DPI", "300 DPI", "Custom"],
  frameRate: ["Source", "12 fps", "15 fps", "24 fps", "25 fps", "30 fps", "60 fps", "Custom"],
  frameInterval: ["Every frame", "Every 0.5 seconds", "Every 1 second", "Every 2 seconds", "Every 5 seconds", "Every 10 seconds", "Scene changes", "Custom interval"],
  chapterInterval: ["None", "Every minute", "Every 2 minutes", "Every 5 minutes", "Detected chapters", "Scene breaks", "Custom chapter marks"],
  audioGain: ["Keep source", "Normalize", "-6 dB", "-3 dB", "+3 dB", "+6 dB", "Mute", "Custom"],
  audioFade: ["None", "Fade in", "Fade out", "Fade in and out", "Crossfade clips", "Custom"],
  waveform: ["None", "PNG waveform", "SVG waveform", "Audiogram background", "Timeline peaks JSON"],
  captions: ["None", "Import SRT", "Import VTT", "Export SRT", "Export VTT", "Burn in later", "Transcript package"],
  color: ["Original", "sRGB", "Display P3", "Grayscale", "CMYK prep", "Transparent matte", "White matte", "Black matte"],
  compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview", "Custom"],
  pageOrder: ["All pages", "Current page", "First page", "Last page", "Odd pages", "Even pages", "Custom range", "Split every page", "Reverse order"],
  pageSize: ["Auto", "Original", "Letter", "Legal", "A4", "A5", "16:9 slide", "4:5 carousel", "1:1 square", "Custom"],
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

type RecipeInput = Omit<ConversionRecipe, "implementation" | "localOnly"> & Partial<Pick<ConversionRecipe, "implementation">>;

function recipe(config: RecipeInput): ConversionRecipe {
  return {
    implementation: "ready",
    localOnly: true,
    ...config
  };
}

function options(values: Partial<Record<EditorControl, string[]>>) {
  return values;
}

const imageFormatOptions = options({
  resolution: ["Original", "512 px", "1024 px", "1080 px", "1920 px", "2K", "4K", "Custom width"],
  compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview"],
  metadata: ["Keep", "Strip", "Inspect report", "Normalize"],
  batchNaming: ["Keep source name", "Clean filename", "Size suffix", "Format suffix", "Custom pattern"]
});

const pdfPageOptions = options({
  pageOrder: ["All pages", "First page", "Last page", "Odd pages", "Even pages", "Custom range", "Split every page"],
  resolution: ["96 DPI", "150 DPI", "200 DPI", "300 DPI", "2x screen", "4x screen"],
  compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
  batchNaming: ["Page number suffix", "Clean filename", "Custom pattern"],
  bundle: ["ZIP", "ZIP with manifest", "Folder by page"]
});

export const CONVERSION_RECIPES: ConversionRecipe[] = [
  recipe({
    id: "image-to-pdf",
    input: ["image"],
    category: "PDF",
    output: "PDF",
    title: "Image to PDF",
    description: "Convert the image into a clean single-page PDF.",
    treatments: ["Single page", "Original size", "PDF"],
    keywords: ["document", "paper", "print", "portable document", "share", "page"],
    editorControls: ["pageSize", "margins", "compression", "metadata", "batchNaming"],
    controlOptions: options({
      pageSize: ["Original image size", "Letter", "A4", "16:9 slide", "4:5 carousel", "1:1 square", "Custom"],
      margins: ["None", "Narrow", "Standard", "Wide", "Bleed"],
      compression: ["Maximum quality", "High quality", "Balanced", "Small file"],
      metadata: ["Keep", "Strip", "Inspect report"],
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
    editorControls: ["pageSize", "margins", "compression", "metadata", "batchNaming"],
    controlOptions: options({
      pageSize: ["Letter", "A4", "Legal", "A5"],
      margins: ["Narrow", "Standard", "Wide", "Bleed"],
      compression: ["Maximum quality", "High quality", "Balanced"],
      metadata: ["Keep", "Strip", "Inspect report"],
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
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
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
    editorControls: ["resolution", "compression", "color", "metadata", "batchNaming"],
    controlOptions: { ...imageFormatOptions, color: ["White matte", "Black matte", "Sample edge color", "Custom matte"] },
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
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
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
    editorControls: ["resolution", "compression", "metadata", "batchNaming"],
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
    editorControls: ["resolution", "color", "metadata", "batchNaming"],
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
    description: "Embed the raster image inside an SVG file.",
    treatments: ["SVG", "Embedded image", "Scalable frame"],
    keywords: ["svg", "vector", "wrapper", "embed", "xml", "graphic", "image"],
    editorControls: ["resolution", "metadata", "batchNaming"],
    controlOptions: imageFormatOptions,
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
    editorControls: ["metadata", "batchNaming"],
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
    editorControls: ["metadata", "batchNaming"],
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
    treatments: ["320", "640", "1080", "WebP"],
    keywords: ["thumbnail", "thumb", "preview", "sizes", "web", "social", "zip", "bundle"],
    editorControls: ["resolution", "compression", "batchNaming", "bundle"],
    controlOptions: {
      resolution: ["320/640/1080/1920 set", "512/1024/2048 set", "Social thumbnail set", "Custom sizes"],
      compression: ["High quality", "Balanced", "Small file"],
      batchNaming: ["Width suffix", "Clean filename", "Custom pattern"],
      bundle: ["ZIP", "ZIP with manifest", "Folder by size"]
    },
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + fflate",
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
      crop: ["Center crop", "Fit inside transparent square", "Trim transparent edges", "Safe rounded icon crop"],
      resolution: ["16/32/48/180/192/512 set", "Full PWA set", "Browser-only set"],
      batchNaming: ["Icon size suffix", "Clean filename", "Custom pattern"],
      bundle: ["ZIP", "ZIP with manifest", "Folder by size"]
    },
    requiredCapabilities: ["canvas", "image", "zip"],
    intensity: "light",
    engine: "Canvas + fflate",
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
    editorControls: ["resolution", "compression", "metadata", "batchNaming", "bundle"],
    controlOptions: imageFormatOptions,
    requiredCapabilities: ["canvas", "image", "zip", "webpEncoder"],
    intensity: "light",
    engine: "Canvas + fflate",
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
    editorControls: ["aspectRatio", "crop", "resolution", "compression", "batchNaming", "bundle"],
    requiredCapabilities: ["canvas", "image", "zip"],
    intensity: "light",
    engine: "Canvas social preset renderer"
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
    controlOptions: { pageOrder: ["All pages", "First page", "Last page", "Custom range"], metadata: ["Keep page breaks", "Remove page breaks", "Add page headings"], batchNaming: ["TXT suffix", "Clean filename"] },
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
    controlOptions: { pageOrder: ["All pages", "First page", "Last page", "Custom range"], metadata: ["Page headings", "Minimal headings", "Include source metadata"], batchNaming: ["Markdown suffix", "Clean filename"] },
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
    controlOptions: { pageOrder: ["All pages", "First page", "Last page", "Custom range"], metadata: ["Include source metadata", "Minimal"], batchNaming: ["HTML suffix", "Clean filename"] },
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
    engine: "PDF.js canvas renderer + fflate",
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
    engine: "PDF.js canvas renderer + fflate",
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
    controlOptions: { pageOrder: ["All pages", "Odd pages", "Even pages", "Custom range"], batchNaming: ["Page number suffix", "Clean filename"], bundle: ["ZIP", "ZIP with manifest"] },
    requiredCapabilities: ["pdf", "zip", "worker"],
    intensity: "standard",
    engine: "pdf-lib + fflate",
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
    controlOptions: { metadata: ["JSON report", "JSON + text summary"], batchNaming: ["Metadata suffix", "Clean filename"] },
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
    title: "PDF to 16:9 slide images",
    description: "Render pages as slide-ready PNG images with widescreen padding.",
    treatments: ["16:9", "Slide PNGs", "ZIP"],
    keywords: ["presentation", "deck", "slides", "ppt", "keynote", "pdf", "images"],
    editorControls: ["pageOrder", "aspectRatio", "resolution", "color", "batchNaming", "bundle"],
    controlOptions: { ...pdfPageOptions, aspectRatio: ["16:9 widescreen", "4:3 classic slides"], color: ["Original", "White letterbox", "Black letterbox"] },
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
    description: "Extract page text into a slide-by-slide presentation outline.",
    treatments: ["Slide outline", "Speaker notes", "PPTX later"],
    keywords: ["presentation", "deck", "pptx", "powerpoint", "outline", "speaker notes"],
    editorControls: ["pageOrder", "metadata", "batchNaming", "bundle"],
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
    controlOptions: { ...pdfPageOptions, aspectRatio: ["4:5 portrait", "1:1 square", "16:9 widescreen"], crop: ["Fit entire page", "Fill target", "Safe crop"] },
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
    editorControls: ["pageOrder", "pageSize", "margins", "metadata", "batchNaming"],
    controlOptions: { pageOrder: ["All pages", "Custom range"], pageSize: ["Letter", "A4"], margins: ["Narrow", "Standard", "Wide"] },
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
    title: "Compress PDF",
    description: "Reduce PDF size by rewriting, cleaning metadata, and downsampling images where possible.",
    treatments: ["Compress", "Strip metadata", "PDF"],
    keywords: ["compress", "optimize", "small", "pdf", "metadata"],
    editorControls: ["compression", "metadata", "batchNaming"],
    requiredCapabilities: ["pdf", "worker"],
    intensity: "standard",
    engine: "pdf-lib optimizer"
  }),

  recipe({
    id: "video-to-frames",
    input: ["video"],
    category: "Frames",
    output: "Frame ZIP",
    title: "Video to image frames",
    description: "Extract still frames by every frame, every N seconds, chapters, scene picks, or manual timeline marks.",
    treatments: ["Every frame", "Every second", "Custom interval", "ZIP"],
    editorControls: ["timeline", "trim", "outputFormat", "frameInterval", "chapterInterval", "resolution", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PNG", "JPEG", "WebP"], frameInterval: DEFAULT_CONTROL_OPTIONS.frameInterval },
    requiredCapabilities: ["video", "canvas", "worker"],
    intensity: "standard",
    engine: "HTMLVideoElement + Canvas; FFmpeg WASM for advanced modes"
  }),
  recipe({
    id: "video-to-mp4",
    input: ["video"],
    category: "Video format",
    output: "MP4",
    title: "Video to MP4",
    description: "Transcode, trim, crop, resize, and compress into MP4.",
    treatments: ["MP4", "Trim", "Aspect", "Compress"],
    editorControls: ["timeline", "trim", "crop", "aspectRatio", "resolution", "frameRate", "audioGain", "compression", "bundle"],
    requiredCapabilities: ["video", "wasm", "worker", "webcodecs"],
    intensity: "extreme",
    engine: "Mediabunny / WebCodecs / FFmpeg WASM"
  }),
  recipe({
    id: "video-to-webm",
    input: ["video"],
    category: "Video format",
    output: "WebM",
    title: "Video to WebM",
    description: "Create a browser-friendly WebM file with size controls.",
    treatments: ["WebM", "VP9/AV1", "Compress"],
    editorControls: ["timeline", "trim", "crop", "aspectRatio", "resolution", "frameRate", "audioGain", "compression"],
    requiredCapabilities: ["video", "wasm", "worker", "webcodecs"],
    intensity: "extreme",
    engine: "Mediabunny / WebCodecs / FFmpeg WASM"
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
    category: "Audio extraction",
    output: "Audio",
    title: "Video to audio file",
    description: "Extract MP3, WAV, AAC, or M4A audio from a video.",
    treatments: ["MP3", "WAV", "AAC", "M4A"],
    editorControls: ["outputFormat", "timeline", "trim", "audioGain", "audioFade", "metadata", "batchNaming"],
    controlOptions: { outputFormat: ["MP3", "WAV", "AAC", "M4A", "OGG"], audioGain: DEFAULT_CONTROL_OPTIONS.audioGain },
    requiredCapabilities: ["audio", "video", "wasm", "worker"],
    intensity: "heavy",
    engine: "FFmpeg WASM + Web Audio"
  }),
  recipe({
    id: "video-thumbnail-sheet",
    input: ["video"],
    category: "Frames",
    output: "Contact sheet",
    title: "Video thumbnail contact sheet",
    description: "Create a single overview image showing frames across the timeline.",
    treatments: ["Contact sheet", "Timeline", "PNG"],
    editorControls: ["timeline", "frameInterval", "aspectRatio", "resolution", "batchNaming"],
    requiredCapabilities: ["video", "canvas", "worker"],
    intensity: "standard",
    engine: "HTMLVideoElement + Canvas"
  }),
  recipe({
    id: "audio-to-mp3",
    input: ["audio"],
    category: "Audio format",
    output: "MP3",
    title: "Audio to MP3",
    description: "Convert, trim, normalize, and compress audio to MP3.",
    treatments: ["MP3", "Trim", "Normalize"],
    editorControls: ["timeline", "trim", "audioGain", "audioFade", "compression", "metadata", "batchNaming"],
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "heavy",
    engine: "Web Audio + FFmpeg WASM"
  }),
  recipe({
    id: "audio-to-wav",
    input: ["audio", "video"],
    category: "Audio format",
    output: "WAV",
    title: "Audio to WAV",
    description: "Export uncompressed WAV for editing or archiving.",
    treatments: ["WAV", "Lossless", "Normalize"],
    editorControls: ["timeline", "trim", "audioGain", "audioFade", "metadata", "batchNaming"],
    requiredCapabilities: ["audio", "wasm", "worker"],
    intensity: "standard",
    engine: "Web Audio + FFmpeg WASM"
  }),
  recipe({
    id: "audio-waveform",
    input: ["audio", "video"],
    category: "Audio visual",
    output: "PNG / SVG",
    title: "Audio to waveform image",
    description: "Render waveform graphics for thumbnails, notes, or audiograms.",
    treatments: ["Waveform", "PNG", "SVG"],
    editorControls: ["timeline", "waveform", "color", "resolution", "batchNaming"],
    requiredCapabilities: ["audio", "canvas", "worker"],
    intensity: "standard",
    engine: "Web Audio + wavesurfer.js"
  }),

  recipe({
    id: "spreadsheet-to-csv",
    input: ["spreadsheet"],
    category: "Table format",
    output: "CSV",
    title: "Spreadsheet to CSV",
    description: "Export sheets as CSV files with column cleanup options.",
    treatments: ["CSV", "Sheets", "Clean columns"],
    editorControls: ["outputFormat", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["CSV", "TSV", "Pipe-delimited"], bundle: ["Single first sheet", "ZIP each sheet", "ZIP with manifest"] },
    requiredCapabilities: ["spreadsheet", "worker", "zip"],
    intensity: "standard",
    engine: "read-excel-file + CSV writer"
  }),
  recipe({
    id: "spreadsheet-to-json",
    input: ["spreadsheet", "data"],
    category: "Table format",
    output: "JSON",
    title: "Spreadsheet to JSON",
    description: "Convert rows into JSON objects, arrays, or nested records.",
    treatments: ["JSON", "Rows", "Schema"],
    editorControls: ["outputFormat", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["Array of objects", "Array of arrays", "Nested by first column", "JSON Lines"], metadata: ["Infer types", "Keep strings", "Schema report"] },
    requiredCapabilities: ["spreadsheet", "worker"],
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
    input: ["data", "code"],
    category: "Data format",
    output: "CSV / JSON",
    title: "JSON CSV TSV transform",
    description: "Convert structured data between JSON, CSV, TSV, XML, YAML, and Markdown tables.",
    treatments: ["JSON", "CSV", "TSV", "Markdown"],
    editorControls: ["outputFormat", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["JSON", "CSV", "TSV", "Markdown table", "XML", "YAML"], metadata: ["Prettify", "Minify", "Flatten", "Schema report"] },
    requiredCapabilities: ["worker"],
    intensity: "light",
    engine: "Native parsers + focused libraries"
  }),
  recipe({
    id: "document-to-markdown",
    input: ["document", "ebook", "presentation"],
    category: "Document format",
    output: "Markdown",
    title: "Document to Markdown",
    description: "Extract headings, text, links, and basic tables into Markdown.",
    treatments: ["Markdown", "Headings", "Tables"],
    editorControls: ["pageOrder", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "Mammoth + ZIP/XML readers"
  }),
  recipe({
    id: "document-to-html",
    input: ["document", "ebook", "presentation"],
    category: "Document format",
    output: "HTML",
    title: "Document to HTML",
    description: "Export a standalone HTML version of the document.",
    treatments: ["HTML", "Clean styles", "Assets"],
    editorControls: ["pageOrder", "metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "Mammoth + ZIP/XML readers"
  }),
  recipe({
    id: "document-assets",
    input: ["document", "ebook", "presentation"],
    category: "Asset extraction",
    output: "Asset ZIP",
    title: "Extract document assets",
    description: "Pull embedded images, media, XML parts, and a manifest into a ZIP.",
    treatments: ["Images", "Media", "Manifest", "ZIP"],
    editorControls: ["metadata", "batchNaming", "bundle"],
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "ZIP/XML readers"
  }),
  recipe({
    id: "presentation-slide-images",
    input: ["presentation"],
    category: "Presentation",
    output: "Slide image ZIP",
    title: "Presentation to slide images",
    description: "Render or extract each slide as a PNG/JPEG image set.",
    treatments: ["Slide images", "PNG/JPEG", "ZIP"],
    editorControls: ["outputFormat", "pageOrder", "aspectRatio", "resolution", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["PNG", "JPEG", "WebP"], aspectRatio: ["16:9 widescreen", "4:3 classic"], resolution: ["1080 px", "1920 px", "2K", "4K"] },
    requiredCapabilities: ["canvas", "worker", "zip"],
    intensity: "standard",
    engine: "PPTX ZIP/XML reader + renderer"
  }),
  recipe({
    id: "presentation-notes",
    input: ["presentation"],
    category: "Text extraction",
    output: "TXT / Markdown",
    title: "Presentation to notes text",
    description: "Extract slide titles, speaker notes, and visible text.",
    treatments: ["Speaker notes", "Text", "Markdown"],
    editorControls: ["outputFormat", "pageOrder", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["TXT", "Markdown", "JSON outline"] },
    requiredCapabilities: ["worker", "zip"],
    intensity: "standard",
    engine: "PPTX ZIP/XML reader"
  }),
  recipe({
    id: "archive-extract",
    input: ["archive"],
    category: "Archive",
    output: "Files",
    title: "Extract archive files",
    description: "Inspect an archive and extract selected files.",
    treatments: ["List contents", "Extract selected", "Nested warning"],
    editorControls: ["metadata", "batchNaming", "bundle", "compression"],
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "zip.js / fflate"
  }),
  recipe({
    id: "archive-repack-zip",
    input: ["archive"],
    category: "Archive",
    output: "ZIP",
    title: "Repack archive as ZIP",
    description: "Normalize names, remove unwanted files, and repack as ZIP.",
    treatments: ["Repack", "Rename", "Compress", "Manifest"],
    editorControls: ["metadata", "batchNaming", "compression", "bundle"],
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "zip.js / fflate"
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
    category: "Ebook",
    output: "TXT / Markdown / HTML",
    title: "Ebook to readable text",
    description: "Extract ebook chapters into TXT, Markdown, HTML, or a ZIP bundle.",
    treatments: ["Chapters", "Text", "HTML", "Markdown"],
    editorControls: ["outputFormat", "pageOrder", "metadata", "batchNaming", "bundle"],
    controlOptions: { outputFormat: ["TXT", "Markdown", "HTML", "ZIP by chapter"] },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "EPUB ZIP/XML reader"
  }),
  recipe({
    id: "application-compress-zip",
    input: ["application"],
    category: "Compression",
    output: "Compressed ZIP",
    title: "Compress application package",
    description: "Package an executable, installer, or app binary into a compressed ZIP with a checksum manifest.",
    treatments: ["Maximum ZIP compression", "SHA-256 checksum", "Manifest", "Original preserved"],
    keywords: ["exe", "msi", "installer", "app", "apk", "dmg", "binary", "compress", "zip", "checksum", "package"],
    editorControls: ["compression", "metadata", "batchNaming", "bundle"],
    controlOptions: {
      compression: ["Maximum Deflate", "Balanced ZIP", "Store only"],
      metadata: ["Checksum manifest", "Inspect report", "Keep source metadata"],
      batchNaming: ["Keep source name", "Clean filename", "Version suffix", "Custom pattern"],
      bundle: ["ZIP with manifest", "ZIP with README", "Single compressed ZIP"]
    },
    requiredCapabilities: ["zip", "worker"],
    intensity: "standard",
    engine: "fflate ZIP + Web Crypto"
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
  audio: ["audio", "mp3", "wav", "m4a", "aac", "waveform", "sound"],
  video: ["video", "mp4", "webm", "gif", "frames", "clips", "motion"],
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
