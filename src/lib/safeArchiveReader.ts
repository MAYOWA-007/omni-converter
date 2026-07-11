import { BlobReader, BlobWriter, ZipReader, type Entry, type FileEntry } from "@zip.js/zip.js";
import { archivePathKey, normalizeArchivePath } from "../core/archivePaths";
import { evaluateInputRisk } from "../core/riskLimits";

export const DEFAULT_ARCHIVE_TEXT_READ_LIMIT = 4 * 1024 * 1024;
export const DEFAULT_ARCHIVE_BLOB_READ_LIMIT = 128 * 1024 * 1024;

export interface SafeArchiveEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  text(maxBytes?: number): Promise<string>;
  blob(type?: string, maxBytes?: number): Promise<Blob>;
}

export interface SafeArchive {
  entries: readonly SafeArchiveEntry[];
  totalUncompressedBytes: number;
  find(name: string): SafeArchiveEntry | undefined;
  require(name: string): SafeArchiveEntry;
}

export async function withSafeZip<T>(file: File | Blob, callback: (archive: SafeArchive) => T | Promise<T>): Promise<T> {
  const reader = new ZipReader(new BlobReader(file), { checkSignature: true, checkOverlappingEntry: true });
  let open = true;
  try {
    const rawEntries = await reader.getEntries();
    validateEntryMetadata(rawEntries);
    const entries = rawEntries
      .filter((entry): entry is FileEntry => !entry.directory)
      .map((entry) => safeEntry(entry, () => open));
    const byPath = new Map(entries.map((entry) => [archivePathKey(entry.name), entry]));
    const archive: SafeArchive = {
      entries,
      totalUncompressedBytes: entries.reduce((total, entry) => total + entry.uncompressedSize, 0),
      find(name) {
        try {
          return byPath.get(archivePathKey(name));
        } catch {
          return undefined;
        }
      },
      require(name) {
        const entry = this.find(name);
        if (!entry) throw new Error(`Archive entry was not found: ${name}`);
        return entry;
      }
    };
    return await callback(archive);
  } finally {
    open = false;
    await reader.close().catch(() => undefined);
  }
}

export function resolveArchiveTarget(sourcePart: string, target: string) {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) {
    throw new Error(`Archive relationship target is external or empty: ${target}`);
  }
  const base = new URL(normalizeArchivePath(sourcePart), "https://archive.invalid/");
  const resolved = new URL(target.replace(/\\/g, "/"), base);
  if (resolved.origin !== base.origin) throw new Error(`Archive relationship leaves the package: ${target}`);
  return normalizeArchivePath(decodeURIComponent(resolved.pathname.replace(/^\//, "")));
}

function validateEntryMetadata(entries: readonly Entry[]) {
  if (entries.some((entry) => entry.encrypted)) throw new Error("Encrypted ZIP entries are not supported in the browser converter.");
  const risk = evaluateInputRisk({
    archiveEntries: entries.map((entry) => ({
      name: entry.filename,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      directory: entry.directory
    }))
  });
  if (risk.blocked) throw new Error(`Unsafe archive: ${risk.reasons.join(" ")}`);
}

function safeEntry(entry: FileEntry, isOpen: () => boolean): SafeArchiveEntry {
  const name = normalizeArchivePath(entry.filename);
  async function readBlob(type: string, maxBytes: number) {
    if (!isOpen()) throw new Error(`Archive entry cannot be read after the archive is closed: ${name}`);
    if (entry.uncompressedSize > maxBytes) throw new Error(`Archive entry exceeds the ${maxBytes} byte read limit: ${name}`);
    return entry.getData(new BlobWriter(type), { checkSignature: true, checkOverlappingEntry: true });
  }
  return {
    name,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    compressionMethod: entry.compressionMethod,
    async text(maxBytes = DEFAULT_ARCHIVE_TEXT_READ_LIMIT) {
      const blob = await readBlob("application/octet-stream", maxBytes);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error(`Archive text entry is not valid UTF-8: ${name}`);
      }
    },
    blob(type = "application/octet-stream", maxBytes = DEFAULT_ARCHIVE_BLOB_READ_LIMIT) {
      return readBlob(type, maxBytes);
    }
  };
}
