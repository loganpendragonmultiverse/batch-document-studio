import { describe, expect, it } from "vitest";

import { parseCsv, parseRows } from "../src/spreadsheet";

describe("parseCsv", () => {
  it("reads commas, CRLF lines, and escaped quotes", () => {
    expect(parseCsv('name,award\r\n"Reed, Morgan","Builder ""Gold"""\r\n')).toEqual([
      ["name", "award"],
      ["Reed, Morgan", 'Builder "Gold"'],
    ]);
  });

  it("preserves newlines inside quoted cells", () => {
    expect(parseCsv('name,note\nAvery,"First\nSecond"')).toEqual([
      ["name", "note"],
      ["Avery", "First\nSecond"],
    ]);
  });

  it("rejects unterminated quoted values", () => {
    expect(() => parseCsv('name\n"Avery')).toThrow("unterminated");
  });
});

describe("parseRows", () => {
  it("reads records and ignores fully blank rows", () => {
    const result = parseRows(
      [
        ["first_name", "award"],
        ["Avery", "Leadership"],
        ["", ""],
        ["Morgan", "Completion"],
      ],
      "records.xlsx",
    );
    expect(result.headers).toEqual(["first_name", "award"]);
    expect(result.rows).toEqual([
      { first_name: "Avery", award: "Leadership" },
      { first_name: "Morgan", award: "Completion" },
    ]);
  });

  it("rejects empty spreadsheets", () => {
    expect(() => parseRows([], "empty.xlsx")).toThrow("empty");
  });

  it("rejects headers without data rows", () => {
    expect(() => parseRows([["name"]], "headers.xlsx")).toThrow("no data rows");
  });
});
