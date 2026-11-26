/**
 * Minimal Office Open XML workbook writer.
 *
 * The app deliberately has no spreadsheet dependency. An .xlsx file is a ZIP
 * container of XML parts, so this module writes the small subset of OOXML that
 * Excel, LibreOffice, and Google Sheets need for text, numbers, and light
 * formatting. ZIP entries are stored (not compressed); that keeps the writer
 * synchronous and available in both the browser and Node tests.
 */

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL_WORKSHEET = `${NS_REL}/worksheet`;
const REL_STYLES = `${NS_REL}/styles`;
const REL_OFFICE_DOCUMENT = `${NS_REL}/officeDocument`;

const encoder = new TextEncoder();

export const STYLE_IDS = Object.freeze({
  default: 0,
  header: 1,
  money: 2,
  moneyBold: 3,
  bold: 4,
  title: 5,
  note: 6,
  wrap: 7,
  section: 8,
  total: 9,
  totalLabel: 10,
});

function styleId(style) {
  if (Number.isInteger(style) && style >= 0 && style <= STYLE_IDS.totalLabel) return style;
  if (typeof style === "string" && Object.hasOwn(STYLE_IDS, style)) return STYLE_IDS[style];
  return STYLE_IDS.default;
}

/** Convert integer cents to an exact decimal string without binary floating point. */
export function centsToDecimal(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "0.00";
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function sanitizeSheetName(value, used) {
  const base =
    String(value || "Sheet")
      .replace(/[\[\]:*?/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tag = ` (${suffix++})`;
    candidate = `${base.slice(0, 31 - tag.length)}${tag}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function normalizeCell(cell) {
  if (cell === null || cell === undefined || cell === "") {
    return { type: "blank", style: STYLE_IDS.default };
  }
  if (typeof cell === "string") {
    return { type: "text", value: cell, style: STYLE_IDS.default };
  }
  if (typeof cell === "number") {
    return { type: "number", value: String(cell), style: STYLE_IDS.default };
  }
  if (typeof cell === "boolean") {
    return { type: "text", value: cell ? "Yes" : "No", style: STYLE_IDS.default };
  }
  if (typeof cell !== "object") {
    return { type: "text", value: String(cell), style: STYLE_IDS.default };
  }
  if (Object.hasOwn(cell, "text")) {
    return { type: "text", value: String(cell.text ?? ""), style: styleId(cell.style) };
  }
  if (Object.hasOwn(cell, "cents")) {
    return {
      type: "number",
      value: centsToDecimal(cell.cents),
      style: styleId(cell.style ?? "money"),
    };
  }
  if (Object.hasOwn(cell, "number")) {
    const value = Number(cell.number);
    return {
      type: "number",
      value: Number.isFinite(value) ? String(value) : "0",
      style: styleId(cell.style),
    };
  }
  if (Object.hasOwn(cell, "value")) {
    return normalizeCell(cell.value);
  }
  return { type: "blank", style: styleId(cell.style) };
}

function cellXml(reference, rawCell) {
  const cell = normalizeCell(rawCell);
  const style = cell.style ? ` s="${cell.style}"` : "";
  if (cell.type === "text") {
    const text = escapeXml(cell.value);
    const preserve = /^\s|\s$|\n/.test(cell.value) ? ' xml:space="preserve"' : "";
    return `<c r="${reference}" t="inlineStr"${style}><is><t${preserve}>${text}</t></is></c>`;
  }
  if (cell.type === "number") {
    return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  }
  return style ? `<c r="${reference}"${style}/>` : "";
}

function worksheetXml(sheet) {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  const columnCount = rows.reduce(
    (maximum, row) => Math.max(maximum, Array.isArray(row) ? row.length : 0),
    0,
  );
  const lastColumn = columnName(Math.max(0, columnCount - 1));
  const lastRow = Math.max(1, rows.length);
  const freezeRow = Number.isInteger(sheet.freezeRow)
    ? Math.max(0, Math.min(sheet.freezeRow, rows.length))
    : 1;

  const columns = Array.isArray(sheet.columns)
    ? sheet.columns
        .map((column, index) => {
          const width = typeof column === "number" ? column : Number(column?.width);
          if (!Number.isFinite(width) || width <= 0) return "";
          return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        })
        .join("")
    : "";

  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = (Array.isArray(row) ? row : []).map((cell, columnIndex) =>
        cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, cell),
      );
      const hasHeader = (Array.isArray(row) ? row : []).some(
        (cell) => normalizeCell(cell).style === STYLE_IDS.header,
      );
      const height = hasHeader ? ' ht="22" customHeight="1"' : "";
      return `<row r="${rowIndex + 1}"${height}>${cells.join("")}</row>`;
    })
    .join("");

  const pane =
    freezeRow > 0
      ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/>`
      : "";

  return `${XML_HEADER}
<worksheet xmlns="${NS_MAIN}">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${columns ? `<cols>${columns}</cols>` : ""}
  <sheetData>${rowXml}</sheetData>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;
}

function stylesXml() {
  return `${XML_HEADER}
<styleSheet xmlns="${NS_MAIN}">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;(#,##0.00)"/></numFmts>
  <fonts count="4">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><sz val="10"/><color rgb="FF5E6B63"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEE9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4F6F4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFD5DDD7"/></bottom><diagonal/></border>
    <border><left/><right/><top style="thin"><color rgb="FF9AA9A0"/></top><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function workbookXml(sheets) {
  const sheetXml = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `${XML_HEADER}
<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheetXml}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets) {
  const sheetRels = sheets
    .map(
      (sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  return `${XML_HEADER}
<Relationships xmlns="${NS_PACKAGE_REL}">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="${REL_STYLES}" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets) {
  const sheetOverrides = sheets
    .map(
      (sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function rootRelsXml() {
  return `${XML_HEADER}
<Relationships xmlns="${NS_PACKAGE_REL}">
  <Relationship Id="rId1" Type="${REL_OFFICE_DOCUMENT}" Target="xl/workbook.xml"/>
</Relationships>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function dosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const year = Math.max(1980, Math.min(2107, safe.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((safe.getMonth() + 1) << 5) | safe.getDate(),
    time:
      (safe.getHours() << 11) |
      (safe.getMinutes() << 5) |
      Math.floor(safe.getSeconds() / 2),
  };
}

function concat(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipStored(files, generatedAt) {
  const chunks = [];
  const central = [];
  const stamp = dosDateTime(generatedAt);
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const checksum = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, stamp.time);
    writeUint16(localView, 12, stamp.date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    local.set(name, 30);

    chunks.push(local, data);

    const header = new Uint8Array(46 + name.length);
    const headerView = new DataView(header.buffer);
    writeUint32(headerView, 0, 0x02014b50);
    writeUint16(headerView, 4, 20);
    writeUint16(headerView, 6, 20);
    writeUint16(headerView, 8, 0x0800);
    writeUint16(headerView, 10, 0);
    writeUint16(headerView, 12, stamp.time);
    writeUint16(headerView, 14, stamp.date);
    writeUint32(headerView, 16, checksum);
    writeUint32(headerView, 20, data.length);
    writeUint32(headerView, 24, data.length);
    writeUint16(headerView, 28, name.length);
    writeUint16(headerView, 30, 0);
    writeUint16(headerView, 32, 0);
    writeUint16(headerView, 34, 0);
    writeUint16(headerView, 36, 0);
    writeUint32(headerView, 38, 0);
    writeUint32(headerView, 42, offset);
    header.set(name, 46);

    central.push(header);
    offset += local.length + data.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const header of central) {
    chunks.push(header);
    centralSize += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, centralOffset);
  writeUint16(endView, 20, 0);
  chunks.push(end);

  return concat(chunks);
}

/**
 * Build an .xlsx workbook from plain sheet descriptions.
 *
 * A cell can be a string, number, null, or one of:
 *   { text, style }, { cents, style }, { number, style }
 * Styles are names from STYLE_IDS. Strings are always written as inline text,
 * never as formulas, so user-entered values cannot become Excel formulas.
 */
export function buildXlsx(sheets, { generatedAt = new Date() } = {}) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error("A workbook needs at least one worksheet.");
  }

  const usedNames = new Set();
  const normalized = sheets.map((sheet) => ({
    ...sheet,
    name: sanitizeSheetName(sheet?.name, usedNames),
    rows: Array.isArray(sheet?.rows) ? sheet.rows : [],
  }));

  const files = [
    { name: "[Content_Types].xml", data: contentTypesXml(normalized) },
    { name: "_rels/.rels", data: rootRelsXml() },
    { name: "xl/workbook.xml", data: workbookXml(normalized) },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(normalized) },
    { name: "xl/styles.xml", data: stylesXml() },
    ...normalized.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet),
    })),
  ];

  return zipStored(files, generatedAt);
}
