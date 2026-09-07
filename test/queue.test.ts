import { expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { generateArchive } from "../src/render";
import { generateQueue } from "../src/queue";
import type { TemplateDocument } from "../src/types";
async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  return {
    template: {
      bytes: await pdf.save(),
      name: "blank.pdf",
      mimeType: "application/pdf",
      width: 100,
      height: 100,
      pageSizes: [{ width: 100, height: 100 }],
      previews: [],
      preview: {} as HTMLCanvasElement,
    } as TemplateDocument,
    dataset: {
      sourceName: "local.csv",
      headers: ["name"],
      rows: [{ name: "A" }, { name: "B" }, { name: "C" }],
      rowNumbers: [2, 4, 8],
    },
    fields: [],
    format: "pdf" as const,
    filenamePattern: "{name}",
  };
}
it("awaits each consumed part and retains worksheet evidence", async () => {
  const options = await fixture();
  const parts: number[] = [];
  const total = await generateQueue({
    ...options,
    batchSize: 1,
    onArchive: async (blob, part) => {
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const manifest = JSON.parse(
        await zip.file("batch-document-studio-manifest.json")!.async("string"),
      );
      expect(manifest.files[0].rowNumber).toBe(options.dataset.rowNumbers[part - 1]);
      parts.push(part);
    },
  });
  expect(total).toBe(3);
  expect(parts).toEqual([1, 2, 3]);
});
it("cancels after a part without rendering subsequent parts", async () => {
  const controller = new AbortController();
  let parts = 0;
  await expect(
    generateQueue({
      ...(await fixture()),
      signal: controller.signal,
      batchSize: 1,
      onArchive: async () => {
        parts++;
        controller.abort();
      },
    }),
  ).rejects.toThrow();
  expect(parts).toBe(1);
});
it("rejects buffer overflow and invalid queue sizes", async () => {
  const options = await fixture();
  await expect(generateArchive({ ...options, maxBytes: 1 })).rejects.toThrow("buffer limit");
  await expect(
    generateQueue({ ...options, batchSize: 0, onArchive: async () => {} }),
  ).rejects.toThrow("1–50");
  const c = new AbortController();
  c.abort();
  await expect(generateArchive({ ...options, signal: c.signal })).rejects.toThrow();
});
