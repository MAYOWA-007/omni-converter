import * as conversionCatalog from "../data/conversionMatrix";
import type { ConversionRecipe, FileFamily, FileInspection, RecipeRuntime } from "../lib/types";
import { deriveRecipeAvailability, recipeSupportsInspection } from "./recipeAvailability";
type ConversionMatrix = typeof import("../data/conversionMatrix");
export type LoadedConversionCatalog = ConversionMatrix & {
  browserRecipesForInspection: typeof browserRecipesForInspection;
};

let catalogPromise: Promise<LoadedConversionCatalog> | null = null;

export function loadConversionCatalog() {
  catalogPromise ??= Promise.resolve({ ...conversionCatalog, browserRecipesForInspection });
  return catalogPromise;
}

export function verifiedRecipesForFamily(family: FileFamily, runtime: RecipeRuntime): ConversionRecipe[] {
  return conversionCatalog.CONVERSION_RECIPES.filter(
    (recipe) =>
      (recipe.input.includes(family) || recipe.input.includes("unknown")) && deriveRecipeAvailability(recipe, runtime).selectable
  );
}

export function browserRecipesForFamily(family: FileFamily): ConversionRecipe[] {
  return verifiedRecipesForFamily(family, "browser");
}

export function browserRecipesForInspection(inspection: FileInspection): ConversionRecipe[] {
  return browserRecipesForFamily(inspection.family).filter((recipe) => recipeSupportsInspection(recipe, inspection));
}

export { deriveRecipeAvailability, recipeSupportsInspection };
