const CACHE_PREFIX = "omni-converter-static-";
const CACHE_VERSION = "2026-07-10.1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname.endsWith("/") ? SCOPE_URL.pathname : `${SCOPE_URL.pathname}/`;
const SHELL_URL = new URL(SCOPE_PATH, self.location.origin).href;

const PRECACHE_PATHS = [
  "site.webmanifest",
  "prepaint.css",
  "favicon-32x32.png",
  "android-chrome-192x192.png"
];
const STATIC_ROOT_FILES = new Set([
  "site.webmanifest",
  "prepaint.css",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png"
]);
const STATIC_EXTENSIONS = new Set([
  "avif", "css", "gif", "ico", "jpeg", "jpg", "js", "json", "mjs",
  "png", "svg", "wasm", "webmanifest", "webp", "woff", "woff2"
]);
const MAX_INSTALL_ASSETS = 64;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "OMNI_ACTIVATE_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !/^https?:$/.test(url.protocol)) return;

  if (isShellNavigation(request, url)) {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (isExplicitStaticRequest(url)) {
    event.respondWith(cacheFirstStatic(request));
  }
});

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellRequest = new Request(SHELL_URL, { cache: "reload", credentials: "same-origin" });
  const shellResponse = await fetch(shellRequest);
  await cacheShellResponse(cache, shellResponse);
}

async function cacheShellResponse(cache, shellResponse) {
  if (!isCacheableResponse(shellResponse) || !shellResponse.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Unable to cache the app shell.");
  }
  const shellMarkup = await shellResponse.clone().text();
  await cache.put(SHELL_URL, shellResponse.clone());

  const shellAssets = Array.from(shellMarkup.matchAll(/(?:src|href)=["']([^"']+)["']/gi), (match) => new URL(match[1], SHELL_URL))
    .filter((url) => url.origin === self.location.origin && isExplicitStaticRequest(url));
  const assetUrls = [...new Set([
    ...PRECACHE_PATHS.map((path) => new URL(path, SHELL_URL).href),
    ...shellAssets.map((url) => url.href)
  ])];
  await cacheAssetGraph(cache, assetUrls);
}

async function cacheAssetGraph(cache, initialUrls) {
  const pending = [...initialUrls];
  const visited = new Set();
  while (pending.length > 0) {
    const assetUrl = pending.shift();
    if (!assetUrl || visited.has(assetUrl)) continue;
    if (visited.size >= MAX_INSTALL_ASSETS) throw new Error("The app shell asset graph exceeds the cache limit.");
    visited.add(assetUrl);

    const url = new URL(assetUrl);
    if (url.origin !== self.location.origin || !isExplicitStaticRequest(url)) continue;
    const request = new Request(url, { cache: "reload", credentials: "same-origin" });
    const response = await fetch(request);
    if (!isCacheableStaticResponse(url, response)) throw new Error(`Unable to cache app shell asset: ${url.pathname}`);
    const css = url.pathname.endsWith(".css") ? await response.clone().text() : null;
    await cache.put(url, response);
    if (css) {
      for (const dependency of discoverCssAssets(css, url)) {
        if (!visited.has(dependency.href)) pending.push(dependency.href);
      }
    }
  }
}

function discoverCssAssets(css, stylesheetUrl) {
  const references = [];
  const candidates = [
    ...Array.from(css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/gi), (match) => match[1] ?? match[2] ?? match[3]),
    ...Array.from(css.matchAll(/@import\s+(?:"([^"]+)"|'([^']+)')/gi), (match) => match[1] ?? match[2])
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith("#") || candidate.startsWith("data:")) continue;
    try {
      const url = new URL(candidate, stylesheetUrl);
      if (url.origin === self.location.origin && isExplicitStaticRequest(url)) references.push(url);
    } catch {
      // Invalid CSS references are not part of the trusted shell graph.
    }
  }
  return references;
}

function isShellNavigation(request, url) {
  if (request.mode !== "navigate" || url.search) return false;
  return url.pathname === SCOPE_PATH || url.pathname === `${SCOPE_PATH}index.html`;
}

function isExplicitStaticRequest(url) {
  if (url.search || !url.pathname.startsWith(SCOPE_PATH)) return false;
  const relativePath = url.pathname.slice(SCOPE_PATH.length);
  if (STATIC_ROOT_FILES.has(relativePath)) return true;
  if (!relativePath.startsWith("assets/") || relativePath.includes("..")) return false;
  const extension = relativePath.split(".").pop()?.toLowerCase() ?? "";
  return STATIC_EXTENSIONS.has(extension);
}

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response) && response.headers.get("content-type")?.includes("text/html")) {
      await cacheShellResponse(cache, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableStaticResponse(new URL(request.url), response) && !response.headers.get("content-disposition")) {
    await cache.put(request, response.clone());
  }
  return response;
}

function isCacheableResponse(response) {
  if (!response.ok || (response.type !== "basic" && response.type !== "default")) return false;
  try {
    return new URL(response.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isCacheableStaticResponse(url, response) {
  if (!isCacheableResponse(response)) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const extension = url.pathname.split(".").pop()?.toLowerCase() ?? "";
  if (["js", "mjs"].includes(extension)) return /javascript|ecmascript/.test(contentType);
  if (extension === "css") return contentType.includes("text/css");
  if (extension === "wasm") return contentType.includes("application/wasm");
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico"].includes(extension)) return contentType.startsWith("image/");
  if (["woff", "woff2"].includes(extension)) return /font\/|application\/(?:font|octet-stream)/.test(contentType);
  if (["json", "webmanifest"].includes(extension)) return /json|manifest/.test(contentType);
  return false;
}
