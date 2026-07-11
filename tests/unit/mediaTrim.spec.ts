import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_MEDIA_RECIPE_IDS } from "../../src/data/verifiedMediaRecipes";
import { resolveMediaTrimRange } from "../../src/lib/mediaTrim";

test("resolves full-file and preset media ranges against actual duration", () => {
  expect(resolveMediaTrimRange({ trim: "Full file" }, 12.5)).toEqual({ start: 0, end: 12.5, duration: 12.5 });
  expect(resolveMediaTrimRange({ trim: "First 5 seconds" }, 12.5)).toEqual({ start: 0, end: 5, duration: 5 });
  expect(resolveMediaTrimRange({ trim: "First 30 seconds" }, 12.5)).toEqual({ start: 0, end: 12.5, duration: 12.5 });
});

test("preserves precise custom bounds and clamps them to the source", () => {
  expect(resolveMediaTrimRange({ trim: "Custom range", trimStart: 3.125, trimEnd: 8.875 }, 12.5)).toEqual({
    start: 3.125,
    end: 8.875,
    duration: 5.75
  });
  expect(resolveMediaTrimRange({ trim: "Custom range", trimStart: -2, trimEnd: 20 }, 12.5)).toEqual({
    start: 0,
    end: 12.5,
    duration: 12.5
  });
});

test("rejects non-positive sources and invalid custom ranges", () => {
  expect(() => resolveMediaTrimRange({ trim: "Full file" }, 0)).toThrow(/positive duration/i);
  expect(() => resolveMediaTrimRange({ trim: "Custom range", trimStart: 4, trimEnd: 4 }, 12)).toThrow(/end.*after.*start/i);
  expect(() => resolveMediaTrimRange({ trim: "Custom range", trimStart: Number.NaN, trimEnd: 5 }, 12)).toThrow(/finite/i);
});

test("every promoted media recipe with trim controls exposes the precise range option", () => {
  const recipes = CONVERSION_RECIPES.filter((recipe) => VERIFIED_MEDIA_RECIPE_IDS.has(recipe.id as never) && recipe.editorControls.includes("trim"));
  expect(recipes.length).toBeGreaterThan(0);
  for (const recipe of recipes) {
    expect(recipe.controlOptions?.trim, recipe.id).toContain("Custom range");
  }
});
