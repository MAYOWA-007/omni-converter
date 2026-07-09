import { canConvertImageRecipe, convertImageRecipe, downloadOutput, type ConversionOutput } from "./imageConversions";
import { canConvertPdfRecipe, convertPdfRecipe } from "./pdfConversions";
import type { ConversionRecipe, ConversionSettings, FileInspection } from "./types";

export { downloadOutput };
export type { ConversionOutput };

export function canRunRecipe(recipe: ConversionRecipe) {
  return recipe.implementation === "ready" && (canConvertImageRecipe(recipe) || canConvertPdfRecipe(recipe));
}

export async function convertRecipe(file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings = {}): Promise<ConversionOutput[]> {
  if (canConvertImageRecipe(recipe)) {
    return convertImageRecipe(file, inspection, recipe);
  }

  if (canConvertPdfRecipe(recipe)) {
    return convertPdfRecipe(file, inspection, recipe, settings);
  }

  throw new Error("This converter is not available yet.");
}
