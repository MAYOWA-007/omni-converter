import { expect, test } from "playwright/test";

const APP_PATH = "/omni-converter/";

test("first install caches the bounded shell and immediately reopens offline", async ({ context, page }) => {
  const diagnostics: string[] = [];
  page.on("requestfailed", (request) => diagnostics.push(`${request.url()} :: ${request.failure()?.errorText ?? "request failed"}`));
  page.on("pageerror", (error) => diagnostics.push(`page error :: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(`console :: ${message.text()}`);
  });
  await page.goto(APP_PATH);
  await expect(page.getByText("Drop any file")).toBeVisible();
  await waitForFirstController(page);

  const installed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/omni-converter/");
    const cacheNames = await caches.keys();
    const entries = (await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).map((request) => request.url);
    }))).flat();
    return {
      active: registration?.active?.state,
      cacheNames,
      entries,
      scope: registration?.scope,
      updateViaCache: registration?.updateViaCache,
      waiting: Boolean(registration?.waiting)
    };
  });

  expect(installed.active).toBe("activated");
  expect(installed.scope).toBe("http://127.0.0.1:5190/omni-converter/");
  expect(installed.updateViaCache).toBe("none");
  expect(installed.waiting).toBe(false);
  expect(installed.cacheNames).toHaveLength(1);
  expect(installed.cacheNames[0]).toMatch(/^omni-converter-static-/);
  expect(installed.entries).toContain("http://127.0.0.1:5190/omni-converter/");
  expect(installed.entries.some((url) => /\/omni-converter\/assets\/[^/]+\.js$/.test(url))).toBe(true);
  expect(installed.entries.some((url) => /\/omni-converter\/assets\/[^/]+\.css$/.test(url))).toBe(true);

  const wrongMimeType = await page.evaluate(async () => {
    await fetch("/omni-converter/not-an-api?user-file=private").catch(() => undefined);
    await fetch("/omni-converter/assets/favicons/favicon-48x48.png?user-file=probe").catch(() => undefined);
    await fetch("/omni-converter/assets/ffmpeg/ffmpeg-core.wasm", { headers: { Range: "bytes=0-15" } }).catch(() => undefined);
    const wrongMime = await fetch("/omni-converter/assets/not-real.js");
    const blobUrl = URL.createObjectURL(new Blob(["private file"], { type: "text/plain" }));
    await fetch(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return wrongMime.headers.get("content-type");
  });
  expect(wrongMimeType).toContain("text/html");

  const cachedAfterUntrustedRequests = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => request.url);
  }))).flat());
  expect(cachedAfterUntrustedRequests.every((value) => {
    const url = new URL(value);
    return url.origin === "http://127.0.0.1:5190" && !url.search && (url.pathname === APP_PATH || url.pathname.startsWith(`${APP_PATH}assets/`) || [
      `${APP_PATH}site.webmanifest`, `${APP_PATH}prepaint.css`, `${APP_PATH}favicon.ico`, `${APP_PATH}favicon-16x16.png`,
      `${APP_PATH}favicon-32x32.png`, `${APP_PATH}favicon-48x48.png`, `${APP_PATH}apple-touch-icon.png`,
      `${APP_PATH}android-chrome-192x192.png`, `${APP_PATH}android-chrome-512x512.png`
    ].includes(url.pathname));
  })).toBe(true);
  expect(cachedAfterUntrustedRequests.some((url) => url.includes("not-an-api") || url.includes("not-real.js") || url.includes("user-file=private") || url.includes("ffmpeg-core.wasm"))).toBe(false);

  diagnostics.length = 0;
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Drop any file")).toBeVisible();
  await expect(page.locator(".drop-core"), diagnostics.join("\n")).toBeVisible();
});

async function waitForFirstController(page: import("playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Service worker did not claim the first page.")), 10_000);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  });
}
