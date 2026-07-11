import { expect, test } from "playwright/test";
import { zipSync } from "fflate";
import {
  MAX_JSON_VALIDATION_BYTES,
  MAX_XML_VALIDATION_BYTES,
  validateOutput,
  validateOutputs
} from "../../src/core/outputValidation";

const encoder = new TextEncoder();

function output(name: string, bytes: number[] | Uint8Array | string, type = "application/octet-stream") {
  return { name, blob: new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], { type }) };
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  bytes.set(encoder.encode(value), offset);
}

function setUint16LE(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer).setUint16(offset, value, true);
}

function setUint16BE(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer).setUint16(offset, value);
}

function setUint32LE(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer).setUint32(offset, value, true);
}

function setUint32BE(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer).setUint32(offset, value);
}

function minimalPng() {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  setUint32BE(bytes, 8, 13);
  writeAscii(bytes, 12, "IHDR");
  setUint32BE(bytes, 16, 1);
  setUint32BE(bytes, 20, 1);
  bytes.set([8, 2, 0, 0, 0], 24);
  setUint32BE(bytes, 33, 0);
  writeAscii(bytes, 37, "IEND");
  bytes.set([0xae, 0x42, 0x60, 0x82], 41);
  return bytes;
}

function minimalJpeg() {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0,
    0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0,
    0,
    0xff, 0xd9
  ]);
}

function jpegWithExif(payloadSize = 6_000) {
  const appLength = payloadSize + 2;
  const bytes = new Uint8Array(2 + 2 + appLength + 13 + 10 + 1 + 2);
  let offset = 0;
  bytes.set([0xff, 0xd8, 0xff, 0xe1], offset);
  offset += 4;
  setUint16BE(bytes, offset, appLength);
  offset += appLength;
  bytes.set([0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0], offset);
  offset += 13;
  bytes.set([0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0], offset);
  offset += 10;
  bytes[offset++] = 0;
  bytes.set([0xff, 0xd9], offset);
  return bytes;
}

function minimalGif() {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b]);
}

function minimalWebp() {
  const bytes = new Uint8Array(26);
  writeAscii(bytes, 0, "RIFF");
  setUint32LE(bytes, 4, 18);
  writeAscii(bytes, 8, "WEBP");
  writeAscii(bytes, 12, "VP8L");
  setUint32LE(bytes, 16, 5);
  bytes[20] = 0x2f;
  return bytes;
}

function minimalBmp() {
  const bytes = new Uint8Array(58);
  writeAscii(bytes, 0, "BM");
  setUint32LE(bytes, 2, bytes.length);
  setUint32LE(bytes, 10, 54);
  setUint32LE(bytes, 14, 40);
  setUint32LE(bytes, 18, 1);
  setUint32LE(bytes, 22, 1);
  setUint16LE(bytes, 26, 1);
  setUint16LE(bytes, 28, 24);
  setUint32LE(bytes, 34, 4);
  return bytes;
}

function minimalIco() {
  const bytes = new Uint8Array(26);
  setUint16LE(bytes, 2, 1);
  setUint16LE(bytes, 4, 1);
  bytes[6] = 1;
  bytes[7] = 1;
  setUint16LE(bytes, 10, 1);
  setUint16LE(bytes, 12, 32);
  setUint32LE(bytes, 14, 4);
  setUint32LE(bytes, 18, 22);
  bytes.set([1, 2, 3, 4], 22);
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]) {
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function isoBox(type: string, payload = new Uint8Array()) {
  const bytes = new Uint8Array(8 + payload.length);
  setUint32BE(bytes, 0, bytes.length);
  writeAscii(bytes, 4, type);
  bytes.set(payload, 8);
  return bytes;
}

function isoExtendedBox(type: string, payload = new Uint8Array()) {
  const bytes = new Uint8Array(16 + payload.length);
  setUint32BE(bytes, 0, 1);
  writeAscii(bytes, 4, type);
  new DataView(bytes.buffer).setBigUint64(8, BigInt(bytes.length));
  bytes.set(payload, 16);
  return bytes;
}

function isoBaseMedia(brand: string, boxes: readonly string[], compatibleBrands: readonly string[] = [brand]) {
  const ftypPayload = new Uint8Array(8 + compatibleBrands.length * 4);
  writeAscii(ftypPayload, 0, brand);
  for (let index = 0; index < compatibleBrands.length; index += 1) {
    writeAscii(ftypPayload, 8 + index * 4, compatibleBrands[index]);
  }
  return concatBytes(isoBox("ftyp", ftypPayload), ...boxes.map((type) => isoBox(type)));
}

function minimalRar4() {
  const bytes = new Uint8Array(20);
  bytes.set([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
  bytes[9] = 0x73;
  setUint16LE(bytes, 12, 13);
  return bytes;
}

function minimalRar5() {
  return new Uint8Array([
    0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00,
    0, 0, 0, 0,
    3,
    1, 0, 0
  ]);
}

function minimalWebm() {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, ...encoder.encode("webm")]);
}

function minimalWav() {
  const bytes = new Uint8Array(44);
  writeAscii(bytes, 0, "RIFF");
  setUint32LE(bytes, 4, 36);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  setUint32LE(bytes, 16, 16);
  setUint16LE(bytes, 20, 1);
  setUint16LE(bytes, 22, 1);
  setUint32LE(bytes, 24, 8000);
  setUint32LE(bytes, 28, 8000);
  setUint16LE(bytes, 32, 1);
  setUint16LE(bytes, 34, 8);
  writeAscii(bytes, 36, "data");
  return bytes;
}

function minimalMp3() {
  const bytes = new Uint8Array(417);
  bytes.set([0xff, 0xfb, 0x90, 0x64]);
  return bytes;
}

function minimalOgg() {
  const bytes = new Uint8Array(29);
  writeAscii(bytes, 0, "OggS");
  bytes[5] = 2;
  bytes[26] = 1;
  bytes[27] = 1;
  return bytes;
}

function minimalGzip() {
  return new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
}

function minimalTar() {
  const bytes = new Uint8Array(512);
  writeAscii(bytes, 0, "file.txt");
  writeAscii(bytes, 100, "0000644\0");
  writeAscii(bytes, 108, "0000000\0");
  writeAscii(bytes, 116, "0000000\0");
  writeAscii(bytes, 124, "00000000000\0");
  writeAscii(bytes, 136, "00000000000\0");
  bytes.fill(0x20, 148, 156);
  bytes[156] = 0x30;
  writeAscii(bytes, 257, "ustar\0");
  writeAscii(bytes, 263, "00");
  const checksum = bytes.reduce((sum, byte) => sum + byte, 0);
  writeAscii(bytes, 148, checksum.toString(8).padStart(6, "0") + "\0 ");
  return bytes;
}

function minimal7z() {
  const bytes = new Uint8Array(32);
  bytes.set([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4]);
  return bytes;
}

function minimalExe() {
  const bytes = new Uint8Array(64);
  writeAscii(bytes, 0, "MZ");
  setUint16LE(bytes, 2, 64);
  setUint16LE(bytes, 4, 1);
  return bytes;
}

function minimalSfnt(signature: "\u0000\u0001\u0000\u0000" | "OTTO") {
  const bytes = new Uint8Array(32);
  writeAscii(bytes, 0, signature);
  setUint16BE(bytes, 4, 1);
  writeAscii(bytes, 12, "head");
  setUint32BE(bytes, 20, 28);
  setUint32BE(bytes, 24, 4);
  return bytes;
}

function minimalWoff(signature: "wOFF" | "wOF2") {
  const headerSize = signature === "wOFF" ? 44 : 48;
  const bytes = new Uint8Array(signature === "wOFF" ? 68 : 49);
  writeAscii(bytes, 0, signature);
  setUint32BE(bytes, 4, 0x00010000);
  setUint32BE(bytes, 8, bytes.length);
  setUint16BE(bytes, 12, 1);
  setUint32BE(bytes, 16, 32);
  if (signature === "wOFF") {
    writeAscii(bytes, headerSize, "head");
    setUint32BE(bytes, headerSize + 4, 64);
    setUint32BE(bytes, headerSize + 8, 4);
    setUint32BE(bytes, headerSize + 12, 4);
  } else {
    setUint32BE(bytes, 20, 1);
  }
  return bytes;
}

type OfficeFamily = "docx" | "xlsx" | "pptx";

const office = {
  docx: {
    main: "word/document.xml",
    part: "/word/document.xml",
    root: "w:document",
    rootNamespace: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
  },
  xlsx: {
    main: "xl/workbook.xml",
    part: "/xl/workbook.xml",
    root: "x:workbook",
    rootNamespace: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
  },
  pptx: {
    main: "ppt/presentation.xml",
    part: "/ppt/presentation.xml",
    root: "p:presentation",
    rootNamespace: "http://schemas.openxmlformats.org/presentationml/2006/main",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
  }
} as const;

function ooxmlEntries(family: OfficeFamily) {
  const definition = office[family];
  return {
    "[Content_Types].xml": encoder.encode(
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="${definition.part}" ContentType="${definition.contentType}"/></Types>`
    ),
    "_rels/.rels": encoder.encode(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${definition.main}"/></Relationships>`
    ),
    [definition.main]: encoder.encode(
      `<?xml version="1.0"?><${definition.root} xmlns:${definition.root.split(":")[0]}="${definition.rootNamespace}"/>`
    )
  };
}

function corruptFirstStoredPayload(bytes: Uint8Array) {
  const copy = bytes.slice();
  const view = new DataView(copy.buffer);
  const payloadOffset = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  copy[payloadOffset] ^= 0xff;
  return copy;
}

test("validates PDF and structurally valid PNG bytes without trusting Blob MIME", async () => {
  const pdf = await validateOutput(output("report.PDF", "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "image/png"));
  const png = await validateOutput(output("image.png", minimalPng(), "text/plain"));

  expect(pdf).toMatchObject({ expectedFormat: "pdf", detectedFormat: "pdf", mime: "image/png", valid: true, errors: [] });
  expect(png).toMatchObject({ expectedFormat: "png", detectedFormat: "png", mime: "text/plain", valid: true, errors: [] });
});

test("rejects corrupt binary output, malformed JSON, and unknown claimed formats", async () => {
  const [pdf, json, unknown] = await validateOutputs([
    output("broken.pdf", "%PDF-1.7\nmissing EOF"),
    output("broken.json", "{not json}"),
    output("payload.mystery", [1, 2, 3])
  ]);

  expect(pdf.errors).toContain("PDF EOF marker is missing from the output tail.");
  expect(json.errors).toContain("JSON output could not be parsed.");
  expect(unknown.errors).toContain("Output extension is missing or not supported for validation.");
  expect([pdf, json, unknown].every((fact) => !fact.valid)).toBe(true);
});

test("parses and validates minimally well-formed OOXML package families", async () => {
  for (const family of ["docx", "xlsx", "pptx"] as const) {
    const facts = await validateOutput(output(`document.${family}`, zipSync(ooxmlEntries(family))));
    expect(facts).toMatchObject({ expectedFormat: family, detectedFormat: family, valid: true, errors: [] });
  }
});

test("rejects malformed, unbound, mismatched, and mixed OOXML packages", async () => {
  const malformed = ooxmlEntries("docx");
  malformed["word/document.xml"] = encoder.encode("<w:document>");
  const unbound = ooxmlEntries("docx");
  unbound["word/document.xml"] = encoder.encode("<w:document/>");
  const unknownEntity = ooxmlEntries("docx");
  unknownEntity["word/document.xml"] = encoder.encode(
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">&unknown;</w:document>'
  );
  const mixed = { ...ooxmlEntries("docx"), ...ooxmlEntries("xlsx") };
  const mismatched = output("letter.xlsx", zipSync(ooxmlEntries("docx")));

  for (const candidate of [
    output("malformed.docx", zipSync(malformed)),
    output("unbound.docx", zipSync(unbound)),
    output("entity.docx", zipSync(unknownEntity)),
    output("mixed.docx", zipSync(mixed)),
    mismatched
  ]) {
    await expect(validateOutput(candidate)).resolves.toMatchObject({ valid: false });
  }
});

test("reads every ZIP payload and rejects a stored entry with a corrupt CRC", async () => {
  const valid = zipSync({ "payload.txt": encoder.encode("payload") }, { level: 0 });
  const corrupt = corruptFirstStoredPayload(valid);

  await expect(validateOutput(output("valid.zip", valid))).resolves.toMatchObject({ valid: true });
  const facts = await validateOutput(output("corrupt.zip", corrupt));
  expect(facts.valid).toBe(false);
  expect(facts.errors.join(" ")).toMatch(/signature|CRC|payload/i);
});

test("rejects unsafe and duplicate archive paths during output validation", async () => {
  const unsafeArchives = [
    zipSync({ "C:escape.txt": encoder.encode("x") }),
    zipSync({ "./current.txt": encoder.encode("x") }),
    zipSync({ "folder//empty.txt": encoder.encode("x") }),
    zipSync({ "Folder/same.txt": encoder.encode("one"), "folder/same.txt": encoder.encode("two") })
  ];

  for (const [index, archive] of unsafeArchives.entries()) {
    const facts = await validateOutput(output(`unsafe-${index}.zip`, archive));
    expect(facts.valid).toBe(false);
    expect(facts.errors.join(" ")).toMatch(/unsafe path|duplicate/i);
  }
});

test("parses bounded ISO BMFF top-level boxes and expected brands", async () => {
  const largeFree = isoBox("free", new Uint8Array(6_000));
  const extendedFtypPayload = new Uint8Array(12);
  writeAscii(extendedFtypPayload, 0, "isom");
  writeAscii(extendedFtypPayload, 8, "mp42");
  const validCases = [
    output("movie.mp4", concatBytes(isoBaseMedia("isom", [], ["isom", "mp42"]), largeFree, isoBox("moov"), isoBox("mdat"))),
    output("extended.mp4", concatBytes(isoExtendedBox("ftyp", extendedFtypPayload), isoBox("moov"), isoBox("mdat"))),
    output("fragment.mp4", isoBaseMedia("iso6", ["moof", "mdat"], ["iso6", "dash"])),
    output("movie.mov", isoBaseMedia("qt  ", ["moov", "mdat"])),
    output("audio.m4a", isoBaseMedia("M4A ", ["moov", "mdat"])),
    output("image.avif", isoBaseMedia("avif", ["meta", "mdat"], ["avif", "mif1"]))
  ];

  const validFacts = await validateOutputs(validCases);
  expect(validFacts.filter((fact) => !fact.valid)).toEqual([]);

  const ftypOnly = isoBaseMedia("isom", []);
  const unknownBrand = isoBaseMedia("zzzz", ["moov", "mdat"]);
  const unbrandedFragment = isoBaseMedia("isom", ["moof", "mdat"]);
  const zeroSized = isoBaseMedia("isom", ["moov", "mdat"]);
  setUint32BE(zeroSized, isoBox("ftyp", new Uint8Array(12)).length, 0);
  const truncated = isoBaseMedia("isom", ["moov"]);
  setUint32BE(truncated, truncated.length - 8, 128);
  const overflow = concatBytes(isoBaseMedia("isom", []), new Uint8Array([0, 0, 0, 1, 0x6d, 0x6f, 0x6f, 0x76, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));

  for (const [index, bytes] of [ftypOnly, unknownBrand, unbrandedFragment, zeroSized, truncated, overflow].entries()) {
    await expect(validateOutput(output(`invalid-${index}.mp4`, bytes))).resolves.toMatchObject({ valid: false });
  }
});

test("requires bounded RAR4 and RAR5 archive main headers", async () => {
  await expect(validateOutput(output("legacy.rar", minimalRar4()))).resolves.toMatchObject({ valid: true });
  await expect(validateOutput(output("modern.rar", minimalRar5()))).resolves.toMatchObject({ valid: true });

  const wrongRar4Type = minimalRar4();
  wrongRar4Type[9] = 0x74;
  const oversizedRar4 = minimalRar4();
  setUint16LE(oversizedRar4, 12, 64);
  const wrongRar5Type = minimalRar5();
  wrongRar5Type[13] = 2;
  const oversizedRar5 = minimalRar5();
  oversizedRar5[12] = 64;

  for (const bytes of [
    minimalRar4().slice(0, 7),
    minimalRar5().slice(0, 8),
    wrongRar4Type,
    oversizedRar4,
    wrongRar5Type,
    oversizedRar5
  ]) {
    await expect(validateOutput(output("invalid.rar", bytes))).resolves.toMatchObject({ valid: false });
  }
});

test("validates JPEG markers across large metadata segments", async () => {
  await expect(validateOutput(output("large-exif.jpg", jpegWithExif()))).resolves.toMatchObject({ valid: true });

  const truncatedExif = jpegWithExif();
  setUint16BE(truncatedExif, 4, 65_000);
  const invalidLength = jpegWithExif();
  setUint16BE(invalidLength, 4, 1);
  const noSos = jpegWithExif().slice(0, -13);
  const noEoi = jpegWithExif().slice(0, -2);

  for (const bytes of [truncatedExif, invalidLength, noSos, noEoi]) {
    await expect(validateOutput(output("invalid.jpg", bytes))).resolves.toMatchObject({ valid: false });
  }
});

test("parses complete bounded XML documents instead of the header prefix", async () => {
  const body = "x".repeat(6_000);
  const valid = await validateOutput(output("long.xml", `<root>${body}</root>`));
  const malformed = await validateOutput(output("malformed.xml", `<root>${body}<child></root>`));
  const oversized = await validateOutput({
    name: "oversized.xml",
    blob: new Blob(["<root>", new Uint8Array(MAX_XML_VALIDATION_BYTES), "</root>"])
  });

  expect(valid).toMatchObject({ valid: true, detectedFormat: "xml" });
  expect(malformed.valid).toBe(false);
  expect(oversized.valid).toBe(false);
  expect(oversized.errors.join(" ")).toMatch(/XML.*limit.*desktop/i);
});

test("rejects truncated simple-format magic snippets", async () => {
  const cases = [
    output("bitmap.bmp", [0x42, 0x4d]),
    output("favicon.ico", [0, 0, 1, 0]),
    output("movie.mp4", isoBaseMedia("isom", ["moov", "mdat"]).slice(0, 8)),
    output("movie.webm", [0x1a, 0x45, 0xdf, 0xa3]),
    output("audio.wav", encoder.encode("RIFF\0\0\0\0WAVE")),
    output("audio.mp3", [0x49, 0x44, 0x33, 4]),
    output("audio.ogg", encoder.encode("OggS")),
    output("archive.gz", [0x1f, 0x8b, 8]),
    output("archive.tar", (() => { const bytes = new Uint8Array(512); writeAscii(bytes, 257, "ustar"); return bytes; })()),
    output("archive.rar", [0x52, 0x61, 0x72, 0x21, 0x1a, 7]),
    output("archive.7z", [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
    output("program.exe", [0x4d, 0x5a]),
    output("font.woff", encoder.encode("wOFF")),
    output("font.woff2", encoder.encode("wOF2")),
    output("font.ttf", [0, 1, 0, 0]),
    output("font.otf", encoder.encode("OTTO"))
  ];

  const facts = await validateOutputs(cases);
  expect(facts.filter((fact) => fact.valid)).toEqual([]);
});

test("rejects inconsistent declared lengths and offsets", async () => {
  const bmp = minimalBmp();
  setUint32LE(bmp, 2, bmp.length + 100);
  const wav = minimalWav();
  setUint32LE(wav, 4, 1);
  const woff = minimalWoff("wOFF");
  setUint32BE(woff, 8, 999);
  const jpegWithoutFrame = new Uint8Array(5004);
  jpegWithoutFrame.set([0xff, 0xd8, 0xff, 0xe1, 0x13, 0x88]);
  jpegWithoutFrame.set([0xff, 0xd9], jpegWithoutFrame.length - 2);
  const undersizedWebpChunk = new Uint8Array(22);
  writeAscii(undersizedWebpChunk, 0, "RIFF");
  setUint32LE(undersizedWebpChunk, 4, 14);
  writeAscii(undersizedWebpChunk, 8, "WEBP");
  writeAscii(undersizedWebpChunk, 12, "VP8L");
  setUint32LE(undersizedWebpChunk, 16, 1);

  const facts = await validateOutputs([
    output("bad.bmp", bmp),
    output("bad.wav", wav),
    output("bad.woff", woff),
    output("bad.jpg", jpegWithoutFrame),
    output("bad.webp", undersizedWebpChunk)
  ]);
  expect(facts.every((fact) => !fact.valid)).toBe(true);
});

test("validates minimally structured emitted media, text, font, and archive formats", async () => {
  const cases = [
    output("photo.jpg", minimalJpeg()),
    output("image.gif", minimalGif()),
    output("image.webp", minimalWebp()),
    output("bitmap.bmp", minimalBmp()),
    output("favicon.ico", minimalIco()),
    output("shape.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "image/svg+xml"),
    output("page.html", "<!doctype html><html><body>ok</body></html>"),
    output("notes.md", "# Notes"),
    output("rows.csv", "name,value\na,1"),
    output("data.xml", "<?xml version=\"1.0\"?><root/>") ,
    output("data.yaml", "name: omni"),
    output("movie.mp4", isoBaseMedia("isom", ["moov", "mdat"], ["isom", "mp42"])),
    output("movie.mov", isoBaseMedia("qt  ", ["moov", "mdat"])),
    output("audio.m4a", isoBaseMedia("M4A ", ["moov", "mdat"])),
    output("image.avif", isoBaseMedia("avif", ["meta", "mdat"], ["avif", "mif1"])),
    output("movie.webm", minimalWebm()),
    output("audio.wav", minimalWav()),
    output("audio.mp3", minimalMp3()),
    output("audio.ogg", minimalOgg()),
    output("archive.gz", minimalGzip()),
    output("archive.tar", minimalTar()),
    output("archive.rar", minimalRar4()),
    output("archive.7z", minimal7z()),
    output("program.exe", minimalExe()),
    output("font.woff", minimalWoff("wOFF")),
    output("font.woff2", minimalWoff("wOF2")),
    output("font.ttf", minimalSfnt("\u0000\u0001\u0000\u0000")),
    output("font.otf", minimalSfnt("OTTO"))
  ];

  const facts = await validateOutputs(cases);
  expect(facts.filter((fact) => !fact.valid)).toEqual([]);
  expect(facts.find((fact) => fact.expectedFormat === "markdown")?.warnings).toContain("Text output encoding was checked; semantic content was not validated.");
});

test("validates JSON Lines one record at a time and recognizes TSV as text", async () => {
  await expect(validateOutput(output("rows.jsonl", '{"a":1}\n{"a":2}'))).resolves.toMatchObject({ valid: true, detectedFormat: "jsonl" });
  await expect(validateOutput(output("rows.tsv", "name\tvalue\nalpha\t1"))).resolves.toMatchObject({ valid: true, detectedFormat: "text" });
  await expect(validateOutput(output("broken.jsonl", '{"a":1}\nnope'))).resolves.toMatchObject({ valid: false });
});

test("fails closed when JSON exceeds the browser structural-validation limit", async () => {
  const oversized = new Blob(["[", new Uint8Array(MAX_JSON_VALIDATION_BYTES), "]"], { type: "application/json" });
  const facts = await validateOutput({ name: "large.json", blob: oversized });

  expect(facts.valid).toBe(false);
  expect(facts.errors).toEqual([
    `JSON output exceeds the ${MAX_JSON_VALIDATION_BYTES}-byte browser validation limit; use the desktop app for large JSON files.`
  ]);
});

test("rejects empty output blobs and empty conversion results", async () => {
  await expect(validateOutput(output("empty.txt", []))).resolves.toMatchObject({ valid: false, errors: ["Output is empty."] });
  await expect(validateOutputs([])).resolves.toEqual([expect.objectContaining({ valid: false, errors: ["Conversion produced no outputs."] })]);
});
