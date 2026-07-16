import { legacyEngines } from "../engines/legacyAdapter";
import { engineForRecipe, registerEngine } from "../engines/registry";
import type { EngineProgressReporter } from "../engines/types";
import { deriveRecipeAvailability } from "../core/recipeAvailability";
import { saveOutput, saveOutputBundle } from "../core/export";
import type { ConversionOutput } from "./imageConversions";
import type { ConversionRecipe, ConversionSettings, FileInspection, RecipeRuntime } from "./types";

export { saveOutput, saveOutputBundle };
export type { ConversionOutput };

export interface ConversionExecutionContext {
  signal?: AbortSignal;
  reportProgress?: EngineProgressReporter;
}

const noopProgress: EngineProgressReporter = () => {};

for (const engine of legacyEngines) {
  registerEngine(engine);
}

export function canRunRecipe(recipe: ConversionRecipe, runtime: RecipeRuntime = "browser") {
  if (recipe.implementation !== "ready" || !deriveRecipeAvailability(recipe, runtime).selectable) {
    return false;
  }

  try {
    engineForRecipe(recipe, runtime);
    return true;
  } catch {
    return false;
  }
}

export async function convertRecipe(
  file: File,
  inspection: FileInspection,
  recipe: ConversionRecipe,
  settings: ConversionSettings = {},
  execution: ConversionExecutionContext | AbortSignal = {}
): Promise<ConversionOutput[]> {
  const { signal, reportProgress } = normalizeExecutionContext(execution);
  return engineForRecipe(recipe).convert({
    file,
    inspection,
    recipe,
    settings,
    signal: signal ?? new AbortController().signal,
    reportProgress: reportProgress ?? noopProgress
  });
}

function normalizeExecutionContext(execution: ConversionExecutionContext | AbortSignal) {
  return "aborted" in execution ? { signal: execution } : execution;
}
