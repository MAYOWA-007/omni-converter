import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedUniversalRecipeContract {
  recipeId: string;
  fixture: "binary" | "utf8-text" | "json" | "jsonl" | "csv" | "tsv" | "xml";
  engineId: "legacy-universal";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_UNIVERSAL_RECIPE_CONTRACTS: readonly VerifiedUniversalRecipeContract[] = [
  contract("file-to-zip", "binary", ["zip"], ["compression"], { compression: "Balanced ZIP" }),
  contract("file-to-gzip", "binary", ["gz"]),
  contract("file-checksum-manifest", "binary", ["json"]),
  contract("file-metadata-report", "binary", ["json"]),
  contract("file-byte-analysis", "binary", ["json"]),
  contract("file-to-base64", "binary", ["txt"]),
  contract("file-to-data-uri", "binary", ["txt"]),
  contract("file-to-hex", "binary", ["txt"]),
  contract("file-chunk-zip", "binary", ["zip"], ["compression"], { compression: "Store ZIP" }),
  contract("text-to-html", "utf8-text", ["html"]),
  contract("text-to-markdown", "utf8-text", ["md"]),
  contract("text-to-json", "utf8-text", ["json"]),
  contract("text-to-pdf", "utf8-text", ["pdf"]),
  contract("text-line-numbered", "utf8-text", ["txt"]),
  contract("text-word-frequency", "utf8-text", ["json"]),
  contract("text-case-pack", "utf8-text", ["zip"], ["compression"], { compression: "Balanced ZIP" }),
  contract("json-pretty", "json", ["json"]),
  contract("json-minify", "json", ["json"]),
  contract("json-to-jsonl", "json", ["jsonl"]),
  contract("jsonl-to-json", "jsonl", ["json"]),
  contract("csv-to-tsv", "csv", ["tsv"]),
  contract("tsv-to-csv", "tsv", ["csv"]),
  contract("xml-to-json", "xml", ["json"]),
  contract("json-to-xml", "json", ["xml"])
];

export const VERIFIED_UNIVERSAL_RECIPE_IDS = new Set(VERIFIED_UNIVERSAL_RECIPE_CONTRACTS.map((contractEntry) => contractEntry.recipeId));

function contract(
  recipeId: string,
  fixture: VerifiedUniversalRecipeContract["fixture"],
  expectedExtensions: readonly string[],
  differentialControls: readonly EditorControl[] = [],
  fixtureSettings: ConversionSettings = {}
): VerifiedUniversalRecipeContract {
  return { recipeId, fixture, engineId: "legacy-universal", expectedExtensions, differentialControls, fixtureSettings };
}
