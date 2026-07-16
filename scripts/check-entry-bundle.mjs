import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const assetPath = (url) => resolve("dist", url.replace(/^\/?omni-converter\//, ""));
const initialJavaScript = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js)"[^>]*>/g)].map((match) => match[1]);
if (initialJavaScript.length === 0) throw new Error("Could not find production JavaScript in dist/index.html.");

const initialSources = initialJavaScript.map((url) => readFileSync(assetPath(url), "utf8"));
const initialGzipBytes = initialSources.reduce((total, source) => total + gzipSync(source).byteLength, 0);
const maximumInitialGzipBytes = 250 * 1024;
if (initialGzipBytes > maximumInitialGzipBytes) {
  throw new Error(`Aggregate initial JavaScript is ${(initialGzipBytes / 1024).toFixed(1)} KiB gzip; the release limit is ${maximumInitialGzipBytes / 1024} KiB gzip.`);
}
if (initialJavaScript.some((url) => /zip-engine/i.test(url))) {
  throw new Error("The ZIP engine was bundled into the initial route instead of an on-demand chunk.");
}
if (initialSources.some((source) => source.includes("image-to-motion-card"))) {
  throw new Error("The conversion matrix was bundled into the initial route instead of loading after intake.");
}

const initialCss = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map((match) => readFileSync(assetPath(match[1]), "utf8"));
const initialMarkupAndStyles = [html, ...initialCss, ...initialSources].join("\n");
const imagePatterns = [
  /["'](\/?(?:omni-converter\/)?(?:assets\/)?[^"']+\.(?:avif|gif|jpe?g|png|webp))["']/gi,
  /url\(["']?(\/?(?:omni-converter\/)?(?:assets\/)?[^"')]+\.(?:avif|gif|jpe?g|png|webp))["']?\)/gi
];
const initialImageUrls = new Set(imagePatterns.flatMap((pattern) => [...initialMarkupAndStyles.matchAll(pattern)].map((match) => match[1]))
  .filter((url) => !/android-chrome|apple-touch|omni-converter-icon/i.test(url)));
const initialImageBytes = [...initialImageUrls].reduce((total, url) => {
  const path = assetPath(url);
  return total + (extname(path) ? statSync(path).size : 0);
}, 0);
const maximumInitialImageBytes = 300 * 1024;
if (initialImageBytes > maximumInitialImageBytes) {
  throw new Error(`Initial mobile imagery is ${(initialImageBytes / 1024).toFixed(1)} KiB; the release limit is ${maximumInitialImageBytes / 1024} KiB.`);
}

console.log(`Initial JavaScript: ${(initialGzipBytes / 1024).toFixed(1)} KiB gzip across ${initialJavaScript.length} files.`);
console.log(`Initial mobile imagery: ${(initialImageBytes / 1024).toFixed(1)} KiB across ${initialImageUrls.size} files.`);
