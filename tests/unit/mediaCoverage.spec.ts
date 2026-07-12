import { expect, test } from "playwright/test";
import { browserRecipesForInspection } from "../../src/core/catalog";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_MEDIA_RECIPE_CONTRACTS } from "../../src/data/verifiedMediaRecipes";

const WAV_RECIPE_IDS = [
  "audio-to-wav",
  "audio-to-mp3",
  "audio-to-flac",
  "audio-to-m4a",
  "audio-to-aac",
  "audio-to-ogg",
  "audio-to-opus",
  "audio-to-webm",
  "audio-to-mka",
  "audio-to-mov",
  "audio-to-m4r",
  "audio-to-aiff",
  "audio-to-alac",
  "audio-to-caf",
  "audio-to-ac3",
  "audio-to-eac3",
  "audio-to-vorbis",
  "audio-to-wma",
  "audio-to-wavpack",
  "audio-to-tta",
  "audio-to-mp2",
  "audio-to-au",
  "audio-to-wave64",
  "audio-to-pcm",
  "audio-to-3gp",
  "audio-format-bundle",
  "audio-waveform",
  "audio-to-video"
] as const;

test("every verified media recipe has one executable browser fixture contract", () => {
  for (const contract of VERIFIED_MEDIA_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(recipe?.inputFormats).toEqual(expect.arrayContaining(contract.fixture === "sine-wav" ? ["wav", "mp3", "ogg", "flac", "aac", "m4a"] : ["mp4", "webm"]));
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("unverified media transforms remain outside the promoted contract set", () => {
  const verified = new Set(VERIFIED_MEDIA_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
  for (const id of ["video-to-gif"]) {
    expect(verified.has(id as never)).toBe(false);
    expect(CONVERSION_RECIPES.find((recipe) => recipe.id === id)?.runtimes).toEqual([]);
  }
});

test("a WAV upload exposes every locally executable audio container and derivative", () => {
  const recipes = browserRecipesForInspection({
    name: "Tone.wav",
    extension: "wav",
    mime: "audio/wav",
    size: 44,
    family: "audio",
    exactFormat: "wav",
    signatureSource: "signature",
    notes: []
  });

  expect(recipes.map((recipe) => recipe.id)).toEqual(expect.arrayContaining(WAV_RECIPE_IDS));
  expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(recipes.length);
});
