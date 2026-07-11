import type { FileFamily } from "../lib/types";

export type ExactFormatId = "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip" | "docx" | "xlsx" | "pptx" | "epub" | "exe" | "unknown";

export interface FormatDefinition {
  id: ExactFormatId;
  label: string;
  extensions: readonly string[];
  mimeAliases: readonly string[];
  family: FileFamily;
}

export const FORMAT_REGISTRY: Record<ExactFormatId, FormatDefinition> = {
  png: { id: "png", label: "PNG", extensions: ["png"], mimeAliases: ["image/png"], family: "image" },
  jpeg: { id: "jpeg", label: "JPEG", extensions: ["jpg", "jpeg"], mimeAliases: ["image/jpeg"], family: "image" },
  gif: { id: "gif", label: "GIF", extensions: ["gif"], mimeAliases: ["image/gif"], family: "image" },
  webp: { id: "webp", label: "WebP", extensions: ["webp"], mimeAliases: ["image/webp"], family: "image" },
  pdf: { id: "pdf", label: "PDF", extensions: ["pdf"], mimeAliases: ["application/pdf"], family: "pdf" },
  zip: { id: "zip", label: "ZIP archive", extensions: ["zip"], mimeAliases: ["application/zip", "application/x-zip-compressed"], family: "archive" },
  docx: { id: "docx", label: "Word document", extensions: ["docx"], mimeAliases: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], family: "document" },
  xlsx: { id: "xlsx", label: "Excel workbook", extensions: ["xlsx"], mimeAliases: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], family: "spreadsheet" },
  pptx: { id: "pptx", label: "PowerPoint presentation", extensions: ["pptx"], mimeAliases: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], family: "presentation" },
  epub: { id: "epub", label: "EPUB ebook", extensions: ["epub"], mimeAliases: ["application/epub+zip"], family: "ebook" },
  exe: { id: "exe", label: "Windows executable", extensions: ["exe"], mimeAliases: ["application/vnd.microsoft.portable-executable", "application/x-msdownload"], family: "application" },
  unknown: { id: "unknown", label: "Unknown", extensions: [], mimeAliases: [], family: "unknown" }
};
