import type { ConversionOutput } from "../lib/imageConversions";
import type { ConversionRecipe, ConversionSettings, FileInspection, RecipeRuntime } from "../lib/types";

export interface EngineProgress {
  completed?: number;
  total?: number;
  label?: string;
}

export type EngineProgressReporter = (progress: EngineProgress) => void;

export type EngineCancellationCapability = "none" | "cooperative" | "hard";

export interface EngineContext {
  file: File;
  inspection: FileInspection;
  recipe: ConversionRecipe;
  settings: ConversionSettings;
  signal: AbortSignal;
  reportProgress: EngineProgressReporter;
}

export type LegacyExecutionContext = EngineContext;

export type EngineResult = ConversionOutput[];

export interface ConversionEngine {
  id: string;
  runtimes: readonly RecipeRuntime[];
  cancellation: EngineCancellationCapability;
  ownsRecipe: (recipe: ConversionRecipe) => boolean;
  convert: (context: EngineContext) => Promise<EngineResult>;
}
