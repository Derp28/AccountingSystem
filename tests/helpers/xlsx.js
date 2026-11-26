import { Buffer } from "node:buffer";

/**
 * Read the stored ZIP container that makes up an .xlsx file. The production
 * writer uses stored entries, so tests can inspect the XML directly without a
 * compression dependency.
 */
export function readZipEntries(bytes) {
  const buffer = Buffer.from(bytes);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let endOfCentralDirectory = -1;
  const firstPossible = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= firstPossible; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOfCentralDirectory = offset;
      break;
    }
  }
  if (endOfCentralDirectory < 0) throw new Error("The workbook has no ZIP end record.");

  const count = view.getUint16(endOfCentralDirectory + 10, true);
  const centralOffset = view.getUint32(endOfCentralDirectory + 16, true);
  const entries = new Map();
  let offset = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("The workbook has an invalid ZIP central directory.");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`The workbook has an invalid local header for ${name}.`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method !== 0) throw new Error(`The workbook entry ${name} is not stored.`);

    entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function readZipText(entries, name) {
  const data = entries.get(name);
  if (!data) throw new Error(`The workbook is missing ${name}.`);
  return data.toString("utf8");
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function workbookSheetNames(entries) {
  const workbook = readZipText(entries, "xl/workbook.xml");
  return [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((match) =>
    decodeXml(match[1]),
  );
}

export function worksheetXml(entries, sheetName) {
  const workbook = readZipText(entries, "xl/workbook.xml");
  const relationships = readZipText(entries, "xl/_rels/workbook.xml.rels");
  const sheet = [...workbook.matchAll(/<sheet\b[^>]*\/>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`name="${sheetName}"`));
  if (!sheet) throw new Error(`The workbook has no sheet named ${sheetName}.`);
  const relationshipId = /\br:id="([^"]+)"/.exec(sheet)?.[1];
  if (!relationshipId) throw new Error(`The sheet ${sheetName} has no relationship.`);
  const relationship = [...relationships.matchAll(/<Relationship\b[^>]*\/>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`Id="${relationshipId}"`));
  const target = relationship && /\bTarget="([^"]+)"/.exec(relationship)?.[1];
  if (!target) throw new Error(`The sheet ${sheetName} has no target.`);
  return readZipText(entries, `xl/${target}`);
}

export function cellValue(sheetXml, reference) {
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<c\\b[^>]*\\br="${escaped}"[^>]*>([\\s\\S]*?)</c>`).exec(
    sheetXml,
  );
  if (!match) return null;
  const body = match[1];
  const text = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
  if (text !== undefined) return decodeXml(text);
  const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
  return value === undefined ? null : decodeXml(value);
}
