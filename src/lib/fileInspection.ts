import type { FileInspection } from "./types";
import { inspectFileHeader } from "../core/inspection";
import { normalizeArchivePath } from "../core/archivePaths";
import { findFormatByExtension, findFormatByMime } from "../core/formatUniverse";
import { inspectMediaContainer } from "./mediaInspection";

const MAX_PDF_ANALYSIS_BYTES = 128 * 1024 * 1024;
const MAX_XLSX_ANALYSIS_BYTES = 64 * 1024 * 1024;

export async function inspectFile(file: File): Promise<FileInspection> {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const detected = await inspectFileHeader(file);
  const mimeFormat = findFormatByMime(file.type);
  const extensionFormat = findFormatByExtension(extension);
  const zipPackageFormat = detected.format.id === "zip" && extensionFormat?.family === "application" ? extensionFormat : undefined;
  const format = detected.format.id !== "unknown" ? zipPackageFormat ?? detected.format : mimeFormat ?? extensionFormat ?? detected.format;
  const signatureSource = detected.format.id !== "unknown" ? detected.source : mimeFormat ? "mime" : extensionFormat ? "extension" : "unknown";
  const family = format.family;
  const notes = [...detected.risk.reasons];
  if (detected.format.id !== "unknown" && extension && !format.extensions.includes(extension)) {
    notes.push(`File extension .${extension} does not match detected ${format.label} content.`);
  }
  const inspection: FileInspection = {
    name: file.name,
    extension,
    mime: file.type || "unknown",
    size: file.size,
    family,
    exactFormat: format.id,
    signatureSource,
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

  if (family === "spreadsheet" && format.id === "xlsx") {
    return mergeMetadata(inspection, await inspectWorkbook(file));
  }

  if (family === "presentation" && format.id === "pptx") {
    const slides = detected.archiveEntries?.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name.replace(/\\/g, "/"))).length;
    return mergeMetadata(inspection, slides ? { slides, notes: [`Presentation slides detected: ${slides}.`] } : {});
  }

  if (family === "archive" && format.id === "zip") {
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
