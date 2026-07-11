import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedEbookRecipeContract {
  recipeId: "ebook-to-text";
  fixture: "spine-epub";
  engineId: "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_EBOOK_RECIPE_CONTRACTS: readonly VerifiedEbookRecipeContract[] = [{
  recipeId: "ebook-to-text",
  fixture: "spine-epub",
  engineId: "legacy-advanced",
  expectedExtensions: ["md"],
  differentialControls: ["outputFormat", "metadata", "batchNaming", "bundle"],
  fixtureSettings: {
    outputFormat: "Markdown",
    metadata: "Include chapter labels",
    batchNaming: "Converted suffix",
    bundle: "Balanced ZIP"
  }
}];

export const VERIFIED_EBOOK_RECIPE_IDS = new Set(VERIFIED_EBOOK_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
