import { expect, test } from "playwright/test";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function loadedJavaScript(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const urls = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\.js(?:$|\?)/.test(url));
    return Promise.all(urls.map(async (url) => ({ url, source: await fetch(url).then((response) => response.text()) })));
  });
}

test("loads recipes only after intake and keeps ZIP code off the initial route", async ({ page }) => {
  await page.goto("/");

  const initialScripts = await loadedJavaScript(page);
  expect(initialScripts.some(({ url }) => /zip-engine/i.test(url))).toBe(false);
  expect(initialScripts.some(({ source }) => source.includes("image-to-motion-card"))).toBe(false);

  await page.locator('input[type="file"]').setInputFiles({ name: "intake.png", mimeType: "image/png", buffer: PNG_BYTES });
  await expect(page.getByRole("heading", { name: "What should it become?" })).toBeVisible();
  await expect.poll(async () => (await loadedJavaScript(page)).some(({ source }) => source.includes("image-to-motion-card"))).toBe(true);
});

test("starts with a nonblank lightweight vortex fallback and upgrades to a bounded canvas", async ({ page }) => {
  await page.goto("/");
  const fallback = page.locator(".vortex-fallback");
  await expect(fallback).toBeVisible();
  await expect(page.locator("canvas[data-vortex-topology='latitude-longitude']")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-vortex-scene]");
    return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
  }), { timeout: 5_000 }).toBe(true);
});

test("keeps an accessible static globe when the Three import fails", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:5190", serviceWorkers: "block" });
  const page = await context.newPage();
  let blockedImports = 0;
  await page.route(/WebGLRenderer/, async (route) => {
    blockedImports += 1;
    await route.abort();
  });
  try {
    await page.goto("/");
    await expect.poll(() => blockedImports, { timeout: 5_000 }).toBeGreaterThan(0);
    const fallback = page.getByRole("img", { name: "Static wire globe" });
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute("data-vortex-state", "fallback");
    const bounds = await fallback.boundingBox();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("keeps an accessible static globe when WebGL initialization fails", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") return null;
      return original.call(this, contextId as "2d", ...(args as [CanvasRenderingContext2DSettings]));
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  const fallback = page.getByRole("img", { name: "Static wire globe" });
  await expect(fallback).toBeVisible({ timeout: 5_000 });
  await expect(fallback).toHaveAttribute("data-vortex-state", "fallback");
  await expect(page.locator("canvas[data-vortex-scene]")).toBeHidden();
});

test("falls back to the static globe when the WebGL context is lost", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas[data-vortex-scene]");
  // The static globe is already visible while the deliberately delayed Three
  // chunk loads. Allow extra headroom when this spec follows encoder-heavy runs.
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.state ?? "loading"), { timeout: 10_000 }).toMatch(/ready|fallback/);
  if (await page.evaluate(() => window.__omniVortex?.state) === "fallback") {
    await expect(page.getByRole("img", { name: "Static wire globe" })).toBeVisible();
    test.skip(true, "WebGL was unavailable before a context-loss event could be injected.");
  }
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const prevented = await canvas.evaluate((node) => {
    const event = new Event("webglcontextlost", { cancelable: true });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  const fallback = page.getByRole("img", { name: "Static wire globe" });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("data-vortex-state", "fallback");
  await expect(canvas).toBeHidden();
});

test("uses the globe itself as a stable circular drop target", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const target = page.locator(".drop-core");
  await expect(target).toBeVisible();
  await expect(target).toHaveCSS("border-radius", "50%");
  await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const bounds = await target.boundingBox();
  expect(bounds?.width).toBeCloseTo(bounds?.height ?? 0, 1);
  expect(bounds?.width).toBeCloseTo(0.52 * 390, 0);
  const input = target.locator('input[type="file"]');
  await input.focus();
  await expect(input).toBeFocused();
  await expect.poll(() => target.evaluate((node) => node.matches(":focus-within"))).toBe(true);
});

test("records long tasks and keeps the main page bounded", async ({ page }) => {
  await page.goto("/");
  const supportsLongTasks = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes("longtask"));
  expect(supportsLongTasks).toBe(true);
  const metrics = await page.evaluate(() => (window as Window & { __omniPerformance?: { longTasks: number[]; totalBlockingTime: number } }).__omniPerformance);
  expect(metrics).toBeDefined();
  expect(Math.max(0, ...(metrics?.longTasks ?? []))).toBeLessThanOrEqual(200);
  expect(metrics?.totalBlockingTime ?? Infinity).toBeLessThanOrEqual(300);
});

test("keeps long-task budgets after the lazy Three upgrade", async ({ page }) => {
  await page.goto("/");
  const supportsLongTasks = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes("longtask"));
  expect(supportsLongTasks).toBe(true);
  await expect(page.locator("canvas[data-vortex-scene]")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.frames ?? 0), { timeout: 5_000 }).toBeGreaterThan(5);
  await page.locator('input[type="file"]').setInputFiles({ name: "transition.png", mimeType: "image/png", buffer: PNG_BYTES });
  await expect(page.getByRole("button", { name: "Image to PDF" })).toBeVisible();
  const productMetrics = await page.evaluate(() => window.__omniPerformance);
  expect(productMetrics?.screens).toContain("choose");
  expect(Math.max(0, ...(productMetrics?.longTasks ?? [])), JSON.stringify(productMetrics?.longTaskEntries ?? [])).toBeLessThanOrEqual(200);
  expect(productMetrics?.totalBlockingTime ?? Infinity).toBeLessThanOrEqual(300);

  const observedBeforeProbe = productMetrics?.longTasks.length ?? 0;
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const start = performance.now();
        while (performance.now() - start < 65) {
          // Deterministic observer probe kept below the product's 200ms ceiling.
        }
        setTimeout(resolve, 0);
      }, 0);
    });
  });
  await expect.poll(() => page.evaluate(() => window.__omniPerformance?.longTasks.length ?? 0)).toBeGreaterThan(observedBeforeProbe);
  const metrics = await page.evaluate(() => window.__omniPerformance);
  expect(metrics?.longTasks.slice(observedBeforeProbe).some((duration) => duration >= 50)).toBe(true);
});

test("adapts the drop scene from an idle cadence to an interactive cadence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const canvas = page.locator("canvas[data-vortex-scene]");
  await expect(canvas).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.frames ?? 0), { timeout: 5_000 }).toBeGreaterThan(1);

  const idleStart = await page.evaluate(() => window.__omniVortex?.frames ?? 0);
  await page.waitForTimeout(2_000);
  const idleEnd = await page.evaluate(() => window.__omniVortex?.frames ?? 0);
  await page.locator(".drop-core").hover();
  const interactiveStart = await page.evaluate(() => window.__omniVortex?.frames ?? 0);
  await page.waitForTimeout(2_000);
  const metrics = await page.evaluate(() => {
    const canvasNode = document.querySelector<HTMLCanvasElement>("canvas[data-vortex-scene]");
    const app = document.querySelector<HTMLElement>(".app-shell");
    if (!canvasNode || !app) throw new Error("Drop scene is unavailable.");
    const context = canvasNode.getContext("webgl2") ?? canvasNode.getContext("webgl");
    const canvasBounds = canvasNode.getBoundingClientRect();
    const background = getComputedStyle(app, "::before");
    return {
      backgroundFilter: background.filter,
      backgroundHeight: Number.parseFloat(background.height),
      canvasBufferArea: canvasNode.width * canvasNode.height,
      canvasHeight: canvasBounds.height,
      canvasWidth: canvasBounds.width,
      frames: window.__omniVortex?.frames ?? 0,
      preserveDrawingBuffer: context?.getContextAttributes()?.preserveDrawingBuffer
    };
  });

  expect(idleEnd - idleStart).toBeGreaterThanOrEqual(46);
  expect(idleEnd - idleStart).toBeLessThanOrEqual(64);
  expect(metrics.frames - interactiveStart).toBeGreaterThanOrEqual(92);
  expect(metrics.frames - interactiveStart).toBeLessThanOrEqual(124);
  expect(metrics.canvasWidth).toBeLessThanOrEqual(600);
  expect(metrics.canvasHeight).toBeLessThanOrEqual(600);
  expect(metrics.canvasBufferArea).toBeLessThanOrEqual(600_000);
  expect(metrics.preserveDrawingBuffer).toBe(false);
  expect(metrics.backgroundHeight).toBeLessThanOrEqual(901);
  expect(metrics.backgroundFilter).toBe("none");
});

test("keeps large-file intake free of conversion tasks over 200ms", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const chunk = new Uint8Array(1024 * 1024).fill(0x41);
    const file = new File(Array.from({ length: 24 }, () => chunk), "large-notes.txt", { type: "text/plain" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    (window as Window & { __omniLargeFile?: FileList }).__omniLargeFile = transfer.files;
  });
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__omniPerformance?.longTasks.length ?? 0);
  await page.locator('input[type="file"]').evaluate((input) => {
    const largeFile = (window as Window & { __omniLargeFile?: FileList }).__omniLargeFile;
    if (!largeFile) throw new Error("Large-file fixture was not prepared.");
    Object.defineProperty(input, "files", { configurable: true, value: largeFile });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "What should it become?" })).toBeVisible();
  const durations = await page.evaluate((start) => window.__omniPerformance?.longTasks.slice(start) ?? [], before);
  expect(Math.max(0, ...durations)).toBeLessThanOrEqual(200);
});

test("keeps the sphere nonblank and changes frames when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const canvas = page.locator("canvas[data-vortex-scene]");
  await expect(canvas).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.frames ?? 0), { timeout: 5_000 }).toBeGreaterThan(1);
  const firstFrame = await canvas.screenshot();
  await page.waitForTimeout(250);
  const secondFrame = await canvas.screenshot();
  expect(secondFrame.equals(firstFrame)).toBe(false);

  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const visibleFrame = await page.screenshot({ clip: bounds! });
  await canvas.evaluate((node) => {
    node.style.visibility = "hidden";
  });
  const frameWithoutCanvas = await page.screenshot({ clip: bounds! });
  expect(frameWithoutCanvas.equals(visibleFrame)).toBe(false);
});

test("holds a static reduced-motion frame and pauses after a hidden event", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("canvas[data-vortex-scene]")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.paused)).toBe(true);
  expect(await page.evaluate(() => window.__omniVortex?.frames)).toBe(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__omniVortex?.frames ?? 0), { timeout: 5_000 }).toBeGreaterThan(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const frames = await page.evaluate(() => window.__omniVortex?.frames);
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => window.__omniVortex?.paused)).toBe(true);
  expect(await page.evaluate(() => window.__omniVortex?.frames)).toBe(frames);
});
