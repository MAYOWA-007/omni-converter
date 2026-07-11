import { strToU8, zipSync } from "fflate";

export function createMultiSheetXlsxBytes() {
  return zipSync({
    "[Content_Types].xml": xml(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      </Types>`),
    "_rels/.rels": xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>`),
    "xl/workbook.xml": xml(`
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="Finance 2026" sheetId="1" r:id="rId1"/>
          <sheet name="Notes &amp; QA" sheetId="2" r:id="rId2"/>
        </sheets>
      </workbook>`),
    "xl/_rels/workbook.xml.rels": xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
      </Relationships>`),
    "xl/worksheets/sheet1.xml": worksheet([
      [inline("A1", "name"), inline("B1", "count"), inline("C1", "formula"), inline("D1", "active")],
      [inline("A2", "Alpha"), number("B2", 2), inline("C2", "=2+2"), bool("D2", true)],
      [inline("A3", "Zoë"), number("B3", 7), inline("C3", "  @SUM(A1:A2)"), bool("D3", false)]
    ]),
    "xl/worksheets/sheet2.xml": worksheet([
      [inline("A1", "item"), inline("B1", "note")],
      [inline("A2", "Widget"), inline("B2", "comma, and\nline")]
    ])
  }, { level: 6 });
}

export const QUOTED_CSV = 'name,count,active,note,formula\r\n"Zoë",7,true,"comma, and\nline",=2+2\r\nAlpha,007,false,plain,@command';

function worksheet(rows: string[][]) {
  return xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((cells, index) => `<row r="${index + 1}">${cells.join("")}</row>`).join("")}</sheetData></worksheet>`);
}

function inline(reference: string, value: string) {
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function number(reference: string, value: number) {
  return `<c r="${reference}" t="n"><v>${value}</v></c>`;
}

function bool(reference: string, value: boolean) {
  return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
}

function xml(source: string) {
  return strToU8(`<?xml version="1.0" encoding="UTF-8"?>${source.replace(/>\s+</g, "><").trim()}`);
}

function escapeXml(value: string) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
}
