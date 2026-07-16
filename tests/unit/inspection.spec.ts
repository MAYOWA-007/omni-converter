import { expect, test } from "playwright/test";
import { zipSync } from "fflate";
import { FORMAT_REGISTRY } from "../../src/core/formats";
import { inspectFileHeader } from "../../src/core/inspection";
import {
  MAX_ARCHIVE_ENTRY_COUNT,
  MAX_ARCHIVE_EXPANSION_RATIO,
  MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES,
  evaluateInputRisk
} from "../../src/core/riskLimits";
import { inspectFile } from "../../src/lib/fileInspection";

function fileFromBytes(name: string, bytes: number[], type = "application/octet-stream") {
  return new File([new Uint8Array(bytes)], name, { type });
}

function zipFile(name: string, entries: Record<string, Uint8Array>) {
  return new File([zipSync(entries)], name, { type: "application/zip" });
}

test("the registry defines every required exact format", () => {
  expect(Object.keys(FORMAT_REGISTRY)).toEqual(expect.arrayContaining([
    "png", "jpeg", "gif", "webp", "pdf", "zip", "docx", "xlsx", "pptx", "epub", "exe", "unknown"
  ]));
});

test("recognizes required bounded signatures before MIME or extension", async () => {
  const cases = [
    ["image.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png"],
    ["image.jpg", [0xff, 0xd8, 0xff, 0xe0], "jpeg"],
    ["image.gif", [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], "gif"],
    ["image.gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "gif"],
    ["image.webp", [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], "webp"],
    ["document.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d], "pdf"],
    ["archive.zip", [0x50, 0x4b, 0x03, 0x04], "zip"],
    ["program.exe", [0x4d, 0x5a], "exe"]
  ] as const;

  for (const [name, bytes, expectedId] of cases) {
    const detected = await inspectFileHeader(fileFromBytes(name, [...bytes], "text/plain"));
    expect(detected.format.id).toBe(expectedId);
  }
});

test("lazily recognizes broad signatures that are outside first-party checks", async () => {
  const wav = fileFromBytes("recording.bin", [
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
    0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
    0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
    0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
    0x00, 0x00, 0x00, 0x00
  ], "application/octet-stream");

  const detected = await inspectFileHeader(wav);

  expect(detected.format.id).toBe("wav");
  expect(detected.source).toBe("signature");
});

test("uses byte signatures ahead of conflicting MIME and extension facts", async () => {
  const inspection = await inspectFile(fileFromBytes(
    "definitely-a-picture.png",
    [0x25, 0x50, 0x44, 0x46, 0x2d],
    "image/png"
  ));

  expect(inspection).toMatchObject({ family: "pdf", exactFormat: "pdf", signatureSource: "signature" });
});

test("uses MIME ahead of extension when bytes have no known signature", async () => {
  const inspection = await inspectFile(fileFromBytes("misnamed.png", [0x68, 0x65, 0x6c, 0x6c, 0x6f], "font/woff2"));

  expect(inspection).toMatchObject({ family: "font", exactFormat: "woff2", signatureSource: "mime" });
});

test("falls back to normalized extension when bytes and MIME are unknown", async () => {
  const inspection = await inspectFile(fileFromBytes("scene.GLB", [0x68, 0x65, 0x6c, 0x6c, 0x6f], ""));

  expect(inspection).toMatchObject({ family: "model3d", exactFormat: "glb", signatureSource: "extension" });
});

test("uses valid ZIP entry names to distinguish OOXML containers without extraction", async () => {
  const cases = [
    ["report.zip", "word/document.xml", "docx"],
    ["report.zip", "xl/workbook.xml", "xlsx"],
    ["report.zip", "ppt/presentation.xml", "pptx"],
    ["book.zip", "META-INF/container.xml", "epub"]
  ] as const;

  for (const [name, entryName, expectedId] of cases) {
    const detected = await inspectFileHeader(zipFile(name, {
      "[Content_Types].xml": new Uint8Array(),
      ...(expectedId === "epub" ? { mimetype: new Uint8Array() } : {}),
      [entryName]: new Uint8Array()
    }));
    expect(detected.format.id).toBe(expectedId);
  }
});

test("blocks a ZIP whose metadata cannot be inspected", async () => {
  const detected = await inspectFileHeader(fileFromBytes("truncated.zip", [0x50, 0x4b, 0x03, 0x04]));

  expect(detected.format.id).toBe("zip");
  expect(detected.risk).toEqual({
    blocked: true,
    reasons: ["ZIP metadata could not be inspected."]
  });
});

test("reports extension mismatches and preserves compatible FileInspection fields", async () => {
  const inspection = await inspectFile(fileFromBytes("invoice.png", [0x25, 0x50, 0x44, 0x46, 0x2d], "image/png"));

  expect(inspection).toMatchObject({
    name: "invoice.png",
    extension: "png",
    mime: "image/png",
    size: 5,
    family: "pdf",
    exactFormat: "pdf"
  });
  expect(inspection.notes).toContain("File extension .png does not match detected PDF content.");
});

test("preserves extension mismatch notes when image metadata is added", async () => {
  const originalImage = globalThis.Image;
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      naturalWidth = 32;
      naturalHeight = 16;
      src = "";

      decode() {
        return Promise.resolve();
      }
    }
  });

  try {
    const inspection = await inspectFile(fileFromBytes("invoice.pdf", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"));

    expect(inspection.notes).toEqual(expect.arrayContaining([
      "File extension .pdf does not match detected PNG content.",
      "Image dimensions detected: 32 x 16."
    ]));
  } finally {
    Object.defineProperty(globalThis, "Image", { configurable: true, value: originalImage });
  }
});

test("blocks unsafe archive paths", () => {
  const unsafePaths = [
    "../private.txt", "/private.txt", "C:\\private.txt", "C:relative.txt", "./current.txt",
    "folder//empty.txt", "folder/bad:name.txt", "folder/bad\u0085name.txt", "folder/CON.txt", "folder/CONOUT$.txt", "folder/trailing."
  ];
  for (const name of unsafePaths) {
    expect(evaluateInputRisk({ archiveEntries: [{ name, compressedSize: 1, uncompressedSize: 1 }] }).blocked).toBe(true);
  }
});

test("blocks archive paths and normalized duplicates during ZIP input inspection", async () => {
  for (const name of ["C:escape.txt", "./current.txt", "folder//empty.txt"]) {
    const unsafe = await inspectFileHeader(zipFile("unsafe.zip", { [name]: new Uint8Array([1]) }));
    expect(unsafe.risk.blocked).toBe(true);
    expect(unsafe.risk.reasons.join(" ")).toMatch(/unsafe path/i);
  }
  const duplicates = await inspectFileHeader(zipFile("duplicates.zip", {
    "Folder/same.txt": new Uint8Array([1]),
    "folder/same.txt": new Uint8Array([2])
  }));

  expect(duplicates.risk.blocked).toBe(true);
  expect(duplicates.risk.reasons.join(" ")).toMatch(/duplicate/i);
});

test("allows archive facts exactly at configured limits", () => {
  const result = evaluateInputRisk({
    archiveEntries: [{
      name: "safe/file.txt",
      compressedSize: 1,
      uncompressedSize: MAX_ARCHIVE_EXPANSION_RATIO
    }],
    entryCount: MAX_ARCHIVE_ENTRY_COUNT,
    totalUncompressedBytes: MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES
  });

  expect(result.blocked).toBe(false);
});

test("blocks archive facts beyond every configured limit", () => {
  const entryLimit = evaluateInputRisk({ entryCount: MAX_ARCHIVE_ENTRY_COUNT + 1 });
  const byteLimit = evaluateInputRisk({ totalUncompressedBytes: MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES + 1 });
  const ratioLimit = evaluateInputRisk({ archiveEntries: [{ name: "safe/file.txt", compressedSize: 1, uncompressedSize: MAX_ARCHIVE_EXPANSION_RATIO + 1 }] });

  expect(entryLimit.blocked).toBe(true);
  expect(byteLimit.blocked).toBe(true);
  expect(ratioLimit.blocked).toBe(true);
});
