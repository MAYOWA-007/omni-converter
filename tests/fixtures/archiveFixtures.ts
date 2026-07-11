import { strToU8, zipSync } from "fflate";

const PNG = Uint8Array.from(base64Bytes("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="));

export function createMixedZipBytes() {
  return zipSync({
    "top.txt": strToU8("top level file"),
    "docs/report.txt": strToU8("Quarterly report\nRevenue: 42\n"),
    "media/photo.png": PNG,
    "media/clip.mp4": strToU8("fixture media bytes"),
    "__MACOSX/._report": strToU8("junk"),
    ".DS_Store": strToU8("junk"),
    "_omni/repack-manifest.json": strToU8('{"source":"original"}')
  }, { level: 6 });
}

export function createCompressibleExeBytes() {
  const bytes = new Uint8Array(64 * 1024);
  bytes[0] = 0x4d;
  bytes[1] = 0x5a;
  bytes[2] = 0x40;
  bytes[4] = 0x01;
  for (let index = 64; index < bytes.length; index += 64) bytes[index] = index % 251;
  return bytes;
}

function base64Bytes(value: string) {
  if (typeof atob === "function") return Array.from(atob(value), (character) => character.charCodeAt(0));
  return [...Buffer.from(value, "base64")];
}
