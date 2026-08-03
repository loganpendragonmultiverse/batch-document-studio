import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { hexToRgb, planOutputNames } from "./core";
import type { Dataset, OutputFormat, TemplateDocument, TextField } from "./types";

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
): Promise<Uint8Array> {
  let document: PDFDocument;
  let page;
  if (template.mimeType === "application/pdf") {
    document = await PDFDocument.load(template.bytes.slice());
    page = document.getPages()[0];
    if (!page) throw new Error("The PDF template does not contain a page.");
  } else {
    document = await PDFDocument.create();
    page = document.addPage([template.width, template.height]);
    const image =
      template.mimeType === "image/png"
        ? await document.embedPng(template.bytes)
        : await document.embedJpg(template.bytes);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  for (const field of fields) {
    const text = row[field.column] ?? "";
    const textWidth = font.widthOfTextAtSize(text, field.fontSize);
    const availableWidth = field.width * pageWidth;
    const color = hexToRgb(field.color);
    page.drawText(text, {
      x: alignedX(field, textWidth, pageWidth, availableWidth),
      y: pageHeight - field.y * pageHeight - field.fontSize,
      size: field.fontSize,
      font,
      color: rgb(color.red, color.green, color.blue),
      maxWidth: availableWidth,
    });
  }
  return document.save();
}

async function renderPng(
  template: TemplateDocument,
  row: Record<string, string>,
  fields: TextField[],
): Promise<Blob> {
  const canvas = clonePreview(template);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  for (const field of fields) {
    const text = row[field.column] ?? "";
    const fontSize = field.fontSize * (canvas.height / template.height);
    context.font = `${fontSize}px Arial, sans-serif`;
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
    context.fillText(text, x, field.y * canvas.height, width);
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
}): Promise<Blob> {
  const { template, dataset, fields, format, filenamePattern, onProgress } = options;
  const zip = new JSZip();
  const names = planOutputNames(dataset.rows, filenamePattern, format);
  for (const [index, row] of dataset.rows.entries()) {
    const name = names[index];
    if (!name) continue;
    const output =
      format === "pdf"
        ? await renderPdf(template, row, fields)
        : await renderPng(template, row, fields);
    zip.file(name.fileName, output);
    onProgress?.(index + 1, dataset.rows.length);
  }
  zip.file(
    "batch-document-studio-manifest.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        template: template.name,
        source: dataset.sourceName,
        format,
        recordCount: dataset.rows.length,
        files: names.map(({ rowIndex, fileName }) => ({ rowNumber: rowIndex + 2, fileName })),
      },
      null,
      2,
    ),
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
