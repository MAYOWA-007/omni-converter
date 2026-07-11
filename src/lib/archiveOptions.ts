export const ARCHIVE_SELECTION_OPTIONS = ["All files", "Top-level files", "Documents", "Images", "Audio and video"] as const;

export function archiveSelectionOptionsForInspection(baseOptions: readonly string[], entries?: ReadonlyArray<{ name: string }>) {
  const options = [...baseOptions];
  if ((entries?.length ?? 0) <= 50) {
    for (const entry of entries ?? []) options.push(`Single file: ${entry.name}`);
  }
  return Array.from(new Set(options));
}

export function archiveEntryMatches(name: string, selection = "All files") {
  const lower = name.toLowerCase();
  if (selection === "All files") return true;
  if (selection === "Top-level files") return !name.includes("/");
  if (selection === "Documents") return /\.(?:pdf|docx?|xlsx?|pptx?|rtf|txt|md|html?|epub)$/i.test(lower);
  if (selection === "Images") return /\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?|svg|ico)$/i.test(lower);
  if (selection === "Audio and video") return /\.(?:mp[34]|m4[av]|mov|webm|mkv|avi|wav|flac|aac|ogg)$/i.test(lower);
  if (selection.startsWith("Single file: ")) return name === selection.slice("Single file: ".length);
  throw new Error(`Unknown archive selection: ${selection}`);
}
