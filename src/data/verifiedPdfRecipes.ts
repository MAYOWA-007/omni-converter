import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedPdfRecipeContract {
  recipeId: string;
  fixture: "mixed-four-page-pdf";
  engineId: "legacy-pdf" | "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_PDF_RECIPE_CONTRACTS: readonly VerifiedPdfRecipeContract[] = [
  contract("pdf-to-text", "legacy-pdf", ["txt"], ["pageOrder", "metadata", "batchNaming"], { pageOrder: "Odd pages", metadata: "Add page headings", batchNaming: "TXT suffix" }),
  contract("pdf-to-markdown", "legacy-pdf", ["md"], ["pageOrder", "metadata", "batchNaming"], { pageOrder: "Reverse order", metadata: "Minimal headings", batchNaming: "Markdown suffix" }),
  contract("pdf-to-html", "legacy-pdf", ["html"], ["pageOrder", "metadata", "batchNaming"], { pageOrder: "Last page", metadata: "Minimal", batchNaming: "HTML suffix" }),
  contract("pdf-page-png-set", "legacy-pdf", ["zip"], ["pageOrder", "resolution", "batchNaming", "bundle"], { pageOrder: "Odd pages", resolution: "96 DPI", batchNaming: "Page number only", bundle: "Balanced ZIP with manifest" }),
  contract("pdf-page-jpeg-set", "legacy-pdf", ["zip"], ["pageOrder", "resolution", "compression", "batchNaming", "bundle"], { pageOrder: "First page", resolution: "150 DPI", compression: "Small file", batchNaming: "Page number only", bundle: "Store ZIP" }),
  contract("pdf-split-pages", "legacy-pdf", ["zip"], ["pageOrder", "batchNaming", "bundle"], { pageOrder: "Even pages", batchNaming: "Page number only", bundle: "Maximum ZIP with manifest" }),
  contract("pdf-extract-pages", "legacy-pdf", ["pdf"], ["pageOrder", "metadata", "batchNaming"], { pageOrder: "Odd pages", metadata: "Keep document details", batchNaming: "Extracted suffix" }),
  contract("pdf-reorder-pages", "legacy-pdf", ["pdf"], ["pageOrder", "metadata", "batchNaming"], { pageOrder: "Odd pages, then even pages", metadata: "Keep document details", batchNaming: "Reordered suffix" }),
  contract("pdf-rotate-pages", "legacy-pdf", ["pdf"], ["pageOrder", "rotation", "metadata", "batchNaming"], { pageOrder: "Odd pages", rotation: "90 degrees clockwise", metadata: "Keep document details", batchNaming: "Rotated suffix" }),
  contract("pdf-metadata-report", "legacy-pdf", ["json"], ["metadata", "batchNaming"], { metadata: "Document info only", batchNaming: "Clean filename" }),
  contract("pdf-slide-images", "legacy-advanced", ["zip"], ["pageOrder", "aspectRatio", "resolution", "color", "batchNaming", "bundle"], { pageOrder: "First 2 pages", aspectRatio: "4:3 classic slides", resolution: "1024 px wide", color: "Black letterbox", batchNaming: "Page number only", bundle: "Balanced ZIP with manifest" }),
  contract("pdf-pptx-outline", "legacy-advanced", ["pptx"], ["pageOrder", "metadata", "batchNaming", "bundle"], { pageOrder: "Even pages", metadata: "Include source note", batchNaming: "Outline suffix", bundle: "Maximum compression" }),
  contract("pdf-carousel-images", "legacy-advanced", ["zip"], ["pageOrder", "aspectRatio", "resolution", "crop", "batchNaming", "bundle"], { pageOrder: "First 2 pages", aspectRatio: "1:1 square", resolution: "1080 px wide", crop: "Fill target", batchNaming: "Page number only", bundle: "Balanced ZIP with manifest" }),
  contract("pdf-handout-pdf", "legacy-advanced", ["pdf"], ["pageOrder", "pageLayout", "pageSize", "margins", "metadata", "batchNaming"], { pageOrder: "All pages", pageLayout: "2 pages per sheet", pageSize: "A4", margins: "Narrow", metadata: "Keep document details", batchNaming: "Handout suffix" }),
  contract("pdf-compress", "legacy-advanced", ["pdf"], ["compression", "metadata", "batchNaming"], { compression: "Smallest visual flattening (96 DPI)", metadata: "Strip document details", batchNaming: "Optimized suffix" })
];

export const VERIFIED_PDF_RECIPE_IDS = new Set(VERIFIED_PDF_RECIPE_CONTRACTS.map((contractEntry) => contractEntry.recipeId));

function contract(
  recipeId: string,
  engineId: VerifiedPdfRecipeContract["engineId"],
  expectedExtensions: readonly string[],
  differentialControls: readonly EditorControl[],
  fixtureSettings: ConversionSettings
): VerifiedPdfRecipeContract {
  return { recipeId, fixture: "mixed-four-page-pdf", engineId, expectedExtensions, differentialControls, fixtureSettings };
}
