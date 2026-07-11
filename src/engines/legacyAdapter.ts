import { canConvertAdvancedRecipe, convertAdvancedRecipe } from "../lib/advancedConversions";
import { canConvertImageRecipe, convertImageRecipe } from "../lib/imageConversions";
import { canConvertPdfRecipe, convertPdfRecipe } from "../lib/pdfConversions";
import { canConvertMediaRecipe, convertMediaRecipe } from "../lib/mediaConversions";
import type { ConversionRecipe, ConversionSettings, FileInspection, RecipeRuntime } from "../lib/types";
import type { ConversionEngine, EngineCancellationCapability, EngineResult, LegacyExecutionContext } from "./types";

type LegacyConverter = (file: File, inspection: FileInspection, recipe: ConversionRecipe, settings: ConversionSettings, execution?: LegacyExecutionContext) => Promise<EngineResult>;

interface LegacyAdapterOptions {
  id: string;
  runtimes: readonly RecipeRuntime[];
  cancellation: EngineCancellationCapability;
  ownsRecipe: ConversionEngine["ownsRecipe"];
  convert: LegacyConverter;
}

export function createLegacyAdapter(options: LegacyAdapterOptions): ConversionEngine {
  return {
    id: options.id,
    runtimes: options.runtimes,
    cancellation: options.cancellation,
    ownsRecipe: options.ownsRecipe,
    async convert(context) {
      throwIfAborted(context.signal);
      const result = await options.convert(context.file, context.inspection, context.recipe, context.settings, context);
      throwIfAborted(context.signal);
      return result;
    }
  };
}

export const legacyEngines: readonly ConversionEngine[] = [
  createLegacyAdapter({
    id: "legacy-image",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: canConvertImageRecipe,
    convert: convertImageRecipe
  }),
  createLegacyAdapter({
    id: "legacy-pdf",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: canConvertPdfRecipe,
    convert: convertPdfRecipe
  }),
  createLegacyAdapter({
    id: "browser-media",
    runtimes: ["browser"],
    cancellation: "cooperative",
    ownsRecipe: canConvertMediaRecipe,
    convert: convertMediaRecipe
  }),
  createLegacyAdapter({
    id: "legacy-advanced",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: canConvertAdvancedRecipe,
    convert: convertAdvancedRecipe
  })
];

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Conversion was cancelled.", "AbortError");
  }
}
