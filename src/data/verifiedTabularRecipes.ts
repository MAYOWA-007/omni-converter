import type { ConversionSettings, EditorControl } from "../lib/types";

export interface VerifiedTabularRecipeContract {
  recipeId: string;
  fixture: "multi-sheet-xlsx" | "quoted-csv";
  engineId: "legacy-advanced";
  expectedExtensions: readonly string[];
  differentialControls: readonly EditorControl[];
  fixtureSettings: ConversionSettings;
}

export const VERIFIED_TABULAR_RECIPE_CONTRACTS: readonly VerifiedTabularRecipeContract[] = [
  {
    recipeId: "spreadsheet-to-csv",
    fixture: "multi-sheet-xlsx",
    engineId: "legacy-advanced",
    expectedExtensions: ["zip"],
    differentialControls: ["outputFormat", "sheetSelection", "formulaSafety", "bundle"],
    fixtureSettings: { outputFormat: "CSV", sheetSelection: "All sheets", formulaSafety: "Protect spreadsheet formulas", bundle: "Balanced ZIP with manifest" }
  },
  {
    recipeId: "spreadsheet-to-json",
    fixture: "multi-sheet-xlsx",
    engineId: "legacy-advanced",
    expectedExtensions: ["json"],
    differentialControls: ["outputFormat", "sheetSelection", "headerMode", "dataTypes", "bundle"],
    fixtureSettings: { outputFormat: "Combined workbook JSON", sheetSelection: "All sheets", headerMode: "First row is headers", dataTypes: "Preserve detected types", bundle: "Balanced ZIP with manifest" }
  },
  {
    recipeId: "spreadsheet-chart-pack",
    fixture: "multi-sheet-xlsx",
    engineId: "legacy-advanced",
    expectedExtensions: ["zip"],
    differentialControls: ["outputFormat", "bundle"],
    fixtureSettings: { outputFormat: "PNG + SVG", bundle: "Balanced ZIP" }
  },
  {
    recipeId: "data-json-csv",
    fixture: "quoted-csv",
    engineId: "legacy-advanced",
    expectedExtensions: ["jsonl"],
    differentialControls: ["outputFormat", "headerMode", "dataTypes", "formulaSafety", "batchNaming"],
    fixtureSettings: { outputFormat: "JSON Lines", headerMode: "First row is headers", dataTypes: "Infer CSV value types", formulaSafety: "Protect spreadsheet formulas", batchNaming: "Clean filename" }
  }
];

export const VERIFIED_TABULAR_RECIPE_IDS = new Set(VERIFIED_TABULAR_RECIPE_CONTRACTS.map((contract) => contract.recipeId));
