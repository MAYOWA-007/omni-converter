import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_MEDIA_RECIPE_CONTRACTS } from "../../src/data/verifiedMediaRecipes";

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
  for (const id of ["audio-to-mp3", "video-to-gif"]) {
    expect(verified.has(id as never)).toBe(false);
    expect(CONVERSION_RECIPES.find((recipe) => recipe.id === id)?.runtimes).toEqual([]);
  }
});
