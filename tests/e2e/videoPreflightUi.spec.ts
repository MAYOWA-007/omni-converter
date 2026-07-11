import { expect, test } from "playwright/test";

test("video settings immediately update device availability", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/harness.html?mode=video-preflight");

  const convert = page.getByRole("button", { name: "Unavailable" });
  await expect(convert).toBeDisabled();
  await expect(page.getByText("This output is too large for the current browser export path.")).toBeVisible();

  await page.getByLabel("Trim").selectOption("First 30 seconds");
  await page.getByLabel("Compression").selectOption("Small file");

  await expect(page.getByRole("button", { name: "Convert" })).toBeEnabled();
  await expect(page.getByText(/Estimated on this device: Usually under 1 minute/i)).toBeVisible();
});
