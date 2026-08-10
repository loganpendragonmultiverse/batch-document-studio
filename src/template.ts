import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { TemplateDocument } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPPORTED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;

function canvasFor(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadImage(bytes: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
  const image = new Image();
  const byteCopy = bytes.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([byteCopy], { type: mimeType }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image template could not be decoded."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function previewPdf(bytes: Uint8Array): Promise<{
  previews: HTMLCanvasElement[];
  pageSizes: Array<{ width: number; height: number }>;
}> {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await task.promise;
  const previews: HTMLCanvasElement[] = [];
  const pageSizes: Array<{ width: number; height: number }> = [];
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const natural = page.getViewport({ scale: 1 });
    pageSizes.push({ width: natural.width, height: natural.height });
    const scale = Math.min(2, 1400 / natural.width);
    const viewport = page.getViewport({ scale });
    const canvas = canvasFor(Math.round(viewport.width), Math.round(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is not available in this browser.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    previews.push(canvas);
  }
  return { previews, pageSizes };
}

export async function readTemplate(file: File): Promise<TemplateDocument> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("Choose a PDF, PNG, or JPEG template.");
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    throw new Error("The template exceeds the 25 MB safety limit.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    const { previews, pageSizes } = await previewPdf(bytes);
    const preview = previews[0];
    if (!preview) throw new Error("The PDF template does not contain a page.");
    return {
      bytes,
      name: file.name,
      mimeType: "application/pdf",
      width: preview.width,
      height: preview.height,
      preview,
      previews,
      pageSizes,
    };
  }
  const image = await loadImage(bytes, file.type);
  const preview = canvasFor(image.naturalWidth, image.naturalHeight);
  const context = preview.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  context.drawImage(image, 0, 0);
  return {
    bytes,
    name: file.name,
    mimeType: file.type as TemplateDocument["mimeType"],
    width: image.naturalWidth,
    height: image.naturalHeight,
    preview,
    previews: [preview],
    pageSizes: [{ width: image.naturalWidth, height: image.naturalHeight }],
  };
}
