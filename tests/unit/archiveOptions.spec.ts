import { expect, test } from "playwright/test";
import { archiveEntryMatches, archiveSelectionOptionsForInspection } from "../../src/lib/archiveOptions";

test("builds bounded per-file archive choices", () => {
  expect(archiveSelectionOptionsForInspection(["All files"], [{ name: "docs/report.pdf" }, { name: "media/photo.png" }])).toEqual([
    "All files", "Single file: docs/report.pdf", "Single file: media/photo.png"
  ]);
  expect(archiveSelectionOptionsForInspection(["All files"], Array.from({ length: 51 }, (_, index) => ({ name: `${index}.txt` })))).toEqual(["All files"]);
});

test("matches meaningful archive file groups and exact entries", () => {
  expect(archiveEntryMatches("report.pdf", "Top-level files")).toBe(true);
  expect(archiveEntryMatches("docs/report.pdf", "Top-level files")).toBe(false);
  expect(archiveEntryMatches("docs/report.pdf", "Documents")).toBe(true);
  expect(archiveEntryMatches("media/photo.PNG", "Images")).toBe(true);
  expect(archiveEntryMatches("media/clip.mp4", "Audio and video")).toBe(true);
  expect(archiveEntryMatches("docs/report.pdf", "Single file: docs/report.pdf")).toBe(true);
});
