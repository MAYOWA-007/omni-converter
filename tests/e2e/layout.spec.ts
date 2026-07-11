import { expect, test, type Page } from "playwright/test";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 }
];

async function uploadPng(page: Page, name = "an exceptionally long source filename for responsive conversion layout validation.png") {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/png", buffer: PNG_BYTES });
}

async function choosePdf(page: Page) {
  await uploadPng(page);
  await page.getByRole("button", { name: "Image to PDF" }).click();
}

async function captureWorkflowStages(page: Page, prefix: string) {
  await page.locator("[data-vortex-scene]:visible").first().waitFor({ state: "visible", timeout: 5_000 });
  await page.screenshot({ path: `../.superpowers/sdd/${prefix}-drop.png` });
  await uploadPng(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `../.superpowers/sdd/${prefix}-choose.png` });
  await page.getByRole("button", { name: "Image to PDF" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `../.superpowers/sdd/${prefix}-edit.png` });

  await page.goto("/omni-converter/tests/e2e/harness.html?mode=delay");
  await page.locator("[data-harness-controls]").evaluate((node) => { (node as HTMLElement).style.display = "none"; });
  await choosePdf(page);
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByRole("heading", { name: "Preparing test output" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `../.superpowers/sdd/${prefix}-processing.png` });

  await page.goto("/omni-converter/tests/e2e/harness.html?mode=multi");
  await page.locator("[data-harness-controls]").evaluate((node) => { (node as HTMLElement).style.display = "none"; });
  await choosePdf(page);
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `../.superpowers/sdd/${prefix}-results.png` });
}

test.skip("records the pre-refinement workflow at target viewports", async ({ browser }) => {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto("/");
    await captureWorkflowStages(page, `task-7-before-${viewport.name}`);
    await page.close();
  }
});

test("records the refined workflow at target viewports", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto("/");
    await captureWorkflowStages(page, `task-7-after-${viewport.name}`);
    await page.close();
  }
});

test("keeps the top promise available without becoming a hit target", async ({ page }) => {
  await page.goto("/");
  const promise = page.getByText("Convert any file to any file", { exact: true });
  await expect(promise).toBeVisible();
  await expect(promise).toHaveCSS("pointer-events", "none");
  await uploadPng(page);
  await expect(promise).toBeVisible();
});

test("contains every workflow stage inside the viewport", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectViewportContainment(page);
    await uploadPng(page);
    await expect(page.getByRole("button", { name: "Image to PDF" })).toBeVisible();
    await expectViewportContainment(page);

    const clearNav = await page.evaluate(() => {
      const brand = document.querySelector<HTMLElement>(".brand")?.getBoundingClientRect();
      const back = document.querySelector<HTMLElement>(".back-button")?.getBoundingClientRect();
      return Boolean(brand && back && (brand.right <= back.left || back.right <= brand.left || brand.bottom <= back.top || back.bottom <= brand.top));
    });
    expect(clearNav).toBe(true);
    await page.getByRole("button", { name: "Image to PDF" }).click();
    const controls = page.locator(".control-surface");
    await expect(controls).toHaveAttribute("data-control-count", "6");
    await expect(controls).toHaveAttribute("data-columns", viewport.width === 390 ? "1" : "3");
    await expect(controls.getByRole("combobox")).toHaveCount(6);
    await expectViewportContainment(page);

    await page.goto("/omni-converter/tests/e2e/harness.html?mode=delay");
    await choosePdf(page);
    await page.getByRole("button", { name: "Convert" }).click();
    await expect(page.getByRole("heading", { name: "Preparing test output" })).toBeVisible();
    await expectViewportContainment(page);

    await page.goto("/omni-converter/tests/e2e/harness.html?mode=multi");
    await choosePdf(page);
    await page.getByRole("button", { name: "Convert" }).click();
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.locator(".result-output-list")).toBeVisible();
    await expectViewportContainment(page);
  }
});

async function expectViewportContainment(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth <= innerWidth,
    shell: document.querySelector(".app-shell")?.getBoundingClientRect().height === innerHeight,
    shellFits: document.querySelector(".app-shell")?.getBoundingClientRect().bottom === innerHeight
  }))).toEqual({ horizontal: true, shell: true, shellFits: true });
}
