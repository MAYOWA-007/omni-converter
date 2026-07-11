import type { ConversionSettings } from "./types";
import { archivePathKey, normalizeArchivePath } from "../core/archivePaths";

export interface ConversionOutput {
  name: string;
  blob: Blob;
}

type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export async function zipOutputs(name: string, outputs: ConversionOutput[], level: ZipLevel = 9): Promise<ConversionOutput> {
  const paths = new Set<string>();
  const entries = outputs.map((output) => {
    const path = normalizeArchivePath(output.name);
    const key = archivePathKey(path);
    if (paths.has(key)) throw new Error(`Archive contains a duplicate output path: ${path}`);
    paths.add(key);
    return { path, blob: output.blob };
  });
  const { BlobReader, BlobWriter, ZipWriter } = await import("@zip.js/zip.js");
  const blobWriter = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(blobWriter, {
    level,
    useWebWorkers: level > 0,
    bufferedWrite: false,
    keepOrder: true
  });
  try {
    for (const entry of entries) {
      await zipWriter.add(entry.path, new BlobReader(entry.blob), { level, useWebWorkers: level > 0 });
    }
    return { name, blob: await zipWriter.close() };
  } catch (error) {
    try {
      await zipWriter.close();
    } catch {
      // Preserve the conversion error while allowing zip.js to release any worker state it can.
    }
    throw error;
  }
}

export function qualityFromCompression(value?: string) {
  if (!value) return 0.9;
  if (/lossless|maximum/i.test(value)) return 0.98;
  if (/high/i.test(value)) return 0.92;
  if (/small/i.test(value)) return 0.72;
  if (/tiny/i.test(value)) return 0.56;
  return 0.86;
}

export function crfFromCompression(value?: string) {
  if (!value) return "23";
  if (/lossless/i.test(value)) return "0";
  if (/maximum/i.test(value)) return "16";
  if (/high/i.test(value)) return "20";
  if (/small/i.test(value)) return "30";
  if (/tiny/i.test(value)) return "36";
  return "24";
}

export function audioBitrateFromCompression(value?: string) {
  if (!value) return "192k";
  if (/lossless|maximum/i.test(value)) return "320k";
  if (/high/i.test(value)) return "256k";
  if (/small/i.test(value)) return "128k";
  if (/tiny/i.test(value)) return "80k";
  return "192k";
}

export function zipLevelFromCompression(value?: string): ZipLevel {
  if (!value) return 9;
  if (/store|none|uncompressed/i.test(value)) return 0;
  if (/balanced/i.test(value)) return 6;
  return 9;
}

export function baseFileName(name: string, fallback = "converted") {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || fallback;
}

export function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error(`${type.replace("image/", "").toUpperCase()} export is not supported by this browser.`));
      },
      type,
      quality
    );
  });
}

export async function loadImage(file: File | Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderImage(file: File | Blob, options: RenderOptions = {}) {
  const image = await loadImage(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height);
  const targetWidth = Math.max(1, Math.round(options.width ?? sourceWidth));
  const targetHeight = Math.max(1, Math.round(options.height ?? (targetWidth / sourceWidth) * sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { alpha: !options.background });
  if (!context) throw new Error("Canvas is not available in this browser.");

  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  const fitted = options.fit === "cover" ? coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) : fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
  return canvas;
}

export function fitRect(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (maxWidth - width) / 2, y: (maxHeight - height) / 2, width, height };
}

export function coverRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

export function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseDelimited(text: string, delimiter = ",") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

export function rowsToObjects(rows: unknown[][]) {
  const [headers = [], ...body] = rows;
  const keys = headers.map((header, index) => String(header || `column_${index + 1}`).trim() || `column_${index + 1}`);
  return body.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])));
}

export function rowsToCsv(rows: unknown[][], delimiter = ",") {
  return rows.map((row) => row.map(csvEscape).join(delimiter)).join("\n");
}

export function rowsToMarkdown(rows: unknown[][]) {
  if (!rows.length) return "";
  const header = rows[0].map((cell) => String(cell ?? ""));
  const body = rows.slice(1);
  return [
    `| ${header.map(escapeTableCell).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${header.map((_, index) => escapeTableCell(row[index])).join(" | ")} |`)
  ].join("\n");
}

export function stringifyYaml(value: unknown, indent = 0): string {
  const space = " ".repeat(indent);
  if (Array.isArray(value)) {
    return value.map((item) => `${space}- ${isScalar(item) ? scalarYaml(item) : `\n${stringifyYaml(item, indent + 2)}`}`).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${space}${key}: ${isScalar(item) ? scalarYaml(item) : `\n${stringifyYaml(item, indent + 2)}`}`)
      .join("\n");
  }
  return `${space}${scalarYaml(value)}`;
}

export function settingsValue(settings: ConversionSettings, key: keyof ConversionSettings, fallback = "") {
  return settings[key] ?? fallback;
}

function isScalar(value: unknown) {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function scalarYaml(value: unknown) {
  if (value == null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value);
  return /^[a-z0-9_ ./:-]+$/i.test(text) ? text : JSON.stringify(text);
}

function escapeTableCell(value: unknown) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

export interface RenderOptions {
  width?: number;
  height?: number;
  fit?: "contain" | "cover";
  background?: string;
}
