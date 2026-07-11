export const SLIDE_SELECTION_OPTIONS = ["All slides", "First slide", "Last slide", "Odd slides", "Even slides", "Reverse order"] as const;

export function selectSlideNumbers(slideCount: number, selection = "All slides") {
  if (!Number.isInteger(slideCount) || slideCount < 1) throw new Error("Slide count must be a positive integer.");
  const all = Array.from({ length: slideCount }, (_, index) => index + 1);
  if (selection === "All slides") return all;
  if (selection === "First slide") return [1];
  if (selection === "Last slide") return [slideCount];
  if (selection === "Odd slides") return all.filter((number) => number % 2 === 1);
  if (selection === "Even slides") return all.filter((number) => number % 2 === 0);
  if (selection === "Reverse order") return all.reverse();
  const single = /^Slide (\d+)$/i.exec(selection);
  if (single) return boundedUnique([Number(single[1])], slideCount, selection);
  const expression = /^Slides?\s+(.+)$/i.exec(selection);
  if (expression) {
    const selected: number[] = [];
    for (const token of expression[1].split(",")) {
      const range = /^(\d+)\s*-\s*(\d+)$/.exec(token.trim());
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        const direction = start <= end ? 1 : -1;
        const boundedStart = direction > 0 ? Math.max(1, start) : Math.min(slideCount, start);
        const boundedEnd = direction > 0 ? Math.min(slideCount, end) : Math.max(1, end);
        for (let value = boundedStart; direction > 0 ? value <= boundedEnd : value >= boundedEnd; value += direction) selected.push(value);
      } else if (/^\d+$/.test(token.trim())) selected.push(Number(token.trim()));
    }
    return boundedUnique(selected, slideCount, selection);
  }
  throw new Error(`Slide selection "${selection}" does not select a valid slide.`);
}

export function slideSelectionOptionsForPresentation(baseOptions: readonly string[], slideCount?: number) {
  const options = [...baseOptions];
  if (!slideCount || slideCount < 1) return options;
  for (let number = 1; number <= slideCount; number += 1) options.push(`Slide ${number}`);
  if (slideCount > 1) options.push(`Slides 1-${slideCount}`);
  return Array.from(new Set(options));
}

function boundedUnique(values: number[], count: number, selection: string) {
  const result = Array.from(new Set(values.filter((value) => value >= 1 && value <= count)));
  if (!result.length) throw new Error(`Slide selection "${selection}" does not select a valid slide.`);
  return result;
}
