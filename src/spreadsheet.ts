import readSheets, { readSheet } from "read-excel-file/browser";

import { normalizeHeaders } from "./core";
import type { Dataset } from "./types";

export function parseRows(matrix: unknown[][], sourceName: string, exactWidth = false): Dataset {
  if (matrix.length === 0) throw new Error("The spreadsheet is empty.");
  const rawHeaders = matrix[0] ?? [];
  const headers = normalizeHeaders(rawHeaders);
  const rows = matrix.slice(1).map((values, index) => {
    const populated = values.some((value) => String(value ?? "").trim() !== "");
    if (
      populated &&
      ((exactWidth && values.length !== headers.length) ||
        values.slice(headers.length).some((value) => String(value ?? "").trim() !== ""))
    ) {
      throw new Error(`Spreadsheet row ${index + 2} does not match the header width.`);
    }
    return Object.fromEntries(
      headers.map((header, column) => [header, String(values[column] ?? "").trim()]),
    );
  });
  const nonEmptyRows = rows.filter((row) => Object.values(row).some((value) => value !== ""));
  if (nonEmptyRows.length === 0) throw new Error("The spreadsheet has headers but no data rows.");
  return {
    headers,
    rows: nonEmptyRows,
    sourceName,
    rowNumbers: rows.flatMap((row, i) =>
      Object.values(row).some((value) => value !== "") ? [i + 2] : [],
    ),
  };
}

export function parseCsv(text: string): unknown[][] {
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "";
  let quoted = false,
    closed = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"') {
        if (next === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += character;
    } else if (character === ",") {
      row.push(value);
      value = "";
      closed = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      closed = false;
    } else if (character === '"') {
      if (value !== "" || closed)
        throw new Error(`The CSV contains invalid quoting in record ${rows.length + 1}.`);
      quoted = true;
    } else {
      if (closed)
        throw new Error(
          `The CSV contains text after a closing quote in record ${rows.length + 1}.`,
        );
      value += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted value.");
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export async function readSpreadsheet(file: File, sheet: string | number = 1): Promise<Dataset> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseRows(parseCsv(await file.text()), file.name, true);
  if (extension === "xlsx")
    return parseRows((await readSheet(file, sheet)) as unknown[][], file.name);
  throw new Error("Choose a CSV or XLSX spreadsheet.");
}

export async function worksheetNames(file: File): Promise<string[]> {
  if (file.size > 25 * 1024 * 1024) throw new Error("Spreadsheet exceeds 25 MB.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return [];
  return (await readSheets(file)).map((sheet) => sheet.sheet);
}
