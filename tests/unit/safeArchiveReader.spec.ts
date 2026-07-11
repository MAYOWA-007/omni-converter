import { expect, test } from "playwright/test";
import { strToU8, zipSync } from "fflate";
import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { withSafeZip } from "../../src/lib/safeArchiveReader";

function zipFile(entries: Record<string, Uint8Array>) {
  return new File([zipSync(entries, { level: 6 })], "fixture.zip", { type: "application/zip" });
}

test("reads normalized ZIP entries through bounded text and blob methods", async () => {
  const result = await withSafeZip(zipFile({ "docs/readme.txt": strToU8("hello"), "media/pixel.bin": new Uint8Array([1, 2, 3]) }), async (archive) => {
    expect(archive.entries.map((entry) => entry.name)).toEqual(["docs/readme.txt", "media/pixel.bin"]);
    expect(await archive.require("docs/readme.txt").text()).toBe("hello");
    expect([...new Uint8Array(await (await archive.require("media/pixel.bin").blob()).arrayBuffer())]).toEqual([1, 2, 3]);
    return archive.entries.length;
  });
  expect(result).toBe(2);
});

test("rejects traversal, normalized collisions, and extreme expansion before extraction", async () => {
  await expect(withSafeZip(zipFile({ "../escape.txt": strToU8("x") }), () => undefined)).rejects.toThrow(/unsafe|parent/i);
  await expect(withSafeZip(zipFile({ "Folder/file.txt": strToU8("a"), "folder/FILE.txt": strToU8("b") }), () => undefined)).rejects.toThrow(/duplicate/i);
  await expect(withSafeZip(zipFile({ "bomb.bin": new Uint8Array(1024 * 1024) }), () => undefined)).rejects.toThrow(/expansion ratio/i);
});

test("rejects encrypted ZIP entries before requesting a password", async () => {
  const writer = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(writer, { password: "secret" });
  await zipWriter.add("private.txt", new TextReader("classified"));
  const encrypted = await zipWriter.close();
  await expect(withSafeZip(new File([encrypted], "encrypted.zip", { type: "application/zip" }), () => undefined)).rejects.toThrow(/encrypted/i);
});

test("enforces per-entry read limits even inside an otherwise acceptable archive", async () => {
  const file = zipFile({ "large.txt": strToU8("0123456789") });
  await expect(withSafeZip(file, async (archive) => archive.require("large.txt").text(5))).rejects.toThrow(/read limit/i);
});
