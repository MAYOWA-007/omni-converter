import { expect, test } from "playwright/test";
import { selectSlideNumbers, slideSelectionOptionsForPresentation } from "../../src/lib/presentationOptions";

test("selects ordered slide groups and bounds hostile ranges", () => {
  expect(selectSlideNumbers(5, "Odd slides")).toEqual([1, 3, 5]);
  expect(selectSlideNumbers(5, "Reverse order")).toEqual([5, 4, 3, 2, 1]);
  expect(selectSlideNumbers(5, "Slides 4,2,5-3")).toEqual([4, 2, 5, 3]);
  expect(selectSlideNumbers(3, "Slides 100000000-1")).toEqual([3, 2, 1]);
});

test("builds presentation-specific dropdown options", () => {
  expect(slideSelectionOptionsForPresentation(["All slides", "First slide"], 3)).toEqual([
    "All slides", "First slide", "Slide 1", "Slide 2", "Slide 3", "Slides 1-3"
  ]);
});
