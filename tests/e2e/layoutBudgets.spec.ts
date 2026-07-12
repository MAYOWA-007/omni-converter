import { expect, test } from "playwright/test";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("uses three columns for six controls at a wide viewport without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=controls-six");
  const surface = page.locator(".control-surface");
  await expect(surface).toHaveAttribute("data-control-count", "6");
  await expect(surface).toHaveAttribute("data-columns", "3");
  await expect(surface.getByRole("combobox")).toHaveCount(6);
  const measurements = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(".control-surface")?.getBoundingClientRect();
    const rows = [...document.querySelectorAll<HTMLElement>(".control-row")].map((row) => row.getBoundingClientRect());
    return {
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      surfaceWidth: surface?.width ?? 0,
      rowWidths: rows.map((row) => row.width),
      rowsInside: rows.every((row) => Boolean(surface && row.left >= surface.left && row.right <= surface.right))
    };
  });
  expect(measurements.pageFits).toBe(true);
  expect(measurements.surfaceWidth).toBeGreaterThanOrEqual(1080);
  expect(measurements.rowsInside).toBe(true);
  expect(Math.max(...measurements.rowWidths)).toBeLessThan(measurements.surfaceWidth / 2);
});

test("keeps a colored mobile image preview inside a compact result area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=multi");
  await page.locator('input[type="file"]').setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: PNG_BYTES });
  await page.getByRole("button", { name: "Image to PDF" }).click();
  await page.getByRole("button", { name: "Convert" }).click();
  const preview = page.locator(".output-preview-media");
  await expect(preview).toBeVisible();
  const bounds = await preview.boundingBox();
  expect(bounds?.height).toBeLessThanOrEqual(160);
  expect(bounds?.width).toBeLessThanOrEqual(358);

  await expect(page.getByRole("checkbox", { name: "Select first.png" })).toBeChecked();
  const saveSelected = page.getByRole("button", { name: "Save selected" });
  await expect(saveSelected).toBeEnabled();
  await expect(saveSelected).toHaveText("Save selected");
  const styles = await saveSelected.evaluate((element) => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      color: computed.color,
      backgroundImage: computed.backgroundImage,
      clipPath: computed.clipPath,
      opacity: computed.opacity,
      overflow: computed.overflow,
      visibility: computed.visibility,
      width: box.width,
      height: box.height
    };
  });
  expect(styles.color).toBe("rgb(255, 250, 240)");
  expect(styles.backgroundImage).toContain("linear-gradient");
  expect(styles.clipPath).toBe("none");
  expect(styles.opacity).toBe("1");
  expect(styles.overflow).toBe("visible");
  expect(styles.visibility).toBe("visible");
  expect(styles.width).toBeGreaterThan(0);
  expect(styles.height).toBeGreaterThan(0);
});
