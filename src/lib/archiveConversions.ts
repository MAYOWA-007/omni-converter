import { archiveEntryMatches } from "./archiveOptions";
import { baseFileName, zipLevelFromCompression, zipOutputs, type ConversionOutput } from "./conversionHelpers";
import { withSafeZip, type SafeArchiveEntry } from "./safeArchiveReader";
import type { ConversionSettings } from "./types";

export async function inspectZipArchive(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  return withSafeZip(file, async (archive) => {
    const includeChecksums = settings.metadata === "File list + SHA-256";
    const entries = [];
    for (const entry of archive.entries) {
      entries.push({
        name: entry.name,
        compressedBytes: entry.compressedSize,
        uncompressedBytes: entry.uncompressedSize,
        method: entry.compressionMethod,
        ...(includeChecksums ? { sha256: await sha256Blob(await entry.blob()) } : {})
      });
    }
    const compressedBytes = entries.reduce((total, entry) => total + entry.compressedBytes, 0);
    const uncompressedBytes = entries.reduce((total, entry) => total + entry.uncompressedBytes, 0);
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-archive-report";
    return jsonOutput(`${baseName}${suffix}.json`, {
      source: file.name,
      archiveBytes: file.size,
      fileCount: entries.length,
      compressedPayloadBytes: compressedBytes,
      uncompressedBytes,
      payloadExpansionRatio: compressedBytes ? round(uncompressedBytes / compressedBytes) : null,
      entries
    });
  });
}

export async function createExtractedZip(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  return withSafeZip(file, async (archive) => {
    const selected = archive.entries.filter((entry) => archiveEntryMatches(entry.name, settings.archiveSelection));
    if (!selected.length) throw new Error("No archive files match the selected filter.");
    const outputs: ConversionOutput[] = [];
    for (const entry of selected) outputs.push({ name: `extracted/${entry.name}`, blob: await entry.blob(mimeForName(entry.name)) });
    if (settings.metadata !== "Files only") {
      outputs.push(jsonOutput("_omni/extraction-manifest.json", {
        source: file.name,
        selection: settings.archiveSelection ?? "All files",
        files: selected.map(entryReport)
      }));
    }
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-extracted";
    return zipOutputs(`${baseName}${suffix}.zip`, outputs, zipLevelFromCompression(settings.compression));
  });
}

export async function repackZipArchive(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  return withSafeZip(file, async (archive) => {
    const removeJunk = settings.metadata !== "Keep all + manifest";
    const selected = removeJunk ? archive.entries.filter((entry) => !isOperatingSystemJunk(entry.name)) : [...archive.entries];
    if (!selected.length) throw new Error("No files remain after archive cleanup.");
    const outputs: ConversionOutput[] = [];
    for (const entry of selected) outputs.push({ name: entry.name, blob: await entry.blob(mimeForName(entry.name)) });
    if (settings.metadata !== "Remove OS junk, files only") {
      outputs.push(jsonOutput(uniqueManifestPath(new Set(outputs.map((output) => output.name.toLowerCase()))), {
        source: file.name,
        removed: archive.entries.filter((entry) => !selected.includes(entry)).map((entry) => entry.name),
        files: selected.map(entryReport)
      }));
    }
    const suffix = settings.batchNaming === "Clean filename" ? "" : "-repacked";
    return zipOutputs(`${baseName}${suffix}.zip`, outputs, zipLevelFromCompression(settings.compression));
  });
}

export async function compressApplicationPackage(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput[]> {
  const checksum = await sha256Blob(file);
  const packagedName = safePackagedFilename(file.name);
  const level = zipLevelFromCompression(settings.compression);
  const suffix = settings.batchNaming === "Clean filename" ? "" : "-compressed";
  const manifest = {
    source: file.name,
    packagedAs: `original/${packagedName}`,
    mime: file.type || "application/octet-stream",
    originalBytes: file.size,
    compression: settings.compression ?? "Maximum ZIP",
    sha256: checksum,
    preservation: "The original file bytes are stored unchanged inside this ZIP."
  };
  const archive = await zipOutputs(`${baseName}${suffix}.zip`, [
    { name: `original/${packagedName}`, blob: file },
    jsonOutput("manifest.json", manifest)
  ], level);
  const ratio = file.size ? archive.blob.size / file.size : null;
  const report = jsonOutput(`${baseName}${suffix}-compression-report.json`, {
    ...manifest,
    archive: archive.name,
    archiveBytes: archive.blob.size,
    archiveToOriginalRatio: ratio == null ? null : round(ratio),
    spaceSavedPercent: ratio == null ? null : round((1 - ratio) * 100)
  });
  return [archive, report];
}

function entryReport(entry: SafeArchiveEntry) {
  return { name: entry.name, compressedBytes: entry.compressedSize, uncompressedBytes: entry.uncompressedSize, method: entry.compressionMethod };
}

function isOperatingSystemJunk(name: string) {
  return /(^|\/)(?:__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(?:\/|$)/i.test(name);
}

function uniqueManifestPath(paths: Set<string>) {
  let index = 1;
  let path = "_omni/repack-manifest.json";
  while (paths.has(path.toLowerCase())) {
    index += 1;
    path = `_omni/repack-manifest-${index}.json`;
  }
  return path;
}

function safePackagedFilename(name: string) {
  const extension = /\.([a-z0-9]{1,16})$/i.exec(name)?.[1]?.toLowerCase();
  let stem = baseFileName(name, "application-file");
  if (/^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9]|LPT[1-9])$/i.test(stem)) stem = `file-${stem}`;
  return `${stem}${extension ? `.${extension}` : ""}`;
}

async function sha256Blob(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return { name, blob: new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }) };
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function mimeForName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return ({ txt: "text/plain", md: "text/markdown", html: "text/html", json: "application/json", csv: "text/csv", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}
