import { expect, test } from "playwright/test";
import { parseTabularText, serializeDelimitedRows, tabularObjects } from "../../src/lib/dataConversions";

test("parses quoted CSV fields, embedded lines, Unicode, and empty values", () => {
  const rows = parseTabularText('name,note,count,active,empty\r\n"Zoë","comma, and\nline",007,true,', "csv");
  expect(rows).toEqual([
    ["name", "note", "count", "active", "empty"],
    ["Zoë", "comma, and\nline", "007", "true", ""]
  ]);
});

test("parses JSON Lines into a union-column table while retaining value types", () => {
  const rows = parseTabularText('{"name":"Alpha","count":2}\n{"active":true,"name":"Beta"}', "jsonl");
  expect(rows).toEqual([
    ["name", "count", "active"],
    ["Alpha", 2, null],
    ["Beta", null, true]
  ]);
  expect(tabularObjects(rows)).toEqual([
    { name: "Alpha", count: 2, active: null },
    { name: "Beta", count: null, active: true }
  ]);
});

test("spreadsheet-safe delimited export neutralizes formula strings but not numbers", () => {
  const rows = [["value"], ["=2+2"], ["  @SUM(A1:A2)"], ["-10"], [-10], ["ordinary"]];
  expect(serializeDelimitedRows(rows, ",", true)).toBe("value\n'=2+2\n'  @SUM(A1:A2)\n'-10\n-10\nordinary");
  expect(serializeDelimitedRows(rows, ",", false)).toContain("\n=2+2\n");
});

test("rejects malformed delimited and JSON Lines input instead of inventing rows", () => {
  expect(() => parseTabularText('name,"unterminated', "csv")).toThrow(/unterminated/i);
  expect(() => parseTabularText('{"ok":true}\nnot-json', "jsonl")).toThrow(/line 2/i);
  expect(() => parseTabularText("", "csv")).toThrow(/no rows/i);
  expect(() => parseTabularText("[]", "json")).toThrow(/no rows/i);
});
