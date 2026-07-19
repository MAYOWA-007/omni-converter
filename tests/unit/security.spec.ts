import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeArchivePath } from "../../src/core/archivePaths";
import { sanitizeGeneratedHtml } from "../../src/core/sanitize";

test("removes executable elements, event handlers, and active embeds", () => {
  const sanitized = sanitizeGeneratedHtml(`<!doctype html><html><head>
    <script>alert(1)</script><meta http-equiv="refresh" content="0;url=javascript:alert(1)">
  </head><body onload="alert(1)">
    <h1 onclick="alert(1)">Safe heading</h1>
    <iframe srcdoc="<script>alert(1)</script>"></iframe>
    <object data="data:text/html,<script>alert(1)</script>"></object>
    <embed src="javascript:alert(1)">
  </body></html>`);

  expect(sanitized).toContain("Safe heading");
  expect(sanitized).not.toMatch(/<script|onload|onclick|http-equiv|<iframe|srcdoc|<object|<embed/i);
});

test("blocks encoded active URL schemes while preserving safe links and raster data images", () => {
  const pixel = "data:image/png;base64,iVBORw0KGgo=";
  const sanitized = sanitizeGeneratedHtml(`<html><body>
    <a href="javascript:alert(1)">one</a>
    <a href="java&#x73;cript:alert(1)">two</a>
    <a href="vbscript:msgbox(1)">three</a>
    <a href="data:text/html,<script>alert(1)</script>">four</a>
    <a href="https://example.com/report">safe link</a>
    <img src="${pixel}" alt="pixel">
    <img src="data:image/svg+xml,<svg onload=alert(1)></svg>" alt="active">
  </body></html>`);

  expect(sanitized).not.toMatch(/javascript:|vbscript:|data:text\/html|data:image\/svg\+xml/i);
  expect(sanitized).toContain('href="https://example.com/report"');
  expect(sanitized).toContain(`src="${pixel}"`);
});

test("blocks backslashes that browsers normalize into cross-origin network paths", () => {
  const sanitized = sanitizeGeneratedHtml(`<html><body>
    <a href="/\\evil.test/literal">literal</a>
    <a href="/&#92;evil.test/entity">entity</a>
    <img src="/%5cevil.test/percent" alt="percent">
    <p style="background-image:url('/\\5c evil.test/css')">css escape</p>
    <a href="/reports/summary.html">safe relative</a>
  </body></html>`);

  expect(sanitized).toContain("<a>literal</a>");
  expect(sanitized).toContain("<a>entity</a>");
  expect(sanitized).toContain('<img alt="percent">');
  expect(sanitized).toContain("<p>css escape</p>");
  expect(sanitized).toContain('<a href="/reports/summary.html">safe relative</a>');
  expect(sanitized).not.toMatch(/evil\.test|%5c|&#92;|\\5c/i);
});

test("drops dangerous CSS and keeps the generated document styles the app needs", () => {
  const sanitized = sanitizeGeneratedHtml(`<html><head>
    <style>@import "https://evil.test/a.css";body{color:red}</style>
    <style>@font-face{font-family:"Report";src:url("fonts/report.woff2")}body{margin:3rem;color:#18120d}</style>
  </head><body>
    <p style="background:url(j\\61vascript:alert(1));color:red">unsafe</p>
    <p style="color:#18120d;margin:1rem">safe</p>
  </body></html>`);

  expect(sanitized).not.toMatch(/@import|javascript:|j\\61vascript/i);
  expect(sanitized).toContain('@font-face{font-family:"Report";src:url("fonts/report.woff2")}');
  expect(sanitized).toContain('style="color:#18120d;margin:1rem"');
});

test("keeps useful generated structure but removes clobbering and unknown attributes", () => {
  const sanitized = sanitizeGeneratedHtml(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Report</title>
  </head><body><main id="redirectTo"><h1 class="title">Report</h1><pre aria-label="Text">Ready</pre></main></body></html>`);

  expect(sanitized).toMatch(/^<!doctype html>/i);
  expect(sanitized).toContain('<meta charset="utf-8">');
  expect(sanitized).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">');
  expect(sanitized).toContain('<h1 class="title">Report</h1>');
  expect(sanitized).toContain('<pre aria-label="Text">Ready</pre>');
  expect(sanitized).not.toContain('id="redirectTo"');
});

test("strict archive normalization rejects drive, UNC, absolute, and traversal paths", () => {
  const unsafe = [
    "C:\\private.txt",
    "C:private.txt",
    "\\\\server\\share\\private.txt",
    "/private.txt",
    "../private.txt",
    "folder/../../private.txt"
  ];

  for (const path of unsafe) {
    expect(() => normalizeArchivePath(path)).toThrow();
  }
  expect(normalizeArchivePath("reports\\2026\\summary.html")).toBe("reports/2026/summary.html");
});

test("the app shell uses an external prepaint stylesheet and a strict CSP", () => {
  const html = readFileSync(resolve("index.html"), "utf8");
  const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i.exec(html)?.[1] ?? "";

  expect(html).not.toMatch(/<style(?:\s|>)/i);
  expect(html).toContain('href="%BASE_URL%prepaint.css"');
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(policy).toContain("connect-src 'self' data: blob:");
  expect(policy).toContain("worker-src 'self' blob:");
  expect(policy).toContain("base-uri 'none'");
  expect(policy).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
});

test("the service worker cache policy is versioned and refuses arbitrary requests", () => {
  const worker = readFileSync(resolve("public/sw.js"), "utf8");

  expect(worker).toMatch(/CACHE_VERSION\s*=\s*"[^"]+"/);
  expect(worker).toContain('request.method !== "GET"');
  expect(worker).toContain("url.origin !== self.location.origin");
  expect(worker).toContain('request.headers.has("range")');
  expect(worker).toContain("isExplicitStaticRequest");
  expect(worker).toContain("shellMarkup.matchAll");
  expect(worker).toContain("discoverCssAssets");
  expect(worker).not.toContain("OmniDisplay.woff2");
  expect(worker).not.toMatch(/caches\.match\(\s*(?:event\.)?request\s*\)/);
  expect(worker).not.toContain("skipWaiting();\n});");
});

test("the install manifest has static-safe file handlers and no POST share target", () => {
  const manifest = JSON.parse(readFileSync(resolve("public/site.webmanifest"), "utf8")) as {
    scope?: string;
    start_url?: string;
    file_handlers?: Array<{ action: string; accept: Record<string, string[]> }>;
    share_target?: unknown;
  };

  expect(manifest.scope).toBe("/omni-converter/");
  expect(manifest.start_url).toBe("/omni-converter/");
  expect(manifest.file_handlers?.[0]?.action).toBe("/omni-converter/");
  expect(manifest.file_handlers?.[0]?.accept["application/pdf"]).toContain(".pdf");
  expect(manifest.file_handlers?.[0]?.accept["video/mp4"]).toContain(".mp4");
  expect(manifest.file_handlers?.[0]?.accept["audio/mpeg"]).toContain(".mp3");
  expect(manifest.share_target).toBeUndefined();
});
