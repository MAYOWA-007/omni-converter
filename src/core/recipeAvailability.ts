import type { ConversionRecipe, FileInspection, RecipeAvailability, RecipeRuntime } from "../lib/types";

type AvailabilityRecipe = Pick<ConversionRecipe, "maturity"> & Partial<Pick<ConversionRecipe, "runtimes">>;

export function deriveRecipeAvailability(recipe: AvailabilityRecipe, runtime: RecipeRuntime): RecipeAvailability {
  return {
    maturity: recipe.maturity,
    runtime,
    selectable: recipe.maturity === "verified" && recipe.runtimes?.includes(runtime) === true
  };
}

export function recipeSupportsInspection(recipe: Pick<ConversionRecipe, "inputFormats">, inspection: FileInspection) {
  if (!recipe.inputFormats?.length) return true;
  const detected = inspection.exactFormat && inspection.exactFormat !== "unknown" ? inspection.exactFormat : inspection.extension;
  return recipe.inputFormats.includes(detected.toLowerCase());
}
