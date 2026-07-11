import { expect, test } from "playwright/test";
import { BlobReader, ZipReader } from "@zip.js/zip.js";
import {
  MAX_IN_MEMORY_BUNDLE_BYTES,
  normalizeBundlePath,
  sanitizeOutputFilename,
  saveOutput,
  saveOutputBundle
} from "../../src/core/export";
import { saveOutput as saveOutputFromConversions, saveOutputBundle as saveOutputBundleFromConversions } from "../../src/lib/conversions";
import { validateOutput } from "../../src/core/outputValidation";
import { MAX_ARCHIVE_ENTRY_COUNT } from "../../src/core/riskLimits";
import * as exportApi from "../../src/core/export";

function setUint32BE(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer).setUint32(offset, value);
}

function pngOutput(name = "image.png") {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  setUint32BE(bytes, 8, 13);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  setUint32BE(bytes, 16, 1);
  setUint32BE(bytes, 20, 1);
  bytes.set([8, 2, 0, 0, 0], 24);
  bytes.set(new TextEncoder().encode("IEND"), 37);
  bytes.set([0xae, 0x42, 0x60, 0x82], 41);
  return { name, blob: new Blob([bytes], { type: "image/png" }) };
}

function fallbackIo(onBlob?: (blob: Blob) => void) {
  const calls: string[] = [];
  const anchor = { href: "", download: "", click: () => calls.push("click") };
  return {
    calls,
    anchor,
    io: {
      createObjectURL: (blob: Blob) => {
        onBlob?.(blob);
        calls.push("url");
        return "blob:result";
      },
      revokeObjectURL: (url: string) => calls.push(`revoke:${url}`),
      createAnchor: () => anchor,
      appendAnchor: () => calls.push("append"),
      removeAnchor: () => calls.push("remove")
    }
  };
}

test("exposes explicit save APIs through the conversion facade", () => {
  expect(saveOutputFromConversions).toBe(saveOutput);
  expect(saveOutputBundleFromConversions).toBe(saveOutputBundle);
});

test("validates output before a single sanitized fallback download and revokes its URL", async () => {
  const fallback = fallbackIo();
  const result = await saveOutput(pngOutput("result.png"), { io: fallback.io });

  expect(result).toEqual({ status: "saved", name: "result.png", method: "download" });
  expect(fallback.anchor).toMatchObject({ href: "blob:result", download: "result.png" });
  expect(fallback.calls).toEqual(["url", "append", "click", "remove", "revoke:blob:result"]);
});

test("rejects unsafe individual filenames", () => {
  const unsafe = [
    "../secret.png", "./image.png", "/root.png", "C:relative.png", "C:\\absolute.png", "\\\\server\\share.png",
    "bad:name.png", "bad\u0001name.png", "bad\u0085name.png", "trailing .png ", "CON.png", "CONIN$.txt", "nul.txt"
  ];
  for (const name of unsafe) expect(() => sanitizeOutputFilename(name)).toThrow();
  expect(sanitizeOutputFilename("Result 01.png")).toBe("Result 01.png");
  expect(sanitizeOutputFilename("folder/nested/Result 01.png")).toBe("Result 01.png");
  expect(sanitizeOutputFilename("folder\\nested\\Result 01.png")).toBe("Result 01.png");
});

test("normalizes safe nested bundle paths and rejects unsafe segments", () => {
  expect(normalizeBundlePath("folder\\nested\\result.png")).toBe("folder/nested/result.png");
  expect(normalizeBundlePath("Folder/Result 01.png")).toBe("Folder/Result 01.png");

  const unsafe = [
    "", "./file.txt", "a/./file.txt", "../file.txt", "a/../file.txt", "/file.txt", "C:file.txt", "C:/file.txt",
    "\\\\server\\file.txt", "a//file.txt", "a/bad:name.txt", "a/bad\u0000name.txt", "a/trailing. ", "a/COM1.log"
  ];
  for (const name of unsafe) expect(() => normalizeBundlePath(name)).toThrow();
});

test("does not begin export for invalid output or unsafe output name", async () => {
  let createdUrl = false;
  const io = { createObjectURL: () => { createdUrl = true; return "blob:unexpected"; } };

  await expect(saveOutput({ name: "broken.pdf", blob: new Blob(["%PDF-1.7"]) }, { io })).rejects.toThrow("Output validation failed");
  await expect(saveOutput(pngOutput("../unsafe.png"), { io })).rejects.toThrow(/filename/i);
  expect(createdUrl).toBe(false);
});

test("reports picker selection cancellation without falling back", async () => {
  let createdUrl = false;
  const result = await saveOutput(pngOutput(), {
    io: {
      showSaveFilePicker: async () => { throw new DOMException("cancelled", "AbortError"); },
      createObjectURL: () => { createdUrl = true; return "blob:unexpected"; }
    }
  });

  expect(result).toEqual({ status: "cancelled", name: "image.png", method: "file-system-access" });
  expect(createdUrl).toBe(false);
});

test("propagates createWritable errors and aborts failed single-output writes without masking the original error", async () => {
  const abort = () => new DOMException("write aborted", "AbortError");
  const createWritable = saveOutput(pngOutput(), {
    io: { showSaveFilePicker: async () => ({ createWritable: async () => { throw abort(); } }) }
  });
  const writeFailure = new Error("write failed");
  const closeFailure = new Error("close failed");
  const writeCleanup: unknown[] = [];
  const closeCleanup: unknown[] = [];
  const write = saveOutput(pngOutput(), {
    io: { showSaveFilePicker: async () => ({ createWritable: async () => ({
      write: async () => { throw writeFailure; },
      close: async () => {},
      abort: async (reason) => { writeCleanup.push(reason); throw new Error("cleanup failed"); }
    }) }) }
  });
  const close = saveOutput(pngOutput(), {
    io: { showSaveFilePicker: async () => ({ createWritable: async () => ({
      write: async () => {},
      close: async () => { throw closeFailure; },
      abort: async (reason) => { closeCleanup.push(reason); }
    }) }) }
  });

  await expect(createWritable).rejects.toThrow("write aborted");
  await expect(write).rejects.toBe(writeFailure);
  await expect(close).rejects.toBe(closeFailure);
  expect(writeCleanup).toEqual([writeFailure]);
  expect(closeCleanup).toEqual([closeFailure]);
});

test("streams a bundle directly to a File System Access writable", async () => {
  const chunks: Uint8Array[] = [];
  let closes = 0;
  const result = await saveOutputBundle([
    pngOutput("images/first.png"),
    { name: "notes/readme.txt", blob: new Blob(["ready"], { type: "text/plain" }) }
  ], {
    name: "bundle.zip",
    io: {
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async (data) => {
            expect(data).toBeInstanceOf(Uint8Array);
            chunks.push((data as Uint8Array).slice());
          },
          close: async () => { closes += 1; }
        })
      })
    }
  });

  expect(result).toEqual({ status: "saved", name: "bundle.zip", method: "file-system-access" });
  expect(chunks.length).toBeGreaterThan(0);
  expect(closes).toBe(1);
  const streamed = new Blob(chunks, { type: "application/zip" });
  await expect(validateOutput({ name: "bundle.zip", blob: streamed })).resolves.toMatchObject({ valid: true });
});

test("uses async ZipWriter fallback, validates the ZIP, and preserves safe nested paths", async () => {
  let downloaded: Blob | undefined;
  const fallback = fallbackIo((blob) => { downloaded = blob; });
  const result = await saveOutputBundle([
    pngOutput("images\\first.png"),
    { name: "notes/readme.txt", blob: new Blob(["ready"], { type: "text/plain" }) }
  ], { name: "bundle.zip", io: fallback.io });

  expect(result).toEqual({ status: "saved", name: "bundle.zip", method: "download" });
  await expect(validateOutput({ name: "bundle.zip", blob: downloaded as Blob })).resolves.toMatchObject({ valid: true });

  const reader = new ZipReader(new BlobReader(downloaded as Blob));
  try {
    const entries = await reader.getEntries();
    expect(entries.map((entry) => entry.filename)).toEqual(["images/first.png", "notes/readme.txt"]);
  } finally {
    await reader.close();
  }
});

test("rejects fallback bundles above the explicit in-memory threshold before creating a URL", async () => {
  let createdUrl = false;
  await expect(saveOutputBundle([pngOutput()], {
    maxInMemoryBundleBytes: 10,
    io: { createObjectURL: () => { createdUrl = true; return "blob:unexpected"; } }
  })).rejects.toThrow(/in-memory bundle limit.*desktop/i);
  expect(createdUrl).toBe(false);
  expect(MAX_IN_MEMORY_BUNDLE_BYTES).toBeGreaterThan(0);
});

test("rejects bundle entry counts above the validator limit before picker or fallback work", async () => {
  const empty = new Blob([], { type: "text/plain" });
  const outputs = Array.from({ length: MAX_ARCHIVE_ENTRY_COUNT + 1 }, (_, index) => ({ name: `${index}.txt`, blob: empty }));
  let pickerCalled = false;
  let urlCreated = false;

  await expect(saveOutputBundle(outputs, {
    io: { showSaveFilePicker: async () => { pickerCalled = true; throw new Error("unexpected picker"); } }
  })).rejects.toThrow(`${MAX_ARCHIVE_ENTRY_COUNT} entry limit`);
  await expect(saveOutputBundle(outputs, {
    io: { createObjectURL: () => { urlCreated = true; return "blob:unexpected"; } }
  })).rejects.toThrow(`${MAX_ARCHIVE_ENTRY_COUNT} entry limit`);

  expect(pickerCalled).toBe(false);
  expect(urlCreated).toBe(false);
});

test("preflights fallback ZIP overhead for many tiny long-name entries", async () => {
  const outputs = Array.from({ length: 40 }, (_, index) => ({
    name: `${index.toString().padStart(3, "0")}-${"long-name-".repeat(16)}.txt`,
    blob: new Blob(["x"], { type: "text/plain" })
  }));
  const sourceBytes = outputs.reduce((total, item) => total + item.blob.size, 0);
  const maxInMemoryBundleBytes = 8_000;
  let urlCreated = false;

  expect(sourceBytes).toBeLessThan(maxInMemoryBundleBytes);
  await expect(saveOutputBundle(outputs, {
    maxInMemoryBundleBytes,
    io: { createObjectURL: () => { urlCreated = true; return "blob:unexpected"; } }
  })).rejects.toThrow(/estimated ZIP.*in-memory bundle limit/i);
  expect(urlCreated).toBe(false);
});

test("rejects post-normalization duplicate bundle paths", async () => {
  const outputs = [
    { name: "Folder\\same.txt", blob: new Blob(["one"], { type: "text/plain" }) },
    { name: "folder/same.txt", blob: new Blob(["two"], { type: "text/plain" }) }
  ];
  await expect(saveOutputBundle(outputs, { io: fallbackIo().io })).rejects.toThrow(/duplicate/i);
});

test("saves validated nested outputs through an injected directory picker", async () => {
  const saveOutputsToFolder = (exportApi as unknown as { saveOutputsToFolder?: (outputs: readonly { name: string; blob: Blob }[], options: { io: object }) => Promise<unknown> }).saveOutputsToFolder;
  expect(saveOutputsToFolder).toBeDefined();

  const directories: string[] = [];
  const writes: Blob[] = [];
  const directory = (prefix = ""): object => ({
    getDirectoryHandle: async (name: string) => { directories.push(`${prefix}${name}`); return directory(`${prefix}${name}/`); },
    getFileHandle: async () => ({ createWritable: async () => ({ write: async (blob: Blob) => { writes.push(blob); }, close: async () => {}, abort: async () => {} }) })
  });
  const result = await saveOutputsToFolder?.([pngOutput("images/first.png"), { name: "notes/readme.txt", blob: new Blob(["ready"], { type: "text/plain" }) }], {
    io: { showDirectoryPicker: async () => directory() }
  });

  expect(result).toEqual({ status: "saved", count: 2 });
  expect(directories).toEqual(["images", "notes"]);
  expect(writes).toHaveLength(2);
});

test("folder export rejects traversal before opening a directory", async () => {
  const saveOutputsToFolder = (exportApi as unknown as { saveOutputsToFolder: (outputs: readonly { name: string; blob: Blob }[], options: { io: object }) => Promise<unknown> }).saveOutputsToFolder;
  let opened = false;
  await expect(saveOutputsToFolder([pngOutput("../unsafe.png")], { io: { showDirectoryPicker: async () => { opened = true; return {}; } } })).rejects.toThrow(/unsafe|path/i);
  expect(opened).toBe(false);
});

test("folder export distinguishes cancellation and unsupported environments", async () => {
  const saveOutputsToFolder = (exportApi as unknown as { saveOutputsToFolder: (outputs: readonly { name: string; blob: Blob }[], options?: { io?: object }) => Promise<unknown> }).saveOutputsToFolder;
  await expect(saveOutputsToFolder([pngOutput()], { io: { showDirectoryPicker: async () => { throw new DOMException("cancelled", "AbortError"); } } })).resolves.toEqual({ status: "cancelled" });
  await expect(saveOutputsToFolder([pngOutput()], { io: {} })).resolves.toEqual({ status: "unsupported" });
});

test("folder export aborts a failed writable without masking the write failure", async () => {
  const saveOutputsToFolder = (exportApi as unknown as { saveOutputsToFolder: (outputs: readonly { name: string; blob: Blob }[], options: { io: object }) => Promise<unknown> }).saveOutputsToFolder;
  const failure = new Error("folder write failed");
  const cleanup: unknown[] = [];
  await expect(saveOutputsToFolder([pngOutput()], {
    io: { showDirectoryPicker: async () => ({ getFileHandle: async () => ({ createWritable: async () => ({ write: async () => { throw failure; }, close: async () => {}, abort: async (reason: unknown) => { cleanup.push(reason); } }) }) }) }
  })).rejects.toBe(failure);
  expect(cleanup).toEqual([failure]);
});
