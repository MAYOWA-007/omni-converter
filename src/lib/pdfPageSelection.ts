export const PDF_PAGE_SELECTION_OPTIONS = [
  "All pages",
  "First page",
  "Last page",
  "Odd pages",
  "Even pages",
  "Reverse order",
  "First 2 pages",
  "First 3 pages",
  "First 5 pages",
  "First 10 pages"
] as const;

export function selectPdfPageNumbers(pageCount: number, selection = "All pages") {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("PDF page count must be a positive integer.");
  }

  const allPages = Array.from({ length: pageCount }, (_, index) => index + 1);
  switch (selection) {
    case "All pages":
      return allPages;
    case "First page":
      return [1];
    case "Last page":
      return [pageCount];
    case "Odd pages":
      return allPages.filter((pageNumber) => pageNumber % 2 === 1);
    case "Even pages":
      return allPages.filter((pageNumber) => pageNumber % 2 === 0);
    case "Reverse order":
      return allPages.reverse();
    case "Odd pages, then even pages":
      return [...allPages.filter((pageNumber) => pageNumber % 2 === 1), ...allPages.filter((pageNumber) => pageNumber % 2 === 0)];
    case "Even pages, then odd pages":
      return [...allPages.filter((pageNumber) => pageNumber % 2 === 0), ...allPages.filter((pageNumber) => pageNumber % 2 === 1)];
  }

  const firstMatch = selection.match(/^First (\d+) pages?$/i);
  if (firstMatch) {
    return allPages.slice(0, Number(firstMatch[1]));
  }

  const expressionMatch = selection.match(/^Pages?\s+(.+)$/i);
  if (expressionMatch) {
    const selected: number[] = [];
    const seen = new Set<number>();
    for (const token of expressionMatch[1].split(",")) {
      const rangeMatch = token.trim().match(/^(\d+)\s*-\s*(\d+)$/);
      const values = rangeMatch
        ? boundedInclusiveRange(Number(rangeMatch[1]), Number(rangeMatch[2]), pageCount)
        : /^\d+$/.test(token.trim())
          ? [Number(token.trim())]
          : [];
      for (const pageNumber of values) {
        if (pageNumber < 1 || pageNumber > pageCount || seen.has(pageNumber)) continue;
        seen.add(pageNumber);
        selected.push(pageNumber);
      }
    }
    if (selected.length) return selected;
  }

  throw new Error(`Page selection "${selection}" does not select a valid page.`);
}

function boundedInclusiveRange(start: number, end: number, pageCount: number) {
  const direction = start <= end ? 1 : -1;
  const boundedStart = direction > 0 ? Math.max(1, start) : Math.min(pageCount, start);
  const boundedEnd = direction > 0 ? Math.min(pageCount, end) : Math.max(1, end);
  if (direction > 0 ? boundedStart > boundedEnd : boundedStart < boundedEnd) return [];

  const values: number[] = [];
  for (let value = boundedStart; direction > 0 ? value <= boundedEnd : value >= boundedEnd; value += direction) {
    values.push(value);
  }
  return values;
}
