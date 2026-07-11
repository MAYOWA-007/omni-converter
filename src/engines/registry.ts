import type { ConversionEngine } from "./types";
import type { ConversionRecipe, RecipeRuntime } from "../lib/types";

const engines = new Map<string, ConversionEngine>();

export function registerEngine(engine: ConversionEngine) {
  if (engines.has(engine.id)) {
    throw new Error(`A conversion engine is already registered with id "${engine.id}".`);
  }

  engines.set(engine.id, engine);
  return () => {
    if (engines.get(engine.id) === engine) {
      engines.delete(engine.id);
    }
  };
}

export function engineCanCancel(engine: ConversionEngine) {
  return engine.cancellation === "cooperative" || engine.cancellation === "hard";
}

export function engineForRecipe(recipe: ConversionRecipe, runtime: RecipeRuntime = "browser"): ConversionEngine {
  if (!recipe.runtimes.includes(runtime)) {
    throw new Error(`Recipe "${recipe.id}" is not available in runtime "${runtime}".`);
  }

  const matches = [...engines.values()].filter((engine) => engine.runtimes.includes(runtime) && engine.ownsRecipe(recipe));

  if (matches.length === 0) {
    throw new Error(`No conversion engine owns recipe "${recipe.id}".`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple conversion engines own recipe "${recipe.id}": ${matches.map((engine) => engine.id).join(", ")}.`);
  }

  return matches[0];
}
