import { expect, test } from "playwright/test";

const fixtures = ["video-webm", "video-mp4"] as const;

const recipes = [
  {
    id: "video-to-frames",
    extension: ".zip",
    settings: {
      outputFormat: "JPEG",
      trim: "First 1 second",
      frameInterval: "Every 1 second",
      resolution: "80 px wide",
      compression: "Small file",
      metadata: "Files only",
      batchNaming: "Sequence names",
      bundle: "Store ZIP"
    }
  },
  {
    id: "video-thumbnail-sheet",
    extension: ".jpg",
    settings: {
      outputFormat: "JPEG",
      trim: "First 1 second",
      pageLayout: "2 x 2 grid",
      crop: "Fit inside cells",
      resolution: "800 px wide",
      metadata: "No timestamps",
      batchNaming: "Clean filename"
    }
  },
  {
    id: "video-to-mp4",
    extension: ".mp4",
    settings: {
      trim: "First 1 second",
      aspectRatio: "Original",
      crop: "Fit inside",
      resolution: "Source resolution",
      frameRate: "Source frame rate",
      compression: "Balanced",
      metadata: "Strip tags",
      batchNaming: "Converted suffix"
    }
  },
  {
    id: "video-to-webm",
    extension: ".webm",
    settings: {
      trim: "First 1 second",
      aspectRatio: "Original",
      crop: "Fit inside",
      resolution: "Source resolution",
      frameRate: "Source frame rate",
      compression: "Balanced",
      metadata: "Strip tags",
      batchNaming: "Converted suffix"
    }
  },
  {
    id: "video-to-audio",
    extension: ".wav",
    settings: {
      outputFormat: "WAV",
      trim: "First 1 second",
      sampleRate: "Source sample rate",
      audioChannels: "Source channels",
      compression: "Balanced",
      metadata: "Strip tags",
      batchNaming: "Audio suffix"
    }
  }
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/omni-converter/tests/e2e/media-harness.html");
  await expect(page.locator("#status")).toHaveText("ready");
});

for (const fixtureId of fixtures) {
  for (const recipe of recipes) {
    test(`${recipe.id} accepts ${fixtureId}`, async ({ page }) => {
      const result = await page.evaluate(
        ({ id, fixture, settings }) => window.__omniMediaHarness.runVideoFixture(id, fixture, settings),
        { id: recipe.id, fixture: fixtureId, settings: recipe.settings }
      );

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].name).toMatch(new RegExp(`${recipe.extension.replace(".", "\\.")}$`, "i"));
      expect(result.outputs[0].validation.valid).toBe(true);

      if (recipe.id === "video-to-frames") {
        const entries = await page.evaluate((bytes) => window.__omniMediaHarness.unzip(bytes), result.outputs[0].bytes);
        expect(entries).toHaveLength(1);
        expect(await page.evaluate((entry) => window.__omniMediaHarness.inspectRaster(entry.bytes, "image/jpeg"), entries[0])).toEqual({ width: 80, height: 45 });
      } else if (recipe.id === "video-thumbnail-sheet") {
        expect(await page.evaluate((output) => window.__omniMediaHarness.inspectRaster(output.bytes, output.type), result.outputs[0])).toEqual({ width: 800, height: 450 });
      } else {
        const facts = await page.evaluate(
          (output) => window.__omniMediaHarness.inspectOutputMedia(output.bytes, output.name, output.type),
          result.outputs[0]
        );
        expect(facts.readable).toBe(true);
        if (recipe.id === "video-to-audio") {
          expect(facts.audioCodec).toBe("pcm-s16");
          expect(facts.videoCodec).toBeUndefined();
        } else {
          expect(facts.videoCodec).toMatch(recipe.id === "video-to-mp4" ? /^avc$/ : /^vp[89]$/);
          expect(facts.audioCodec).toBe(recipe.id === "video-to-mp4" ? "aac" : "opus");
        }
      }
    });
  }
}
