import { expect, test } from "playwright/test";

test("a file-handler launch received before React effects reaches the normal workflow", async ({ page }) => {
  await page.addInitScript(() => {
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (character) => character.charCodeAt(0));
    const file = new File([bytes], "launched.png", { type: "image/png" });
    Object.defineProperty(window, "launchQueue", {
      configurable: true,
      value: {
        setConsumer(consumer: (params: { files: Array<{ kind: string; getFile: () => Promise<File> }> }) => void) {
          consumer({ files: [{ kind: "file", getFile: async () => file }] });
        }
      }
    });
  });

  await page.goto("/");

  await expect(page.getByText("launched.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Image to PDF" })).toBeVisible();
});
