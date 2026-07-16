import { expect, test } from "playwright/test";

type ImageFixtureId = "jpeg" | "gif" | "webp" | "bmp";

interface ImageFixtureResult {
  source: { width: number; height: number; checksum: number; header: number[] };
  output: {
    name: string;
    type: string;
    bytes: number[];
    validation?: { valid: boolean; detectedFormat: string };
  };
  decoded: { width: number; height: number; checksum: number; header: number[] };
}

const FIXTURES: readonly ImageFixtureId[] = ["jpeg", "gif", "webp", "bmp"];

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/image-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

for (const fixtureId of FIXTURES) {
  test(`${fixtureId.toUpperCase()} input decodes locally and converts to a validated PNG`, async ({ page }) => {
    const result = await page.evaluate(async (id) => {
      const harness = (window as unknown as {
        __omniImageHarness: { runImageInputFixture(fixtureId: ImageFixtureId): Promise<ImageFixtureResult> };
      }).__omniImageHarness;
      return harness.runImageInputFixture(id);
    }, fixtureId);

    expect(result.source.width).toBe(8);
    expect(result.source.height).toBe(6);
    expect(result.source.checksum).toBeGreaterThan(0);
    expect(result.output.name).toBe(`pattern-${fixtureId}.png`);
    expect(result.output.type).toBe("image/png");
    expect(result.output.validation).toEqual({ valid: true, detectedFormat: "png" });
    expect(result.decoded).toMatchObject({ width: 8, height: 6, checksum: result.source.checksum });
    expect(result.decoded.header.slice(0, 8)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
}
