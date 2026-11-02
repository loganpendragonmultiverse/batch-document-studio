import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { normalizeHeaders, planOutputNames } from "../src/core";
import { generateQueue } from "../src/queue";
import { parseCsv, parseRows, readSpreadsheet } from "../src/spreadsheet";
import type { TemplateDocument } from "../src/types";

describe("recipient preservation", () => {
  it("retains authored suffixes and every normalized column", () => {
    const headers = normalizeHeaders(["name", "name", "name_2", "", "column_4"]);
    expect(new Set(headers.map((header) => header.toLowerCase())).size).toBe(5);
    expect(headers).toContain("name_2");
    const dataset = parseRows(
      [
        ["name", "name", "name_2"],
        ["first", "second", "third"],
      ],
      "local",
    );
    expect(Object.values(dataset.rows[0]!)).toEqual(["first", "second", "third"]);
  });

  it("allocates globally unique filenames around authored suffixes", () => {
    const rows = ["A", "A", "A-2", "a-3", "A"].map((name) => ({ name }));
    const names = planOutputNames(rows, "{name}", "pdf").map((item) => item.fileName);
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(rows.length);
    expect(names).toContain("A-2.pdf");
    expect(names).toContain("a-3.pdf");
  });

  it.each([1, 2, 50])(
    "preserves every PDF and row identity across ZIP parts of %i",
    async (batchSize) => {
      const pdf = await PDFDocument.create();
      pdf.addPage([100, 100]);
      const template = {
        bytes: await pdf.save(),
        name: "blank.pdf",
        mimeType: "application/pdf",
        width: 100,
        height: 100,
        pageSizes: [{ width: 100, height: 100 }],
        previews: [],
        preview: {} as HTMLCanvasElement,
      } as TemplateDocument;
      const names: string[] = [],
        rowNumbers: number[] = [];
      const rows = ["A", "A", "A-2"].map((name) => ({ name }));
      await generateQueue({
        template,
        dataset: { sourceName: "local.csv", headers: ["name"], rows, rowNumbers: [2, 4, 9] },
        fields: [],
        format: "pdf",
        filenamePattern: "{name}",
        batchSize,
        onArchive: async (blob) => {
          const zip = await JSZip.loadAsync(await blob.arrayBuffer());
          const manifest = JSON.parse(
            await zip.file("batch-document-studio-manifest.json")!.async("string"),
          );
          const entries = Object.keys(zip.files).filter((name) => name.endsWith(".pdf"));
          expect(entries).toHaveLength(manifest.recordCount);
          for (const item of manifest.files) {
            expect(entries).toContain(item.fileName);
            expect(
              (
                await PDFDocument.load(await zip.file(item.fileName)!.async("uint8array"))
              ).getPageCount(),
            ).toBe(1);
            names.push(item.fileName);
            rowNumbers.push(item.rowNumber);
          }
        },
      });
      expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(3);
      expect(rowNumbers).toEqual([2, 4, 9]);
    },
  );
});

describe("strict spreadsheet admission", () => {
  it.each(['name\nA"lex"', 'name\n"Alex"tail', 'name\n"Alex" "B"'])(
    "rejects malformed quoting without including cell values",
    (text) => {
      expect(() => parseCsv(text)).toThrow(/CSV/);
    },
  );
  it("rejects nonempty cells beyond the header and preserves short XLSX rows", () => {
    expect(() => parseRows([["name"], ["A", "private-extra"]], "local")).toThrow(/row 2/i);
    expect(parseRows([["name", "award"], ["A"]], "local").rows).toEqual([{ name: "A", award: "" }]);
  });
  it("rejects ragged CSV rows but accepts quoted newlines and blank rows", async () => {
    for (const text of ["name,award\nA", "name\nA,extra"])
      await expect(readSpreadsheet(new File([text], "local.csv"))).rejects.toThrow(/row 2/i);
    expect(
      (await readSpreadsheet(new File(['name,note\r\n\r\nA,"line 1\nline 2"\r\n'], "local.csv")))
        .rowNumbers,
    ).toEqual([3]);
  });
});

it("accepts a BOM before a quoted header", async () => {
  expect(
    (await readSpreadsheet(new File(['\ufeff"name",note\nAlex,"ok"'], "bom.csv"))).rows,
  ).toEqual([{ name: "Alex", note: "ok" }]);
});
