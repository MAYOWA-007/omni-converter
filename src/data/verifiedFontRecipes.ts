import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedFontRecipeContract {
  recipeId: "font-web-pack" | "font-specimen";
  fixture: "omni-display-woff2";
  engineId: "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_FONT_RECIPE_CONTRACTS: readonly VerifiedFontRecipeContract[] = [
  {
    recipeId: "font-web-pack",
    fixture: "omni-display-woff2",
    engineId: "legacy-advanced",
    expectedExtensions: ["zip"],
    differentialControls: [],
    fixtureSettings: {}
  },
  {
    recipeId: "font-specimen",
    fixture: "omni-display-woff2",
    engineId: "legacy-advanced",
    expectedExtensions: ["png"],
    differentialControls: ["outputFormat"],
    fixtureSettings: { outputFormat: "PNG" }
  }
];

export const VERIFIED_FONT_RECIPE_IDS = new Set(VERIFIED_FONT_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
