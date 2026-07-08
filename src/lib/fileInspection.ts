import type { FileFamily, FileInspection } from "./types";

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
  mobi: "ebook"
};

export async function inspectFile(file: File): Promise<FileInspection> {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const family = inferFamily(file.type, extension);
  const inspection: FileInspection = {
    name: file.name,
    extension,
    mime: file.type || "unknown",
    size: file.size,
    family,
    notes: []
  };

  if (family === "image" && file.type !== "image/svg+xml") {
    return { ...inspection, ...(await inspectImage(file)) };
  }

  if (family === "video") {
    return { ...inspection, ...(await inspectMedia(file, "video")) };
  }

  if (family === "audio") {
    return { ...inspection, ...(await inspectMedia(file, "audio")) };
  }

  return inspection;
}

function inferFamily(mime: string, extension: string): FileFamily {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
  if (mime.includes("zip") || mime.includes("compressed")) return "archive";
  if (mime.includes("json") || mime.includes("xml") || mime.startsWith("text/")) return EXTENSION_FAMILY[extension] ?? "data";
  return EXTENSION_FAMILY[extension] ?? "unknown";
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

async function inspectMedia(file: File, kind: "audio" | "video"): Promise<Partial<FileInspection>> {
  const url = URL.createObjectURL(file);
  const element = document.createElement(kind);
  element.preload = "metadata";
  element.src = url;

  return new Promise((resolve) => {
    const cleanup = () => URL.revokeObjectURL(url);
    element.onloadedmetadata = () => {
      cleanup();
      resolve({
        duration: Number.isFinite(element.duration) ? element.duration : undefined,
        width: kind === "video" ? (element as HTMLVideoElement).videoWidth : undefined,
        height: kind === "video" ? (element as HTMLVideoElement).videoHeight : undefined,
        notes: [`${kind === "video" ? "Video" : "Audio"} metadata loaded.`]
      });
    };
    element.onerror = () => {
      cleanup();
      resolve({ notes: [`Browser could not fully decode metadata for this ${kind}.`] });
    };
  });
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
