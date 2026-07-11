import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedArchiveRecipeContract {
  recipeId: string;
  fixture: "mixed-zip" | "minimal-exe";
  engineId: "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_ARCHIVE_RECIPE_CONTRACTS: readonly VerifiedArchiveRecipeContract[] = [
  contract("archive-inspect", "mixed-zip", ["json"], ["metadata", "batchNaming"], { metadata: "File list", batchNaming: "Report suffix" }),
  contract("archive-extract", "mixed-zip", ["zip"], ["archiveSelection", "metadata", "compression", "batchNaming"], { archiveSelection: "Images", metadata: "Include manifest", compression: "Balanced ZIP", batchNaming: "Extracted suffix" }),
  contract("archive-repack-zip", "mixed-zip", ["zip"], ["metadata", "compression", "batchNaming"], { metadata: "Remove OS junk + manifest", compression: "Maximum ZIP", batchNaming: "Repacked suffix" }),
  contract("application-compress-zip", "minimal-exe", ["zip", "json"], ["compression", "batchNaming"], { compression: "Maximum ZIP", batchNaming: "Compressed suffix" })
];

export const VERIFIED_ARCHIVE_RECIPE_IDS = new Set(VERIFIED_ARCHIVE_RECIPE_CONTRACTS.map((contractEntry) => contractEntry.recipeId));

function contract(
  recipeId: string,
  fixture: VerifiedArchiveRecipeContract["fixture"],
  expectedExtensions: readonly string[],
  differentialControls: readonly EditorControl[],
  fixtureSettings: ConversionSettings
): VerifiedArchiveRecipeContract {
  return { recipeId, fixture, engineId: "legacy-advanced", expectedExtensions, differentialControls, fixtureSettings };
}
