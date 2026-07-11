import { expect, test, type Page } from "playwright/test";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function uploadPng(page: Page, name = "pixel.png") {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG_BYTES
  });
}

async function chooseImagePdf(page: Page) {
  await uploadPng(page);
  await expect(page.getByRole("button", { name: "Image to PDF" })).toBeVisible();
  await page.getByRole("button", { name: "Image to PDF" }).click();
  await page.getByRole("button", { name: "Convert" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("converts a real PNG into a validated PDF and saves only after an explicit action", async ({ page }) => {
  let downloads = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined });
  });
  page.on("download", () => {
    downloads += 1;
  });

  await page.goto("/");
  await chooseImagePdf(page);
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Results" })).toBeFocused();
  await expect(page.getByText("pixel.pdf")).toBeVisible();
  await expect(page.getByText(/PDF \/ .* \/ Validated/)).toBeVisible();
  expect(downloads).toBe(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save pixel.pdf" }).click();
  await download;
  expect(downloads).toBe(1);
});

test("a corrupt PNG reaches a failed result without a save action", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: PNG_BYTES.subarray(0, 16)
  });

  const firstFailure = await page.getByRole("heading", { name: "Conversion failed" }).elementHandle();
  expect(firstFailure).not.toBeNull();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => firstFailure?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.getByRole("heading", { name: "Conversion failed" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator('input[type="file"]')).toBeVisible();
});

test("a cooperative engine can be canceled and never exposes its late output", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=cancel");
  await chooseImagePdf(page);
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("abort-count")).toHaveText("1");
  await expect(page.getByRole("heading", { name: "Canceling" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conversion canceled" })).toBeVisible();
  await expect(page.getByText("late.pdf")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("a failing engine produces a serialized failure with retry and back actions", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=fail");
  await chooseImagePdf(page);
  await expect(page.getByRole("heading", { name: "Conversion failed" })).toBeVisible();
  await expect(page.getByText("TestEngineError: Test conversion failed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
});

test("the production legacy engine does not offer cancellation", async ({ page }) => {
  await page.goto("/");
  await chooseImagePdf(page);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("the workflow stays contained on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await uploadPng(page);
  await expect(page.getByRole("button", { name: "Image to PDF" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("link", { name: "Omni Converter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New file" })).toBeVisible();
  const overlap = await page.evaluate(() => {
    const brand = document.querySelector<HTMLElement>(".brand")!.getBoundingClientRect();
    const back = document.querySelector<HTMLElement>(".back-button")!.getBoundingClientRect();
    return brand.right <= back.left || back.right <= brand.left || brand.bottom <= back.top || back.bottom <= brand.top;
  });
  expect(overlap).toBe(true);
  await page.getByRole("button", { name: "Image to PDF" }).click();
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("replacing a delayed cooperative workflow aborts active work", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=delay");
  await chooseImagePdf(page);
  await expect(page.getByRole("heading", { name: "Preparing test output" })).toBeVisible();
  await page.getByRole("button", { name: "Replace workflow" }).click();
  await expect(page.getByTestId("abort-count")).toHaveText("1");
  await expect(page.locator('input[type="file"]')).toBeVisible();
});

test("delayed mobile processing reports progress and elapsed time without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=delay");
  await chooseImagePdf(page);
  await expect(page.getByRole("heading", { name: "Preparing test output" })).toBeFocused();
  await expect(page.getByRole("progressbar", { name: "Conversion progress" })).toHaveAttribute("value", "30");
  await expect(page.getByText("0:01", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("a failed cooperative attempt retries to a validated result", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=fail-once");
  await chooseImagePdf(page);
  await expect(page.getByRole("heading", { name: "Conversion failed" })).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.getByText("fresh.png")).toBeVisible();
});

test("hostile HTML preview is presented as inert text", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=hostile");
  await chooseImagePdf(page);
  await expect(page.locator(".output-preview-text")).toContainText("window.__hostileExecuted = true");
  await expect.poll(() => page.evaluate(() => (window as Window & { __hostileExecuted?: boolean }).__hostileExecuted === true)).toBe(false);
});

test("results show size comparison and selected-output controls", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=multi");
  await chooseImagePdf(page);
  await expect(page.getByText(/Source: .*Total output:/)).toBeVisible();
  await page.getByRole("button", { name: "Select none" }).click();
  await expect(page.getByRole("button", { name: "Save selected" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select first.png" }).check();
  await expect(page.getByRole("button", { name: "Save selected" })).toBeEnabled();
});

test("replacement during pending engine preparation creates no controller or stale job", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=prepare-delay");
  await chooseImagePdf(page);
  await expect(page.getByTestId("preparation-count")).toHaveText("1");
  await page.getByRole("button", { name: "Replace workflow" }).click();
  await page.getByRole("button", { name: "Release preparation" }).click();
  await expect(page.getByTestId("prepared-count")).toHaveText("1");
  await expect(page.getByTestId("controller-count")).toHaveText("0");
  await expect(page.getByTestId("job-count")).toHaveText("0");
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Results" })).toHaveCount(0);
});

test("folder write failure is reported without an unhandled rejection", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=folder-write-fail");
  await chooseImagePdf(page);
  await expect(page.getByRole("button", { name: "Save folder" })).toBeVisible();
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.locator(".result-save-message")).toHaveText("Harness folder write failed.");
  await expect(page.getByTestId("unhandled-count")).toHaveText("0");
});
