import { expect, test } from "playwright/test";
import { pageSelectionOptionsForDocument } from "../../src/lib/pdfPageOptions";

test("adds every individual page and contiguous range for a normal PDF", () => {
  const options = pageSelectionOptionsForDocument(["All pages", "First page", "Last page"], 4);

  expect(options).toEqual(expect.arrayContaining([
    "Page 1", "Page 2", "Page 3", "Page 4",
    "Pages 1-2", "Pages 1-3", "Pages 1-4", "Pages 2-3", "Pages 2-4", "Pages 3-4"
  ]));
  expect(new Set(options).size).toBe(options.length);
});

test("keeps large PDF page menus bounded while retaining every page and useful chunks", () => {
  const options = pageSelectionOptionsForDocument(["All pages"], 120);

  expect(options).toContain("Page 120");
  expect(options).toContain("Pages 1-10");
  expect(options).toContain("Pages 111-120");
  expect(options.length).toBeLessThan(150);
});

test("returns base options when page count is not available", () => {
  expect(pageSelectionOptionsForDocument(["All pages", "Odd pages"], undefined)).toEqual(["All pages", "Odd pages"]);
});
