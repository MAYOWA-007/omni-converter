import { expect, test } from "playwright/test";

test("reports the browser media encoders used by local audio-video export", async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
  expect(await page.evaluate(() => window.__omniMediaHarness.probeEncoders())).toEqual({
    mp4Video: "avc",
    mp4Audio: "aac",
    webmVideo: expect.stringMatching(/^vp[89]$/),
    webmAudio: "opus"
  });
});
