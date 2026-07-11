import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const source = html.match(/<script[^>]+src="[^"]*\/assets\/([^"]+\.js)"/)?.[1];
if (!source) throw new Error("Could not find the production entry script in dist/index.html.");

const entryPath = resolve("dist/assets", source);
const entryBytes = statSync(entryPath).size;
const entrySource = readFileSync(entryPath, "utf8");
const maximumBytes = 400 * 1024;

if (entryBytes > maximumBytes) {
  throw new Error(`Initial entry is ${(entryBytes / 1024).toFixed(1)} KiB; the release limit is ${maximumBytes / 1024} KiB.`);
}
if (entrySource.includes("ZipWriter") || entrySource.includes("ZipReader")) {
  throw new Error("The ZIP engine was bundled into the initial entry instead of an on-demand chunk.");
}

console.log(`Initial entry: ${(entryBytes / 1024).toFixed(1)} KiB (${source})`);
