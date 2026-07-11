const ALLOWED_ELEMENTS = new Set([
  "html", "head", "body", "title", "meta", "style",
  "main", "header", "footer", "nav", "section", "article", "aside",
  "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "pre", "code", "blockquote", "q", "cite", "em", "strong", "b", "i", "u", "s", "small", "sub", "sup", "mark",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
  "br", "hr", "a", "img", "figure", "figcaption", "details", "summary", "time"
]);

const VOID_ELEMENTS = new Set(["meta", "img", "br", "hr", "col"]);
const DROP_WITH_CONTENT = new Set([
  "script", "iframe", "object", "embed", "frame", "frameset", "template",
  "noscript", "noembed", "noframes", "svg", "math", "form"
]);
const GLOBAL_ATTRIBUTES = new Set(["class", "title", "lang", "dir", "style"]);
const ELEMENT_ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(["href"]),
  blockquote: new Set(["cite"]),
  col: new Set(["span"]),
  img: new Set(["src", "alt", "width", "height", "loading", "decoding"]),
  li: new Set(["value"]),
  meta: new Set(["charset", "name", "content"]),
  ol: new Set(["start", "reversed", "type"]),
  q: new Set(["cite"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "headers", "scope"]),
  time: new Set(["datetime"])
};
const URL_ATTRIBUTES = new Set(["href", "src", "cite"]);
const NUMERIC_ATTRIBUTES = new Set(["width", "height", "colspan", "rowspan", "span", "start", "value"]);

interface ParsedTag {
  closing: boolean;
  end: number;
  name: string;
  attributes: string;
  selfClosing: boolean;
}

interface ParsedAttribute {
  name: string;
  value: string;
}

/**
 * Rebuild generated HTML from a deliberately small allowlist. This parser is
 * intentionally conservative because converted documents are attacker input.
 */
export function sanitizeGeneratedHtml(source: string) {
  let index = 0;
  let output = "";
  let wroteDoctype = false;
  const openElements: string[] = [];

  while (index < source.length) {
    const tagStart = source.indexOf("<", index);
    if (tagStart < 0) {
      output += source.slice(index);
      break;
    }

    output += source.slice(index, tagStart);

    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      index = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }

    const declarationEnd = findTagEnd(source, tagStart + 1);
    if (/^<!doctype\s+html\b/i.test(source.slice(tagStart, Math.min(source.length, tagStart + 32)))) {
      if (!wroteDoctype) {
        output += "<!doctype html>";
        wroteDoctype = true;
      }
      index = declarationEnd < 0 ? source.length : declarationEnd + 1;
      continue;
    }

    const parsed = parseTag(source, tagStart);
    if (!parsed) {
      output += "&lt;";
      index = tagStart + 1;
      continue;
    }
    index = parsed.end + 1;

    if (parsed.closing) {
      if (openElements.at(-1) === parsed.name) {
        openElements.pop();
        output += `</${parsed.name}>`;
      }
      continue;
    }

    if (DROP_WITH_CONTENT.has(parsed.name)) {
      if (!parsed.selfClosing) index = skipElementContent(source, index, parsed.name);
      continue;
    }

    if (parsed.name === "style") {
      const closing = findClosingElement(source, index, "style");
      if (!closing) {
        index = source.length;
        continue;
      }
      const css = sanitizeCss(source.slice(index, closing.start));
      if (css !== null) output += `<style>${css}</style>`;
      index = closing.end;
      continue;
    }

    if (!ALLOWED_ELEMENTS.has(parsed.name)) continue;

    const attributes = sanitizeAttributes(parsed.name, parsed.attributes);
    if (parsed.name === "meta" && attributes.length === 0) continue;
    output += `<${parsed.name}${serializeAttributes(attributes)}>`;

    if (!VOID_ELEMENTS.has(parsed.name) && !parsed.selfClosing) openElements.push(parsed.name);
  }

  while (openElements.length > 0) output += `</${openElements.pop()}>`;
  return output;
}

function parseTag(source: string, start: number): ParsedTag | null {
  let cursor = start + 1;
  let closing = false;
  if (source[cursor] === "/") {
    closing = true;
    cursor += 1;
  }
  while (/\s/.test(source[cursor] ?? "")) cursor += 1;
  const nameMatch = /^[A-Za-z][A-Za-z0-9-]*/.exec(source.slice(cursor));
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  cursor += nameMatch[0].length;
  const end = findTagEnd(source, cursor);
  if (end < 0) return null;
  const attributes = source.slice(cursor, end);
  return {
    closing,
    end,
    name,
    attributes,
    selfClosing: /\/\s*$/.test(attributes)
  };
}

function findTagEnd(source: string, start: number) {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function skipElementContent(source: string, start: number, tagName: string) {
  const closing = findClosingElement(source, start, tagName);
  return closing?.end ?? source.length;
}

function findClosingElement(source: string, start: number, tagName: string) {
  const lowerSource = source.toLowerCase();
  const marker = `</${tagName}`;
  let cursor = start;
  while (cursor < source.length) {
    const closingStart = lowerSource.indexOf(marker, cursor);
    if (closingStart < 0) return null;
    const boundary = lowerSource[closingStart + marker.length];
    if (boundary && !/[\s>\/]/.test(boundary)) {
      cursor = closingStart + marker.length;
      continue;
    }
    const closingEnd = findTagEnd(source, closingStart + marker.length);
    if (closingEnd < 0) return null;
    return { start: closingStart, end: closingEnd + 1 };
  }
  return null;
}

function sanitizeAttributes(tagName: string, source: string) {
  const parsed = parseAttributes(source);
  if (tagName === "meta") return sanitizeMetaAttributes(parsed);

  const allowedForElement = ELEMENT_ATTRIBUTES[tagName] ?? new Set<string>();
  const sanitized: ParsedAttribute[] = [];
  for (const attribute of parsed) {
    const { name } = attribute;
    if (name.startsWith("on") || name.includes(":") || name === "id" || name === "name") continue;
    if (!GLOBAL_ATTRIBUTES.has(name) && !allowedForElement.has(name) && !/^aria-[a-z0-9-]+$/.test(name)) continue;

    if (name === "style") {
      const css = sanitizeCss(attribute.value);
      if (css !== null && css.trim()) sanitized.push({ name, value: css });
      continue;
    }
    if (URL_ATTRIBUTES.has(name) && !isSafeUrl(tagName, name, attribute.value)) continue;
    if (NUMERIC_ATTRIBUTES.has(name) && !/^\d{1,6}$/.test(attribute.value)) continue;
    if (name === "loading" && !/^(?:lazy|eager)$/i.test(attribute.value)) continue;
    if (name === "decoding" && !/^(?:async|sync|auto)$/i.test(attribute.value)) continue;
    if (name === "dir" && !/^(?:ltr|rtl|auto)$/i.test(attribute.value)) continue;
    sanitized.push(attribute);
  }
  return sanitized;
}

function sanitizeMetaAttributes(attributes: ParsedAttribute[]) {
  const values = new Map(attributes.map((attribute) => [attribute.name, attribute.value]));
  if (values.has("http-equiv")) return [];
  if (values.get("charset")?.toLowerCase() === "utf-8") return [{ name: "charset", value: "utf-8" }];
  if (values.get("name")?.toLowerCase() === "viewport") {
    const content = values.get("content") ?? "";
    if (/^[a-z0-9.,= _-]{1,160}$/i.test(content)) {
      return [{ name: "name", value: "viewport" }, { name: "content", value: content }];
    }
  }
  return [];
}

function parseAttributes(source: string) {
  const attributes: ParsedAttribute[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s|\//.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;
    const nameMatch = /^[^\s=/>]+/.exec(source.slice(cursor));
    if (!nameMatch) {
      cursor += 1;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    cursor += nameMatch[0].length;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;

    let value = "";
    if (source[cursor] === "=") {
      cursor += 1;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      const quote = source[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const end = source.indexOf(quote, cursor);
        if (end < 0) break;
        value = source.slice(cursor, end);
        cursor = end + 1;
      } else {
        const valueMatch = /^[^\s>]+/.exec(source.slice(cursor));
        value = valueMatch?.[0] ?? "";
        cursor += value.length;
      }
    }
    if (!seen.has(name)) {
      seen.add(name);
      attributes.push({ name, value: decodeHtmlEntities(value) });
    }
  }
  return attributes;
}

function serializeAttributes(attributes: readonly ParsedAttribute[]) {
  return attributes.map(({ name, value }) => ` ${name}="${escapeAttribute(value)}"`).join("");
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isSafeUrl(tagName: string, attributeName: string, value: string) {
  if (!value || /[\u0000-\u001f\u007f-\u009f]/.test(value)) return false;
  const decoded = decodePercentEncoding(value.normalize("NFKC"));
  if (!decoded || decoded.includes("\\") || /[\u0000-\u001f\u007f-\u009f]/.test(decoded)) return false;
  const compact = decoded.replace(/\s/g, "");
  const lower = compact.toLowerCase();
  if (!compact || lower.startsWith("//")) return false;

  if (tagName === "img" && attributeName === "src" && lower.startsWith("data:")) {
    return /^data:image\/(?:png|jpeg|gif|webp|avif|bmp);base64,[a-z0-9+/]+={0,2}$/i.test(compact);
  }

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (!scheme) return true;
  return tagName === "a" && attributeName === "href" && new Set(["http", "https", "mailto", "tel"]).has(scheme);
}

function decodePercentEncoding(value: string) {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "";
    }
  }
  return decoded;
}

function sanitizeCss(source: string) {
  if (source.length > 1_000_000) return null;
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const inspected = decodeCssEscapes(decodeHtmlEntities(withoutComments)).normalize("NFKC");
  if (/@(?:import|namespace)|expression\s*\(|(?:behavior|-moz-binding)\s*:|image-set\s*\(/i.test(inspected)) return null;

  const urlStarts = inspected.match(/url\s*\(/gi)?.length ?? 0;
  let parsedUrls = 0;
  for (const match of inspected.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    parsedUrls += 1;
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!isSafeCssUrl(value)) return null;
  }
  if (urlStarts !== parsedUrls) return null;
  return withoutComments;
}

function isSafeCssUrl(value: string) {
  const decoded = decodePercentEncoding(value.normalize("NFKC"));
  if (!decoded || decoded.includes("\\") || /[\u0000-\u001f\u007f-\u009f]/.test(decoded)) return false;
  const compact = decoded.replace(/\s/g, "").toLowerCase();
  if (!compact || compact.startsWith("//")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(compact);
}

function decodeCssEscapes(value: string) {
  return value
    .replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\\([^\r\n\f0-9a-f])/gi, "$1");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);?/g, (_, code: string) => safeCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&(colon|tab|newline|amp|quot|apos|lt|gt);/gi, (_, name: string) => ({
      colon: ":",
      tab: "\t",
      newline: "\n",
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">"
    })[name.toLowerCase()] ?? "");
}

function safeCodePoint(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return "\ufffd";
  return String.fromCodePoint(value);
}
