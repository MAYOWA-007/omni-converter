export interface NormalizeArchivePathOptions {
  directory?: boolean;
}

export function normalizeArchivePath(path: string, options: NormalizeArchivePathOptions = {}) {
  let normalizedUnicode = path.normalize("NFKC");
  if (options.directory && /[\\/]$/.test(normalizedUnicode)) {
    normalizedUnicode = normalizedUnicode.slice(0, -1);
  }
  if (!normalizedUnicode || /^(?:[A-Za-z]:|[\\/])/.test(normalizedUnicode)) {
    throw new Error(`Archive path is absolute or drive-relative: ${path}`);
  }

  const normalized = normalizedUnicode.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Archive path contains an empty, current, or parent segment: ${path}`);
  }
  for (const segment of segments) validateArchivePathSegment(segment, path);
  return segments.join("/");
}

export function archivePathKey(path: string, options: NormalizeArchivePathOptions = {}) {
  return normalizeArchivePath(path, options).toLowerCase();
}

function validateArchivePathSegment(segment: string, original: string) {
  if (segment.length > 255 || /[\u0000-\u001f\u007f-\u009f:]/.test(segment) || /[. ]$/.test(segment)) {
    throw new Error(`Archive path contains an unsafe filename segment: ${original}`);
  }
  const deviceName = segment.split(".", 1)[0];
  if (/^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9]|LPT[1-9])$/i.test(deviceName)) {
    throw new Error(`Archive path uses a reserved device filename: ${original}`);
  }
}
