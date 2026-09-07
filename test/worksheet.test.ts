import { expect, it, vi } from "vitest";
vi.mock("read-excel-file/browser", () => ({
  default: vi.fn(async () => [
    { sheet: "People", data: [] },
    { sheet: "Awards", data: [] },
  ]),
  readSheet: vi.fn(async (_file, sheet) => [["name"], [sheet]]),
}));
import { readSpreadsheet, worksheetNames, parseRows } from "../src/spreadsheet";
it("lists worksheets and passes the explicit choice into parsing", async () => {
  const file = new File(["fixture"], "book.xlsx");
  expect(await worksheetNames(file)).toEqual(["People", "Awards"]);
  expect((await readSpreadsheet(file, "Awards")).rows).toEqual([{ name: "Awards" }]);
  expect((await readSpreadsheet(new File(["name\nAda"], "rows.csv"))).rows).toEqual([
    { name: "Ada" },
  ]);
  expect(await worksheetNames(new File([], "rows.csv"))).toEqual([]);
  await expect(readSpreadsheet(new File([], "bad.txt"))).rejects.toThrow("CSV or XLSX");
  await expect(worksheetNames({ size: 26 * 1024 * 1024 } as File)).rejects.toThrow("25 MB");
  expect(parseRows([["name"], ["A"], [""], ["B"]], "book").rowNumbers).toEqual([2, 4]);
});
