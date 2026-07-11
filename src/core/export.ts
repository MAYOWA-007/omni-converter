import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js";
import { normalizeArchivePath } from "./archivePaths";
import { validateOutput, validateOutputs, type OutputCandidate, type OutputValidation } from "./outputValidation";
import { MAX_ARCHIVE_ENTRY_COUNT } from "./riskLimits";

export const MAX_IN_MEMORY_BUNDLE_BYTES = 64 * 1024 * 1024;

export interface SaveFileWriter {
  write(data: Blob | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

export interface SaveFileHandle {
  createWritable(): Promise<SaveFileWriter>;
}

export interface SaveDirectoryHandle {
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<SaveDirectoryHandle>;
  getFileHandle(name: string, options: { create: boolean }): Promise<SaveFileHandle>;
}

export interface SavePickerOptions {
  suggestedName: string;
  types: readonly { description: string; accept: Record<string, readonly string[]> }[];
}

export interface DownloadAnchor {
  href: string;
  download: string;
  click(): void;
}

export interface SaveOutputIo {
  showSaveFilePicker?: (options: SavePickerOptions) => Promise<SaveFileHandle>;
  showDirectoryPicker?: () => Promise<SaveDirectoryHandle>;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createAnchor?: () => DownloadAnchor;
  appendAnchor?: (anchor: DownloadAnchor) => void;
  removeAnchor?: (anchor: DownloadAnchor) => void;
}

export interface SaveOutputOptions {
  io?: SaveOutputIo;
}

export interface SaveOutputBundleOptions extends SaveOutputOptions {
  name?: string;
  maxInMemoryBundleBytes?: number;
}

export interface SaveOutputsToFolderOptions extends SaveOutputOptions {}

export interface SaveOutputResult {
  status: "saved" | "cancelled";
  name: string;
  method: "file-system-access" | "download";
}

export type SaveOutputsToFolderResult =
  | { status: "saved"; count: number }
  | { status: "cancelled" }
  | { status: "unsupported" };

export class OutputValidationError extends Error {
  readonly validation: readonly OutputValidation[];

  constructor(validation: readonly OutputValidation[]) {
    super(`Output validation failed: ${validation.flatMap((fact) => fact.errors).join(" ")}`);
    this.name = "OutputValidationError";
    this.validation = validation;
  }
}

export function sanitizeOutputFilename(name: string) {
  try {
    return normalizeBundlePath(name).split("/").at(-1) as string;
  } catch {
    throw new Error(`Output filename is unsafe: ${name}`);
  }
}

export function normalizeBundlePath(path: string) {
  return normalizeArchivePath(path);
}

export async function saveOutput(output: OutputCandidate, options: SaveOutputOptions = {}): Promise<SaveOutputResult> {
  const safeName = sanitizeOutputFilename(output.name);
  const validation = await validateOutput(output);
  assertValid([validation]);
  const io = resolveIo(options.io);
  const selection = await selectSaveHandle(io, safeName, output.blob.type);

  if (selection === "cancelled") return { status: "cancelled", name: safeName, method: "file-system-access" };
  if (selection) {
    const writable = await selection.createWritable();
    try {
      await writable.write(output.blob);
      await writable.close();
    } catch (error) {
      await abortWritable(writable, error);
      throw error;
    }
    return { status: "saved", name: safeName, method: "file-system-access" };
  }

  downloadBlob(output.blob, safeName, io);
  return { status: "saved", name: safeName, method: "download" };
}

export async function saveOutputBundle(outputs: readonly OutputCandidate[], options: SaveOutputBundleOptions = {}): Promise<SaveOutputResult> {
  if (outputs.length === 0) throw new Error("At least one output is required to create a ZIP bundle.");
  if (outputs.length > MAX_ARCHIVE_ENTRY_COUNT) {
    throw new Error(`ZIP bundle exceeds the ${MAX_ARCHIVE_ENTRY_COUNT} entry limit.`);
  }
  const validation = await validateOutputs(outputs);
  assertValid(validation);

  const paths = normalizeUniqueBundlePaths(outputs);
  const name = sanitizeOutputFilename(options.name ?? "omni-converter-output.zip");
  if (!name.toLowerCase().endsWith(".zip")) throw new Error("Bundle filename must use the .zip extension.");
  const io = resolveIo(options.io);
  const selection = await selectSaveHandle(io, name, "application/zip");

  if (selection === "cancelled") return { status: "cancelled", name, method: "file-system-access" };
  if (selection) {
    const writable = await selection.createWritable();
    await streamZipToWritable(outputs, paths, writable);
    return { status: "saved", name, method: "file-system-access" };
  }

  const limit = options.maxInMemoryBundleBytes ?? MAX_IN_MEMORY_BUNDLE_BYTES;
  if (!Number.isFinite(limit) || limit < 1) throw new Error("In-memory bundle limit must be a positive finite number.");
  if (estimateZipUpperBound(outputs, paths) > limit) throw estimatedInMemoryLimitError(limit);

  const bundle = await createZipBlob(outputs, paths);
  if (bundle.size > limit) throw inMemoryLimitError(limit);
  const bundleValidation = await validateOutput({ name, blob: bundle });
  assertValid([bundleValidation]);
  downloadBlob(bundle, name, io);
  return { status: "saved", name, method: "download" };
}

export async function saveOutputsToFolder(outputs: readonly OutputCandidate[], options: SaveOutputsToFolderOptions = {}): Promise<SaveOutputsToFolderResult> {
  if (outputs.length === 0) throw new Error("At least one output is required to save a folder.");
  if (outputs.length > MAX_ARCHIVE_ENTRY_COUNT) throw new Error(`Folder export exceeds the ${MAX_ARCHIVE_ENTRY_COUNT} entry limit.`);
  const validation = await validateOutputs(outputs);
  assertValid(validation);
  const paths = normalizeUniqueBundlePaths(outputs);
  const io = resolveIo(options.io);
  const directory = await selectDirectoryHandle(io);
  if (directory === "cancelled") return { status: "cancelled" };
  if (!directory) return { status: "unsupported" };

  for (let index = 0; index < outputs.length; index += 1) {
    const { parent, name } = await resolveOutputDirectory(directory, paths[index]);
    const file = await parent.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(outputs[index].blob);
      await writable.close();
    } catch (error) {
      await abortWritable(writable, error);
      throw error;
    }
  }

  return { status: "saved", count: outputs.length };
}

function normalizeUniqueBundlePaths(outputs: readonly OutputCandidate[]) {
  const paths: string[] = [];
  const keys = new Set<string>();
  for (const output of outputs) {
    const path = normalizeBundlePath(output.name);
    const key = path.toLowerCase();
    if (keys.has(key)) throw new Error(`ZIP bundle contains a duplicate path after normalization: ${path}`);
    keys.add(key);
    paths.push(path);
  }
  return paths;
}

function estimateZipUpperBound(outputs: readonly OutputCandidate[], paths: readonly string[]) {
  const encoder = new TextEncoder();
  let total = 22;
  for (let index = 0; index < outputs.length; index += 1) {
    const size = outputs[index].blob.size;
    const filenameBytes = encoder.encode(paths[index]).byteLength;
    const deflateBound = size + Math.floor(size / 4_096) + Math.floor(size / 16_384) + Math.floor(size / 33_554_432) + 13;
    // Includes local/central headers, both filename copies, descriptors, timestamp/ZIP64 extra-field headroom, and DEFLATE expansion.
    total += deflateBound + 30 + filenameBytes + 46 + filenameBytes + 24 + 128;
    if (!Number.isSafeInteger(total)) return Number.POSITIVE_INFINITY;
  }
  return total;
}

async function selectSaveHandle(io: SaveOutputIo, name: string, mime: string): Promise<SaveFileHandle | "cancelled" | undefined> {
  if (!io.showSaveFilePicker) return undefined;
  try {
    return await io.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "Converted output", accept: { [mime || "application/octet-stream"]: [extensionPattern(name)] } }]
    });
  } catch (error) {
    if (isUserCancellation(error)) return "cancelled";
    throw error;
  }
}

async function selectDirectoryHandle(io: SaveOutputIo): Promise<SaveDirectoryHandle | "cancelled" | undefined> {
  if (!io.showDirectoryPicker) return undefined;
  try {
    return await io.showDirectoryPicker();
  } catch (error) {
    if (isUserCancellation(error)) return "cancelled";
    throw error;
  }
}

async function resolveOutputDirectory(root: SaveDirectoryHandle, path: string) {
  const segments = path.split("/");
  const name = segments.pop();
  if (!name) throw new Error(`Output path is unsafe: ${path}`);
  let parent = root;
  for (const segment of segments) {
    parent = await parent.getDirectoryHandle(segment, { create: true });
  }
  return { parent, name };
}

async function streamZipToWritable(outputs: readonly OutputCandidate[], paths: readonly string[], writable: SaveFileWriter) {
  const stream = new WritableStream<Uint8Array>({
    write: (chunk) => writable.write(chunk),
    close: () => writable.close(),
    abort: (reason) => writable.abort?.(reason)
  });
  const zipWriter = new ZipWriter(stream, { level: 9 });
  try {
    for (let index = 0; index < outputs.length; index += 1) {
      await zipWriter.add(paths[index], new BlobReader(outputs[index].blob));
    }
    await zipWriter.close();
  } catch (error) {
    await abortWritable(writable, error);
    throw error;
  }
}

async function abortWritable(writable: SaveFileWriter, reason: unknown) {
  try {
    await writable.abort?.(reason);
  } catch {
    // Cleanup must not replace the original write or close failure.
  }
}

async function createZipBlob(outputs: readonly OutputCandidate[], paths: readonly string[]) {
  const writer = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(writer, { level: 9 });
  for (let index = 0; index < outputs.length; index += 1) {
    await zipWriter.add(paths[index], new BlobReader(outputs[index].blob));
  }
  return zipWriter.close();
}

function downloadBlob(blob: Blob, name: string, io: SaveOutputIo) {
  if (!io.createObjectURL || !io.revokeObjectURL || !io.createAnchor || !io.appendAnchor || !io.removeAnchor) {
    throw new Error("No supported output save method is available.");
  }
  const url = io.createObjectURL(blob);
  const anchor = io.createAnchor();
  try {
    anchor.href = url;
    anchor.download = name;
    io.appendAnchor(anchor);
    anchor.click();
  } finally {
    io.removeAnchor(anchor);
    io.revokeObjectURL(url);
  }
}

function assertValid(validation: readonly OutputValidation[]) {
  if (validation.some((fact) => !fact.valid)) throw new OutputValidationError(validation);
}

function resolveIo(overrides: SaveOutputIo = {}): SaveOutputIo {
  const global = globalThis as typeof globalThis & { showSaveFilePicker?: SaveOutputIo["showSaveFilePicker"]; showDirectoryPicker?: SaveOutputIo["showDirectoryPicker"] };
  const document = globalThis.document;
  return {
    showSaveFilePicker: overrides.showSaveFilePicker ?? global.showSaveFilePicker,
    showDirectoryPicker: overrides.showDirectoryPicker ?? global.showDirectoryPicker,
    createObjectURL: overrides.createObjectURL ?? globalThis.URL?.createObjectURL?.bind(globalThis.URL),
    revokeObjectURL: overrides.revokeObjectURL ?? globalThis.URL?.revokeObjectURL?.bind(globalThis.URL),
    createAnchor: overrides.createAnchor ?? (document ? () => document.createElement("a") : undefined),
    appendAnchor: overrides.appendAnchor ?? (document ? (anchor) => document.body.appendChild(anchor as HTMLAnchorElement) : undefined),
    removeAnchor: overrides.removeAnchor ?? ((anchor) => (anchor as HTMLAnchorElement).remove())
  };
}

function extensionPattern(name: string) {
  const extension = name.split(".").at(-1);
  return extension ? `.${extension.toLowerCase()}` : ".*";
}

function isUserCancellation(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : Boolean(error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError");
}

function inMemoryLimitError(limit: number) {
  return new Error(`Bundle exceeds the ${limit}-byte in-memory bundle limit; use the desktop app or File System Access for large bundles.`);
}

function estimatedInMemoryLimitError(limit: number) {
  return new Error(`Estimated ZIP size exceeds the ${limit}-byte in-memory bundle limit; use the desktop app or File System Access for large bundles.`);
}
