import type { FileFamily, FileInspection } from "./types";
import { inspectFileHeader } from "../core/inspection";
import { normalizeArchivePath } from "../core/archivePaths";
import { inspectMediaContainer } from "./mediaInspection";

const MAX_PDF_ANALYSIS_BYTES = 128 * 1024 * 1024;
const MAX_XLSX_ANALYSIS_BYTES = 64 * 1024 * 1024;

const EXTENSION_FAMILY: Record<string, FileFamily> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  avif: "image",
  bmp: "image",
  tiff: "image",
  tif: "image",
  svg: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  ogg: "audio",
  pdf: "pdf",
  doc: "document",
  docx: "document",
  rtf: "document",
  txt: "document",
  md: "document",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  csv: "data",
  tsv: "data",
  ppt: "presentation",
  pptx: "presentation",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  json: "data",
  xml: "data",
  yaml: "data",
  yml: "data",
  html: "code",
  css: "code",
  js: "code",
  ts: "code",
  jsx: "code",
  tsx: "code",
  py: "code",
  otf: "font",
  ttf: "font",
  woff: "font",
  woff2: "font",
  glb: "model3d",
  gltf: "model3d",
  obj: "model3d",
  stl: "model3d",
  fbx: "model3d",
  epub: "ebook",
  mobi: "ebook",
  exe: "application",
  msi: "application",
  app: "application",
  apk: "application",
  dmg: "application",
  pkg: "application",
  deb: "application",
  rpm: "application",
  appimage: "application",
  bin: "application",
  run: "application"
};

export async function inspectFile(file: File): Promise<FileInspection> {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const detected = await inspectFileHeader(file);
  const detectedFamily = detected.format.family === "unknown" ? inferFamily(file.type, extension) : detected.format.family;
  const family = isApplicationPackageExtension(extension) && (detected.format.id === "unknown" || detected.format.id === "zip") ? "application" : detectedFamily;
  const notes = [...detected.risk.reasons];
  if (detected.format.id !== "unknown" && extension && !detected.format.extensions.includes(extension)) {
    notes.push(`File extension .${extension} does not match detected ${detected.format.label} content.`);
  }
  const inspection: FileInspection = {
    name: file.name,
    extension,
    mime: file.type || "unknown",
    size: file.size,
    family,
    exactFormat: detected.format.id,
    signatureSource: detected.source,
    riskBlocked: detected.risk.blocked,
    riskReasons: detected.risk.reasons,
    notes
  };

  if (family === "image" && file.type !== "image/svg+xml") {
    return mergeMetadata(inspection, await inspectImage(file));
  }

  if (family === "pdf") {
    return mergeMetadata(inspection, await inspectPdf(file));
  }

  if (family === "spreadsheet" && detected.format.id === "xlsx") {
    return mergeMetadata(inspection, await inspectWorkbook(file));
  }

  if (family === "presentation" && detected.format.id === "pptx") {
    const slides = detected.archiveEntries?.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name.replace(/\\/g, "/"))).length;
    return mergeMetadata(inspection, slides ? { slides, notes: [`Presentation slides detected: ${slides}.`] } : {});
  }

  if (family === "archive" && detected.format.id === "zip") {
    const archiveEntries = detected.archiveEntries?.flatMap((entry) => {
      if (entry.directory) return [];
      try {
        return [{ name: normalizeArchivePath(entry.name), size: entry.uncompressedSize }];
      } catch {
        return [];
      }
    }) ?? [];
    return mergeMetadata(inspection, { archiveEntries, notes: [`ZIP files detected: ${archiveEntries.length}.`] });
  }

  if (family === "video") {
    return mergeMetadata(inspection, await inspectMediaContainer(file, "video"));
  }

  if (family === "audio") {
    return mergeMetadata(inspection, await inspectMediaContainer(file, "audio"));
  }

  return inspection;
}

async function inspectPdf(file: File): Promise<Partial<FileInspection>> {
  if (file.size > MAX_PDF_ANALYSIS_BYTES) {
    return { notes: ["PDF page count will be read when conversion starts."] };
  }

  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
    const pages = pdf.getPageCount();
    return { pages, notes: [`PDF pages detected: ${pages}.`] };
  } catch {
    return { notes: ["PDF page count could not be read during analysis."] };
  }
}

async function inspectWorkbook(file: File): Promise<Partial<FileInspection>> {
  if (file.size > MAX_XLSX_ANALYSIS_BYTES) {
    return { notes: ["Workbook sheets will be read when conversion starts."] };
  }
  try {
    const { default: readWorkbook } = await import("read-excel-file/browser");
    const sheets = (await readWorkbook(file, { trim: false })).map((sheet) => sheet.sheet);
    return { sheets, notes: [`Workbook sheets detected: ${sheets.length}.`] };
  } catch {
    return { notes: ["Workbook sheet names could not be read during analysis."] };
  }
}

function mergeMetadata(inspection: FileInspection, metadata: Partial<FileInspection>): FileInspection {
  return { ...inspection, ...metadata, notes: [...inspection.notes, ...(metadata.notes ?? [])] };
}

function inferFamily(mime: string, extension: string): FileFamily {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
  if (mime.includes("zip") || mime.includes("compressed")) return "archive";
  if (isApplicationPackageMime(mime) || isApplicationPackageExtension(extension)) return "application";
  if (mime.includes("json") || mime.includes("xml") || mime.startsWith("text/")) return EXTENSION_FAMILY[extension] ?? "data";
  return EXTENSION_FAMILY[extension] ?? "unknown";
}

function isApplicationPackageMime(mime: string) {
  return /x-msdownload|x-msdos-program|portable-executable|x-msi|vnd\.microsoft\.installer|vnd\.android\.package-archive|octet-stream/i.test(mime);
}

function isApplicationPackageExtension(extension: string) {
  return EXTENSION_FAMILY[extension] === "application";
}

async function inspectImage(file: File): Promise<Partial<FileInspection>> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      notes: [`Image dimensions detected: ${image.naturalWidth} x ${image.naturalHeight}.`]
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}
