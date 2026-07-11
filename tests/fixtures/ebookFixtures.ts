import { strToU8, zipSync } from "fflate";

export function createSpineEpubBytes() {
  return zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": xml(`<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/content.opf": xml(`<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">omni-test-book</dc:identifier><dc:title>Spine Order</dc:title></metadata><manifest><item id="details" href="chapter-a.xhtml" media-type="application/xhtml+xml"/><item id="opening" href="chapter-b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="opening"/><itemref idref="details"/></spine></package>`),
    "OEBPS/chapter-a.xhtml": xhtml(`<article><h1>Details</h1><p>Second in reading order.</p></article>`),
    "OEBPS/chapter-b.xhtml": xhtml(`<article><h1 onclick="alert(1)">Opening</h1><p>First in reading order with <strong>real structure</strong>.</p><script>window.compromised=true</script><a href="javascript:alert(1)">Read</a></article>`)
  }, { level: 6 });
}

function xml(source: string) {
  return strToU8(`<?xml version="1.0" encoding="UTF-8"?>${source}`);
}

function xhtml(body: string) {
  return xml(`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Fixture chapter</title></head><body>${body}</body></html>`);
}
