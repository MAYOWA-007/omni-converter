import { FORMAT_UNIVERSE } from "./formatUniverse";

export type { FormatDefinition } from "./formatUniverse";
export type ExactFormatId = string;

export const FORMAT_REGISTRY = Object.fromEntries(
  FORMAT_UNIVERSE.map((format) => [format.id, format])
) as Record<ExactFormatId, (typeof FORMAT_UNIVERSE)[number]>;
