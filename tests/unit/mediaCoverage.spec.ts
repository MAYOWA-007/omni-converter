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

const ROUND_TRIP_AUDIO_FORMATS = [
  "wav",
  "mp3",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "webm",
  "mka",
  "mov",
  "m4r",
  "aiff",
  "caf",
  "ac3",
  "eac3",
  "oga",
  "wma",
  "wv",
  "tta",
  "mp2",
  "au",
  "w64",
  "3gp"
] as const;

const ROUND_TRIP_VIDEO_FORMATS = ["mp4", "webm", "mov", "m4v", "mkv", "ts"] as const;

test("every verified media recipe has one executable browser fixture contract", () => {
  for (const contract of VERIFIED_MEDIA_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({ maturity: "verified", runtimes: ["browser"], implementation: "ready" });
    expect(recipe?.inputFormats).toEqual(expect.arrayContaining(contract.fixture === "sine-wav" ? ["wav", "mp3", "ogg", "flac", "aac", "m4a"] : ["mp4", "webm"]));
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("video GIF export is promoted with a bounded local contract", () => {
  const verified = new Set(VERIFIED_MEDIA_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
  expect(verified.has("video-to-gif")).toBe(true);
  expect(CONVERSION_RECIPES.find((recipe) => recipe.id === "video-to-gif")).toMatchObject({
    inputFormats: ROUND_TRIP_VIDEO_FORMATS,
    editorControls: ["trim", "resolution", "frameRate"],
    runtimes: ["browser"]
  });
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

test("every self-contained audio output can re-enter every verified audio path", () => {
  const audioRecipes = CONVERSION_RECIPES.filter((recipe) => recipe.maturity === "verified" && recipe.input.includes("audio"));

  expect(audioRecipes).toHaveLength(WAV_RECIPE_IDS.length);
  for (const recipe of audioRecipes) {
    expect(recipe.inputFormats, recipe.id).toEqual(expect.arrayContaining(ROUND_TRIP_AUDIO_FORMATS));
  }

  for (const format of ROUND_TRIP_AUDIO_FORMATS) {
    const recipes = browserRecipesForInspection({
      name: `Round trip.${format}`,
      extension: format,
      mime: "application/octet-stream",
      size: 128,
      family: "audio",
      exactFormat: format,
      signatureSource: "signature",
      notes: []
    });
    expect(recipes.map((recipe) => recipe.id), format).toEqual(expect.arrayContaining(WAV_RECIPE_IDS));
  }
});

test("every fixture-verified single-file video container enters every verified video path", () => {
  const videoRecipes = CONVERSION_RECIPES.filter((recipe) => recipe.maturity === "verified" && recipe.input.includes("video"));

  expect(videoRecipes).toHaveLength(6);
  for (const recipe of videoRecipes) {
    expect(recipe.inputFormats, recipe.id).toEqual(expect.arrayContaining(ROUND_TRIP_VIDEO_FORMATS));
    expect(recipe.inputFormats, recipe.id).not.toContain("m3u8");
  }
});
