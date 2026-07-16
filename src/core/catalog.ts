import * as conversionCatalog from "../data/conversionMatrix";
import type { ConversionRecipe, FileFamily, FileInspection, RecipeAvailability, RecipeRuntime } from "../lib/types";

type AvailabilityRecipe = Pick<ConversionRecipe, "maturity"> & Partial<Pick<ConversionRecipe, "runtimes">>;
type ConversionMatrix = typeof import("../data/conversionMatrix");
export type LoadedConversionCatalog = ConversionMatrix & {
  browserRecipesForInspection: typeof browserRecipesForInspection;
};

let catalogPromise: Promise<LoadedConversionCatalog> | null = null;

export function loadConversionCatalog() {
  catalogPromise ??= Promise.resolve({ ...conversionCatalog, browserRecipesForInspection });
  return catalogPromise;
}

export function deriveRecipeAvailability(recipe: AvailabilityRecipe, runtime: RecipeRuntime): RecipeAvailability {
  return {
    maturity: recipe.maturity,
    runtime,
    selectable: recipe.maturity === "verified" && recipe.runtimes?.includes(runtime) === true
  };
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

export function recipeSupportsInspection(recipe: Pick<ConversionRecipe, "inputFormats">, inspection: FileInspection) {
  if (!recipe.inputFormats?.length) return true;
  const detected = inspection.exactFormat && inspection.exactFormat !== "unknown" ? inspection.exactFormat : inspection.extension;
  return recipe.inputFormats.includes(detected.toLowerCase());
}
