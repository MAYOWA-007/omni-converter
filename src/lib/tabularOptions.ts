export function sheetSelectionOptionsForWorkbook(baseOptions: readonly string[], sheets?: readonly string[]) {
  const options = [...baseOptions];
  for (const sheet of sheets ?? []) {
    const value = `Sheet: ${sheet}`;
    if (!options.includes(value)) options.push(value);
  }
  return options;
}
