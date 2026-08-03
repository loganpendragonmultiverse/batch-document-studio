import { readSheet } from "read-excel-file/browser";

import { normalizeHeaders } from "./core";
import type { Dataset } from "./types";

export function parseRows(matrix: unknown[][], sourceName: string): Dataset {
  if (matrix.length === 0) throw new Error("The spreadsheet is empty.");
  const rawHeaders = matrix[0] ?? [];
  const headers = normalizeHeaders(rawHeaders);
  const rows = matrix
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, String(values[index] ?? "").trim()]),
      ),
    );
  const nonEmptyRows = rows.filter((row) => Object.values(row).some((value) => value !== ""));
  if (nonEmptyRows.length === 0) throw new Error("The spreadsheet has headers but no data rows.");
  return { headers, rows: nonEmptyRows, sourceName };
}

export function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted value.");
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export async function readSpreadsheet(file: File): Promise<Dataset> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseRows(parseCsv(await file.text()), file.name);
  if (extension === "xlsx") return parseRows((await readSheet(file)) as unknown[][], file.name);
  throw new Error("Choose a CSV or XLSX spreadsheet.");
}
