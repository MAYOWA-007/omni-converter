import { BlobReader, ZipReader } from "@zip.js/zip.js";
import { normalizeArchivePath } from "./archivePaths";
import { FORMAT_REGISTRY, type ExactFormatId, type FormatDefinition } from "./formats";
import { evaluateInputRisk, type ArchiveEntryFact, type InputRiskEvaluation } from "./riskLimits";

export const MAX_FILE_HEADER_BYTES = 512;

export interface DetectedFormat {
  format: FormatDefinition;
  source: "signature" | "unknown";
  archiveEntries?: readonly ArchiveEntryFact[];
  risk: InputRiskEvaluation;
}

export async function inspectFileHeader(file: File): Promise<DetectedFormat> {
  const header = new Uint8Array(await file.slice(0, MAX_FILE_HEADER_BYTES).arrayBuffer());
  const formatId = detectSignature(header);

  if (formatId !== "zip") return detected(FORMAT_REGISTRY[formatId], formatId === "unknown" ? "unknown" : "signature");

  const archiveEntries = await inspectZipEntries(file);
  if (!archiveEntries) {
    return {
      ...detected(FORMAT_REGISTRY.zip, "signature"),
      risk: { blocked: true, reasons: ["ZIP metadata could not be inspected."] }
    };
  }
  const ooxmlFormat = detectOoxmlFormat(archiveEntries);
  return detected(FORMAT_REGISTRY[ooxmlFormat], "signature", archiveEntries);
}

function detected(format: FormatDefinition, source: DetectedFormat["source"], archiveEntries?: readonly ArchiveEntryFact[]): DetectedFormat {
  return { format, source, archiveEntries, risk: evaluateInputRisk({ archiveEntries }) };
}

function detectSignature(header: Uint8Array): ExactFormatId {
  if (matches(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (matches(header, [0xff, 0xd8, 0xff])) return "jpeg";
  if (matches(header, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || matches(header, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  if (matches(header, [0x52, 0x49, 0x46, 0x46]) && matches(header, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (matches(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (matches(header, [0x50, 0x4b, 0x03, 0x04]) || matches(header, [0x50, 0x4b, 0x05, 0x06]) || matches(header, [0x50, 0x4b, 0x07, 0x08])) return "zip";
  if (matches(header, [0x4d, 0x5a])) return "exe";
  return "unknown";
}

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

async function inspectZipEntries(file: File): Promise<ArchiveEntryFact[] | undefined> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    return entries.map(({ filename, compressedSize, uncompressedSize, directory }) => ({ name: filename, compressedSize, uncompressedSize, directory }));
  } catch {
    return undefined;
  } finally {
    await reader.close().catch(() => undefined);
  }
}

function detectOoxmlFormat(entries?: readonly ArchiveEntryFact[]): ExactFormatId {
  const names = entries?.flatMap((entry) => {
    try {
      return [normalizeArchivePath(entry.name, { directory: entry.directory })];
    } catch {
      return [];
    }
  }) ?? [];
  if (names.some((name) => name.startsWith("word/"))) return "docx";
  if (names.some((name) => name.startsWith("xl/"))) return "xlsx";
  if (names.some((name) => name.startsWith("ppt/"))) return "pptx";
  if (names.includes("mimetype") && names.includes("META-INF/container.xml")) return "epub";
  return "zip";
}
