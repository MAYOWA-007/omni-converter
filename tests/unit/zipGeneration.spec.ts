import { readFile } from "node:fs/promises";
import { expect, test } from "playwright/test";
import { zipLevelFromCompression, zipOutputs } from "../../src/lib/conversionHelpers";

test("conversion archives map Store, Balanced and Maximum to explicit levels", () => {
  expect(zipLevelFromCompression("Store ZIP")).toBe(0);
  expect(zipLevelFromCompression("Balanced ZIP")).toBe(6);
  expect(zipLevelFromCompression("Maximum ZIP")).toBe(9);
});

test("conversion ZIP generation uses the async zip.js writer instead of synchronous fflate", async () => {
  const helpers = await readFile(new URL("../../src/lib/conversionHelpers.ts", import.meta.url), "utf8");
  const images = await readFile(new URL("../../src/lib/imageConversions.ts", import.meta.url), "utf8");
  const pdf = await readFile(new URL("../../src/lib/pdfConversions.ts", import.meta.url), "utf8");
  expect(helpers).toContain("ZipWriter");
  expect(helpers).toContain("useWebWorkers");
  expect(helpers).not.toContain("zipSync");
  expect(images).not.toContain("zipSync");
  expect(pdf).not.toContain("zipSync");
});

test("conversion ZIP generation rejects unsafe and colliding archive paths", async () => {
  const payload = new Blob(["fixture"], { type: "text/plain" });
  await expect(zipOutputs("unsafe.zip", [{ name: "../escape.txt", blob: payload }], 0)).rejects.toThrow(/parent segment/i);
  await expect(zipOutputs("duplicate.zip", [
    { name: "Folder/file.txt", blob: payload },
    { name: "folder/FILE.txt", blob: payload }
  ], 0)).rejects.toThrow(/duplicate output path/i);
});
