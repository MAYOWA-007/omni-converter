import { expect, test } from "playwright/test";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("keyboard intake has one file-picker stop and restores focus at the catalog", async ({ page }) => {
  await page.goto("/");
  const dropTarget = page.getByLabel("Drop any file");
  await dropTarget.focus();
  await expect(dropTarget).toBeFocused();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "keyboard-intake.png", mimeType: "image/png", buffer: PNG_BYTES });

  const heading = page.getByRole("heading", { name: "What should it become?" });
  await expect(heading).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Search conversions" })).toBeFocused();
});

test("conversion choices expose complete accessible names and visible focus", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "accessible.png", mimeType: "image/png", buffer: PNG_BYTES });
  const choice = page.getByRole("button", { name: /Image to PDF/ });
  await choice.focus();
  await expect(choice).toBeFocused();
  await expect(choice).toHaveCSS("outline-style", "solid");
});

test("reduced motion removes decorative animation without hiding the drop action", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("Drop any file")).toBeVisible();
  const animation = await page.locator(".drop-copy").evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});
