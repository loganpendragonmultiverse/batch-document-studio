import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { generateArchive } from "../src/render";
import type { TemplateDocument, TextField } from "../src/types";

describe("PDF batch generation", () => {
  it("produces one PDF per row and a data-minimized manifest", async () => {
    const source = await PDFDocument.create();
    source.addPage([600, 400]);
    source.addPage([600, 400]);
    const template: TemplateDocument = {
      bytes: await source.save(),
      name: "award.pdf",
      mimeType: "application/pdf",
      width: 600,
      height: 400,
      preview: {} as HTMLCanvasElement,
      previews: [{} as HTMLCanvasElement, {} as HTMLCanvasElement],
      pageSizes: [
        { width: 600, height: 400 },
        { width: 600, height: 400 },
      ],
    };
    const field: TextField = {
      id: "recipient",
      column: "name",
      x: 0.2,
      y: 0.4,
      width: 0.6,
      height: 0.15,
      fontSize: 28,
      color: "#112233",
      alignment: "center",
      pageIndex: 0,
      fit: "shrink",
      minFontSize: 10,
      lineHeight: 1.2,
      fontFamily: "helvetica",
    };
    const archive = await generateArchive({
      template,
      dataset: {
        sourceName: "people.csv",
        headers: ["name", "private_note"],
        rows: [
          { name: "Avery", private_note: "do not copy" },
          { name: "Avery", private_note: "also private" },
        ],
      },
      fields: [field, { ...field, id: "recipient-page-two", pageIndex: 1 }],
      format: "pdf",
      filenamePattern: "{name}",
    });
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual([
      "Avery-2.pdf",
      "Avery.pdf",
      "batch-document-studio-manifest.json",
      "batch-document-studio-preflight.json",
      "batch-document-studio-proof.csv",
    ]);
    const manifestText = await zip.file("batch-document-studio-manifest.json")?.async("string");
    expect(manifestText).toBeTruthy();
    expect(manifestText).not.toContain("private_note");
    expect(manifestText).not.toContain("do not copy");
    const generatedBytes = await zip.file("Avery.pdf")?.async("uint8array");
    expect(generatedBytes).toBeTruthy();
    expect((await PDFDocument.load(generatedBytes!)).getPageCount()).toBe(2);
    expect(await zip.file("batch-document-studio-proof.csv")?.async("string")).toContain(
      "row_number",
    );
  });
});
