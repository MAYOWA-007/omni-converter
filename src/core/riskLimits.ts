import { archivePathKey } from "./archivePaths";

export const MAX_ARCHIVE_ENTRY_COUNT = 10_000;
export const MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
export const MAX_ARCHIVE_EXPANSION_RATIO = 100;

export interface ArchiveEntryFact {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  directory?: boolean;
}

export interface InputRiskFacts {
  archiveEntries?: readonly ArchiveEntryFact[];
  entryCount?: number;
  totalUncompressedBytes?: number;
}

export interface InputRiskEvaluation {
  blocked: boolean;
  reasons: string[];
}

export function evaluateInputRisk(facts: InputRiskFacts): InputRiskEvaluation {
  const entries = facts.archiveEntries ?? [];
  const entryCount = facts.entryCount ?? entries.length;
  const totalUncompressedBytes = facts.totalUncompressedBytes ?? entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  const reasons: string[] = [];
  const pathKeys = new Set<string>();

  for (const entry of entries) {
    try {
      const key = archivePathKey(entry.name, { directory: entry.directory });
      if (pathKeys.has(key)) reasons.push(`Archive contains a duplicate path after normalization: ${entry.name}`);
      pathKeys.add(key);
    } catch {
      reasons.push(`Archive entry has an unsafe path: ${entry.name}`);
    }
    if (entry.uncompressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_ARCHIVE_EXPANSION_RATIO) {
      reasons.push(`Archive entry exceeds the ${MAX_ARCHIVE_EXPANSION_RATIO}:1 expansion ratio limit: ${entry.name}`);
    }
  }

  if (entryCount > MAX_ARCHIVE_ENTRY_COUNT) reasons.push(`Archive exceeds the ${MAX_ARCHIVE_ENTRY_COUNT} entry limit.`);
  if (totalUncompressedBytes > MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES) {
    reasons.push(`Archive exceeds the ${MAX_ARCHIVE_TOTAL_UNCOMPRESSED_BYTES} byte uncompressed limit.`);
  }

  return { blocked: reasons.length > 0, reasons };
}
