import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedOfficeRecipeContract {
  recipeId: string;
  fixture: "semantic-docx" | "notes-pptx";
  engineId: "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_OFFICE_RECIPE_CONTRACTS: readonly VerifiedOfficeRecipeContract[] = [
  contract("document-to-markdown", "semantic-docx", ["md"], ["metadata", "batchNaming"], { metadata: "Content only", batchNaming: "Converted suffix" }),
  contract("document-to-html", "semantic-docx", ["html"], ["metadata", "batchNaming"], { metadata: "Embed images", batchNaming: "Converted suffix" }),
  contract("document-assets", "semantic-docx", ["zip"], ["metadata", "batchNaming", "bundle"], { metadata: "Include manifest", batchNaming: "Assets suffix", bundle: "Balanced ZIP" }),
  contract("presentation-notes", "notes-pptx", ["md"], ["outputFormat", "slideSelection", "metadata", "batchNaming"], { outputFormat: "Markdown", slideSelection: "All slides", metadata: "Visible text + speaker notes", batchNaming: "Notes suffix" }),
  contract("presentation-images", "notes-pptx", ["zip"], ["metadata", "batchNaming", "bundle"], { metadata: "Include manifest", batchNaming: "Images suffix", bundle: "Balanced ZIP" }),
  contract("presentation-audio", "notes-pptx", ["zip"], ["metadata", "batchNaming", "bundle"], { metadata: "Include manifest", batchNaming: "Audio suffix", bundle: "Balanced ZIP" }),
  contract("presentation-video", "notes-pptx", ["zip"], ["metadata", "batchNaming", "bundle"], { metadata: "Include manifest", batchNaming: "Video suffix", bundle: "Balanced ZIP" }),
  contract("presentation-assets", "notes-pptx", ["zip"], ["metadata", "batchNaming", "bundle"], { metadata: "Include manifest", batchNaming: "Assets suffix", bundle: "Balanced ZIP" })
];

export const VERIFIED_OFFICE_RECIPE_IDS = new Set(VERIFIED_OFFICE_RECIPE_CONTRACTS.map((contractEntry) => contractEntry.recipeId));

function contract(
  recipeId: string,
  fixture: VerifiedOfficeRecipeContract["fixture"],
  expectedExtensions: readonly string[],
  differentialControls: readonly EditorControl[],
  fixtureSettings: ConversionSettings
): VerifiedOfficeRecipeContract {
  return { recipeId, fixture, engineId: "legacy-advanced", expectedExtensions, differentialControls, fixtureSettings };
}
