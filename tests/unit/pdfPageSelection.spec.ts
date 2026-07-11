import { expect, test } from "playwright/test";
import { selectPdfPageNumbers } from "../../src/lib/pdfPageSelection";

test("selects common PDF page groups from dropdown values", () => {
  expect(selectPdfPageNumbers(6, "All pages")).toEqual([1, 2, 3, 4, 5, 6]);
  expect(selectPdfPageNumbers(6, "First page")).toEqual([1]);
  expect(selectPdfPageNumbers(6, "Last page")).toEqual([6]);
  expect(selectPdfPageNumbers(6, "Odd pages")).toEqual([1, 3, 5]);
  expect(selectPdfPageNumbers(6, "Even pages")).toEqual([2, 4, 6]);
  expect(selectPdfPageNumbers(6, "Reverse order")).toEqual([6, 5, 4, 3, 2, 1]);
  expect(selectPdfPageNumbers(6, "Odd pages, then even pages")).toEqual([1, 3, 5, 2, 4, 6]);
  expect(selectPdfPageNumbers(6, "Even pages, then odd pages")).toEqual([2, 4, 6, 1, 3, 5]);
});

test("bounds fixed first-page selections to the document", () => {
  expect(selectPdfPageNumbers(3, "First 2 pages")).toEqual([1, 2]);
  expect(selectPdfPageNumbers(3, "First 5 pages")).toEqual([1, 2, 3]);
  expect(selectPdfPageNumbers(3, "First 10 pages")).toEqual([1, 2, 3]);
});

test("parses ordered page lists and ranges without duplicates", () => {
  expect(selectPdfPageNumbers(8, "Pages 3, 1, 5-7, 7, 9")).toEqual([3, 1, 5, 6, 7]);
  expect(selectPdfPageNumbers(8, "Pages 6-4")).toEqual([6, 5, 4]);
  expect(selectPdfPageNumbers(3, "Pages 1-100000000")).toEqual([1, 2, 3]);
  expect(selectPdfPageNumbers(3, "Pages 100000000-1")).toEqual([3, 2, 1]);
});

test("rejects empty documents and selections with no valid pages", () => {
  expect(() => selectPdfPageNumbers(0, "All pages")).toThrow(/page count/i);
  expect(() => selectPdfPageNumbers(3, "Pages 8-10")).toThrow(/does not select/i);
});
