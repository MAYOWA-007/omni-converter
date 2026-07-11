import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedImageRecipeContract {
  recipeId: string;
  fixture: "transparent-quadrants-png";
  engineId: "legacy-image";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_IMAGE_RECIPE_CONTRACTS: readonly VerifiedImageRecipeContract[] = [
  {
    recipeId: "image-to-pdf",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["pdf"],
    differentialControls: ["pageSize", "margins", "crop", "compression", "metadata", "batchNaming"],
    fixtureSettings: { pageSize: "Original image size at 96 PPI", margins: "None", crop: "Fit entire source", compression: "Maximum quality", metadata: "Keep source filename", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-print-pdf",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["pdf"],
    differentialControls: ["pageSize", "margins", "crop", "compression", "metadata", "batchNaming"],
    fixtureSettings: { pageSize: "Letter", margins: "Standard", crop: "Fit entire source", compression: "Maximum quality", metadata: "Keep source filename", batchNaming: "Print suffix" }
  },
  {
    recipeId: "image-to-png",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["png"],
    differentialControls: ["resolution", "crop", "color", "batchNaming"],
    fixtureSettings: { resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-to-jpeg",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["jpg"],
    differentialControls: ["resolution", "crop", "color", "compression", "batchNaming"],
    fixtureSettings: { resolution: "Original", crop: "Fit entire source", color: "White matte", compression: "Maximum quality", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-to-webp",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["webp"],
    differentialControls: ["resolution", "crop", "color", "compression", "batchNaming"],
    fixtureSettings: { resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", compression: "Maximum quality", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-to-bmp",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["bmp"],
    differentialControls: ["resolution", "crop", "color", "batchNaming"],
    fixtureSettings: { resolution: "Original", crop: "Fit entire source", color: "White matte", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-svg-wrapper",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["svg"],
    differentialControls: ["resolution", "batchNaming"],
    fixtureSettings: { resolution: "Original", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-data-uri",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["txt"],
    differentialControls: ["batchNaming"],
    fixtureSettings: { batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-html-embed",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["html"],
    differentialControls: ["resolution", "batchNaming"],
    fixtureSettings: { resolution: "Original", batchNaming: "Keep source name" }
  },
  {
    recipeId: "image-thumbnail-set",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["zip"],
    differentialControls: ["outputFormat", "resolution", "compression", "batchNaming", "bundle"],
    fixtureSettings: { outputFormat: "WebP", resolution: "160/320/640 set", compression: "Balanced", batchNaming: "Width suffix", bundle: "Balanced ZIP" }
  },
  {
    recipeId: "image-favicon-set",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["zip"],
    differentialControls: ["crop", "resolution", "batchNaming", "bundle"],
    fixtureSettings: { crop: "Fit inside transparent square", resolution: "Browser-only set", batchNaming: "Source and size", bundle: "Balanced ZIP" }
  },
  {
    recipeId: "image-format-bundle",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["zip"],
    differentialControls: ["outputFormat", "resolution", "crop", "color", "compression", "batchNaming", "bundle"],
    fixtureSettings: { outputFormat: "PNG + JPEG + WebP", resolution: "Original", crop: "Fit entire source", color: "Preserve transparency", compression: "Balanced", batchNaming: "Keep source name", bundle: "Balanced ZIP" }
  },
  {
    recipeId: "image-social-pack",
    fixture: "transparent-quadrants-png",
    engineId: "legacy-image",
    expectedExtensions: ["zip"],
    differentialControls: ["outputFormat", "aspectRatio", "crop", "resolution", "compression", "batchNaming", "bundle"],
    fixtureSettings: { outputFormat: "JPEG", aspectRatio: "Square only", crop: "Fill frame", resolution: "Half-size preview", compression: "Balanced", batchNaming: "Platform names", bundle: "Balanced ZIP" }
  }
];

export const VERIFIED_IMAGE_RECIPE_IDS = new Set(VERIFIED_IMAGE_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
