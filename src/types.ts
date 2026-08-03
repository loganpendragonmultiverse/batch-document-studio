export type OutputFormat = "pdf" | "png";
export type TextAlignment = "left" | "center" | "right";

export interface Dataset {
  headers: string[];
  rows: Record<string, string>[];
  sourceName: string;
}

export interface TextField {
  id: string;
  column: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  alignment: TextAlignment;
}

export interface TemplateDocument {
  bytes: Uint8Array;
  name: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  width: number;
  height: number;
  preview: HTMLCanvasElement;
}

export interface OutputName {
  rowIndex: number;
  baseName: string;
  fileName: string;
}
