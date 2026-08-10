import JSZip from "jszip";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";

import { hexToRgb, planOutputNames, preflightBatch } from "./core";
import type { Dataset, FontAsset, OutputFormat, TemplateDocument, TextField } from "./types";

function clonePreview(template: TemplateDocument): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = template.preview.width;
  canvas.height = template.preview.height;
  canvas.getContext("2d")?.drawImage(template.preview, 0, 0);
  return canvas;
}

function alignedX(
  field: TextField,
  textWidth: number,
  pageWidth: number,
  availableWidth: number,
): number {
  const start = field.x * pageWidth;
  if (field.alignment === "center") return start + (availableWidth - textWidth) / 2;
  if (field.alignment === "right") return start + availableWidth - textWidth;
  return start;
}

async function renderPdf(
  template: TemplateDocument,
  row: Record<string, string>,
  fields: TextField[],
  customFont?: FontAsset,
): Promise<Uint8Array> {
  let document: PDFDocument;
  let page: PDFPage;
  if (template.mimeType === "application/pdf") {
    document = await PDFDocument.load(template.bytes.slice());
    const firstPage = document.getPages()[0];
    if (!firstPage) throw new Error("The PDF template does not contain a page.");
    page = firstPage;
  } else {
    document = await PDFDocument.create();
    page = document.addPage([template.width, template.height]);
    const image =
      template.mimeType === "image/png"
        ? await document.embedPng(template.bytes)
        : await document.embedJpg(template.bytes);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  const standardFont = await document.embedFont(StandardFonts.Helvetica);
  let embeddedCustomFont: PDFFont | null = null;
  if (customFont) {
    document.registerFontkit(fontkit);
    embeddedCustomFont = await document.embedFont(customFont.bytes.slice(), { subset: true });
  }
  for (const field of fields) {
    page = document.getPages()[field.pageIndex] ?? page;
    if (!document.getPages()[field.pageIndex]) continue;
    const font =
      field.fontFamily === "custom" && embeddedCustomFont ? embeddedCustomFont : standardFont;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const text = row[field.column] ?? "";
    const availableWidth = field.width * pageWidth;
    let size = field.fontSize;
    if (field.fit === "shrink") {
      while (size > field.minFontSize && font.widthOfTextAtSize(text, size) > availableWidth)
        size -= 1;
    }
    const lines = field.fit === "wrap" ? wrapPdfText(text, font, size, availableWidth) : [text];
    const color = hexToRgb(field.color);
    lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: alignedX(field, textWidth, pageWidth, availableWidth),
        y: pageHeight - field.y * pageHeight - size - index * size * field.lineHeight,
        size,
        font,
        color: rgb(color.red, color.green, color.blue),
        maxWidth: availableWidth,
      });
    });
  }
  return document.save();
}

function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current || !lines.length) lines.push(current);
  return lines;
}

async function renderPng(
  template: TemplateDocument,
  row: Record<string, string>,
  fields: TextField[],
  customFont?: FontAsset,
): Promise<Blob> {
  const canvas = clonePreview(template);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  for (const field of fields) {
    if (field.pageIndex !== 0) continue;
    const text = row[field.column] ?? "";
    let fontSize = field.fontSize * (canvas.height / template.height);
    const family =
      field.fontFamily === "custom" && customFont ? `"${customFont.family}"` : "Arial, sans-serif";
    context.font = `${fontSize}px ${family}`;
    context.fillStyle = field.color;
    context.textBaseline = "top";
    context.textAlign = field.alignment;
    const left = field.x * canvas.width;
    const width = field.width * canvas.width;
    const x =
      field.alignment === "center"
        ? left + width / 2
        : field.alignment === "right"
          ? left + width
          : left;
    if (field.fit === "shrink") {
      while (fontSize > field.minFontSize && context.measureText(text).width > width) {
        fontSize -= 1;
        context.font = `${fontSize}px ${family}`;
      }
      context.fillText(text, x, field.y * canvas.height, width);
    } else if (field.fit === "wrap") {
      const lines: string[] = [];
      let current = "";
      for (const word of text.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && context.measureText(candidate).width > width) {
          lines.push(current);
          current = word;
        } else current = candidate;
      }
      if (current || !lines.length) lines.push(current);
      lines.forEach((line, index) =>
        context.fillText(
          line,
          x,
          field.y * canvas.height + index * fontSize * field.lineHeight,
          width,
        ),
      );
    } else context.fillText(text, x, field.y * canvas.height, width);
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG creation failed."))),
      "image/png",
    );
  });
}

export async function generateArchive(options: {
  template: TemplateDocument;
  dataset: Dataset;
  fields: TextField[];
  format: OutputFormat;
  filenamePattern: string;
  onProgress?: (completed: number, total: number) => void;
  customFont?: FontAsset;
}): Promise<Blob> {
  const { template, dataset, fields, format, filenamePattern, onProgress, customFont } = options;
  const zip = new JSZip();
  const names = planOutputNames(dataset.rows, filenamePattern, format);
  const preflight = preflightBatch({
    dataset,
    fields,
    template,
    format,
    hasCustomFont: Boolean(customFont),
  });
  for (const [index, row] of dataset.rows.entries()) {
    const name = names[index];
    if (!name) continue;
    const output =
      format === "pdf"
        ? await renderPdf(template, row, fields, customFont)
        : await renderPng(template, row, fields, customFont);
    zip.file(name.fileName, output);
    onProgress?.(index + 1, dataset.rows.length);
  }
  zip.file(
    "batch-document-studio-manifest.json",
    JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        template: template.name,
        source: dataset.sourceName,
        format,
        recordCount: dataset.rows.length,
        pageCount: template.pageSizes.length,
        customFont: customFont?.name ?? null,
        preflight: preflight.counts,
        files: names.map(({ rowIndex, fileName }) => ({ rowNumber: rowIndex + 2, fileName })),
      },
      null,
      2,
    ),
  );
  zip.file("batch-document-studio-preflight.json", JSON.stringify(preflight, null, 2));
  const proofRows = dataset.rows.map((_row, index) => {
    const rowNumber = index + 2;
    const counts = preflight.findings
      .filter((finding) => finding.rowNumber === rowNumber)
      .reduce<Record<string, number>>((result, finding) => {
        result[finding.code] = (result[finding.code] ?? 0) + 1;
        return result;
      }, {});
    return `${rowNumber},${Object.values(counts).reduce((sum, count) => sum + count, 0)},${Object.entries(
      counts,
    )
      .map(([code, count]) => `${code}:${count}`)
      .join(";")}`;
  });
  zip.file(
    "batch-document-studio-proof.csv",
    `row_number,finding_count,summary\n${proofRows.join("\n")}\n`,
  );
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
