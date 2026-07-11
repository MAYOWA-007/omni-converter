export function pageSelectionOptionsForDocument(baseOptions: readonly string[], pageCount?: number) {
  const options = [...baseOptions];
  if (!Number.isInteger(pageCount) || !pageCount || pageCount < 1) return unique(options);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    options.push(`Page ${pageNumber}`);
  }

  if (pageCount <= 12) {
    for (let start = 1; start < pageCount; start += 1) {
      for (let end = start + 1; end <= pageCount; end += 1) {
        options.push(`Pages ${start}-${end}`);
      }
    }
  } else {
    for (let start = 1; start <= pageCount; start += 10) {
      options.push(`Pages ${start}-${Math.min(pageCount, start + 9)}`);
    }
  }

  return unique(options);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
