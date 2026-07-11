import {
  baseFileName,
  rowsToMarkdown,
  zipLevelFromCompression,
  zipOutputs,
  type ConversionOutput
} from "./conversionHelpers";
import type { ConversionSettings } from "./types";

export interface TabularSheet {
  name: string;
  rows: unknown[][];
}

export function parseTabularText(text: string, format: string): unknown[][] {
  const normalizedFormat = format.toLowerCase().replace(/^\./, "");
  let rows: unknown[][];
  if (normalizedFormat === "json") rows = jsonValueToRows(JSON.parse(text));
  else if (normalizedFormat === "jsonl" || normalizedFormat === "ndjson") {
    const values = text.split(/\r?\n/).flatMap((line, index) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line)];
      } catch {
        throw new Error(`JSON Lines input is invalid on line ${index + 1}.`);
      }
    });
    rows = jsonValueToRows(values);
  }
  else if (normalizedFormat === "csv") rows = parseDelimitedStrict(text, ",");
  else if (normalizedFormat === "tsv") rows = parseDelimitedStrict(text, "\t");
  else throw new Error(`.${normalizedFormat || "unknown"} is not a supported browser table input.`);

  if (!rows.some((row) => row.some((value) => value !== "" && value != null))) {
    throw new Error("The table contains no rows with values.");
  }
  return rows;
}

export function tabularObjects(rows: unknown[][], headerMode = "First row is headers") {
  const hasHeaders = headerMode !== "No header row";
  const headerRow = hasHeaders ? rows[0] ?? [] : Array.from({ length: widestRow(rows) }, (_, index) => `column_${index + 1}`);
  const headers = uniqueHeaders(headerRow);
  const body = hasHeaders ? rows.slice(1) : rows;
  return body.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

export function serializeDelimitedRows(rows: unknown[][], delimiter = ",", protectFormulas = true) {
  return rows.map((row) => row.map((value) => delimitedCell(value, delimiter, protectFormulas)).join(delimiter)).join("\n");
}

export async function convertSpreadsheetToDelimited(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const sheets = selectSheets(await readTabularWorkbook(file), settings.sheetSelection);
  const delimiter = settings.outputFormat?.includes("TSV") ? "\t" : ",";
  const extension = delimiter === "\t" ? "tsv" : "csv";
  const mime = delimiter === "\t" ? "text/tab-separated-values;charset=utf-8" : "text/csv;charset=utf-8";
  const protectFormulas = settings.formulaSafety !== "Preserve exact text";
  const slugs = uniqueSheetSlugs(sheets);
  const outputs = sheets.map((sheet, index) => textOutput(
    `sheets/${String(index + 1).padStart(2, "0")}-${slugs[index]}.${extension}`,
    serializeDelimitedRows(sheet.rows, delimiter, protectFormulas),
    mime
  ));

  if (sheets.length === 1 && selectsSingleSheet(settings.sheetSelection)) {
    return { name: `${baseName}.${extension}`, blob: outputs[0].blob };
  }
  if (/manifest/i.test(settings.bundle ?? "")) outputs.push(manifestOutput(file, sheets, outputs));
  return zipOutputs(`${baseName}-${extension}-sheets.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

export async function convertSpreadsheetToJson(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const sheets = selectSheets(await readTabularWorkbook(file), settings.sheetSelection);
  const asText = settings.dataTypes === "Convert all values to text";
  const mode = settings.outputFormat ?? "Combined workbook JSON";
  const slugs = uniqueSheetSlugs(sheets);
  const converted = sheets.map((sheet) => dataValueForMode(asText ? stringifyRows(sheet.rows) : sheet.rows, mode, settings.headerMode));

  if (mode === "Combined workbook JSON") {
    return jsonOutput(`${baseName}-workbook.json`, {
      source: file.name,
      sheets: Object.fromEntries(sheets.map((sheet, index) => [sheet.name, converted[index]]))
    });
  }

  const extension = mode.includes("Lines") ? "jsonl" : "json";
  const outputs = converted.map((value, index) => mode.includes("Lines")
    ? textOutput(`sheets/${String(index + 1).padStart(2, "0")}-${slugs[index]}.jsonl`, serializeJsonLines(value), "application/x-ndjson;charset=utf-8")
    : jsonOutput(`sheets/${String(index + 1).padStart(2, "0")}-${slugs[index]}.json`, value));
  if (sheets.length === 1 && selectsSingleSheet(settings.sheetSelection)) {
    return { name: `${baseName}.${extension}`, blob: outputs[0].blob };
  }
  if (/manifest/i.test(settings.bundle ?? "")) outputs.push(manifestOutput(file, sheets, outputs));
  return zipOutputs(`${baseName}-json-sheets.zip`, outputs, zipLevelFromCompression(settings.bundle));
}

export async function convertStructuredData(file: File, baseName: string, settings: ConversionSettings): Promise<ConversionOutput> {
  const [sheet] = await readTabularWorkbook(file);
  const rows = applyDataTypeMode(sheet.rows, settings.dataTypes);
  const target = settings.outputFormat ?? "JSON objects";
  const protectFormulas = settings.formulaSafety !== "Preserve exact text";
  if (target === "CSV") return textOutput(dataOutputName(baseName, "csv", settings.batchNaming), serializeDelimitedRows(rows, ",", protectFormulas), "text/csv;charset=utf-8");
  if (target === "TSV") return textOutput(dataOutputName(baseName, "tsv", settings.batchNaming), serializeDelimitedRows(rows, "\t", protectFormulas), "text/tab-separated-values;charset=utf-8");
  if (target === "Markdown table") return textOutput(dataOutputName(baseName, "md", settings.batchNaming), `${rowsToMarkdown(stringifyRows(rows))}\n`, "text/markdown;charset=utf-8");

  const value = dataValueForMode(rows, target, settings.headerMode);
  if (target === "JSON Lines") return textOutput(dataOutputName(baseName, "jsonl", settings.batchNaming), serializeJsonLines(value), "application/x-ndjson;charset=utf-8");
  return jsonOutput(dataOutputName(baseName, "json", settings.batchNaming), value);
}

export async function readTabularWorkbook(file: File): Promise<TabularSheet[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "xls") throw new Error("Legacy .xls workbooks require the desktop converter.");
  if (extension === "xlsx" || file.type.includes("spreadsheetml")) {
    const { default: readWorkbook } = await import("read-excel-file/browser");
    const sheets = await readWorkbook(file, { trim: false });
    if (!sheets.length) throw new Error("The workbook contains no readable sheets.");
    return sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data as unknown[][] }));
  }
  return [{ name: baseFileName(file.name, "data"), rows: parseTabularText(await file.text(), extension) }];
}

function parseDelimitedStrict(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let endedWithRowBreak = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    endedWithRowBreak = false;
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      if (cell.length) throw new Error("Delimited input contains a quote inside an unquoted field.");
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      endedWithRowBreak = true;
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) throw new Error("Delimited input contains an unterminated quoted field.");
  if (!endedWithRowBreak && (text.length > 0 || row.length > 0 || cell.length > 0)) rows.push([...row, cell]);
  return rows;
}

function jsonValueToRows(value: unknown): unknown[][] {
  const values = Array.isArray(value) ? value : [value];
  if (values.every((item) => isRecord(item))) {
    const headers = Array.from(new Set(values.flatMap((item) => Object.keys(item as Record<string, unknown>))));
    return [headers, ...values.map((item) => headers.map((header) => (item as Record<string, unknown>)[header] ?? null))];
  }
  if (values.every(Array.isArray)) return values as unknown[][];
  return [["value"], ...values.map((item) => [item])];
}

function dataValueForMode(rows: unknown[][], mode: string, headerMode?: string): unknown {
  if (mode.includes("rows") || mode.includes("arrays")) return rows;
  return tabularObjects(rows, headerMode);
}

function dataOutputName(baseName: string, extension: string, naming?: string) {
  return `${baseName}${naming === "Format suffix" ? `-converted-to-${extension}` : ""}.${extension}`;
}

function applyDataTypeMode(rows: unknown[][], mode?: string) {
  if (mode === "Convert all values to text") return stringifyRows(rows);
  if (mode === "Infer CSV value types") return rows.map((row, rowIndex) => row.map((value) => rowIndex === 0 ? value : inferCell(value)));
  return rows;
}

function stringifyRows(rows: unknown[][]) {
  return rows.map((row) => row.map((value) => value == null ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value)));
}

function inferCell(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  if (/^null$/i.test(trimmed)) return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed) && !/^-?0\d/.test(trimmed)) return Number(trimmed);
  return value;
}

function delimitedCell(value: unknown, delimiter: string, protectFormulas: boolean) {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (protectFormulas && typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  const escaped = text.replace(/"/g, '""');
  return text.includes(delimiter) || /["\n\r]/.test(text) ? `"${escaped}"` : escaped;
}

function uniqueHeaders(values: unknown[]) {
  const counts = new Map<string, number>();
  return values.map((value, index) => {
    const base = String(value ?? "").trim() || `column_${index + 1}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function uniqueSheetSlugs(sheets: TabularSheet[]) {
  const counts = new Map<string, number>();
  return sheets.map((sheet, index) => {
    const base = baseFileName(sheet.name, `sheet-${index + 1}`);
    const count = (counts.get(base.toLowerCase()) ?? 0) + 1;
    counts.set(base.toLowerCase(), count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

function selectSheets(sheets: TabularSheet[], selection?: string) {
  if (selection?.startsWith("Sheet: ")) {
    const name = selection.slice("Sheet: ".length);
    const selected = sheets.find((sheet) => sheet.name === name);
    if (!selected) throw new Error(`Workbook sheet "${name}" was not found.`);
    return [selected];
  }
  return selection === "First sheet" ? sheets.slice(0, 1) : sheets;
}

function selectsSingleSheet(selection?: string) {
  return selection === "First sheet" || selection?.startsWith("Sheet: ") === true;
}

function manifestOutput(file: File, sheets: TabularSheet[], outputs: ConversionOutput[]) {
  return jsonOutput("manifest.json", {
    source: file.name,
    sheets: sheets.map((sheet, index) => ({ name: sheet.name, rows: sheet.rows.length, output: outputs[index]?.name }))
  });
}

function serializeJsonLines(value: unknown) {
  const records = Array.isArray(value) ? value : [value];
  return records.map((record) => JSON.stringify(record)).join("\n");
}

function jsonOutput(name: string, value: unknown): ConversionOutput {
  return textOutput(name, JSON.stringify(value, null, 2), "application/json;charset=utf-8");
}

function textOutput(name: string, text: string, type: string): ConversionOutput {
  return { name, blob: new Blob([text], { type }) };
}

function widestRow(rows: unknown[][]) {
  return rows.reduce((width, row) => Math.max(width, row.length), 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}
