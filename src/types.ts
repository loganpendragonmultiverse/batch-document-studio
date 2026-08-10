export type OutputFormat = "pdf" | "png";
export type TextAlignment = "left" | "center" | "right";
export type TextFit = "clip" | "shrink" | "wrap";

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
  height: number;
  fontSize: number;
  color: string;
  alignment: TextAlignment;
  pageIndex: number;
  fit: TextFit;
  minFontSize: number;
  lineHeight: number;
  fontFamily: "helvetica" | "custom";
}

export interface TemplateDocument {
  bytes: Uint8Array;
  name: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  width: number;
  height: number;
  preview: HTMLCanvasElement;
  previews: HTMLCanvasElement[];
  pageSizes: Array<{ width: number; height: number }>;
}

export interface FontAsset {
  bytes: Uint8Array;
  name: string;
  family: string;
}

export interface ProjectRecipe {
  format: "batch-document-studio-recipe";
  version: 1;
  createdAt: string;
  template: { name: string; mimeType: TemplateDocument["mimeType"]; pageCount: number };
  fields: TextField[];
  outputFormat: OutputFormat;
  filenamePattern: string;
  customFontName: string | null;
}

export interface PreflightFinding {
  severity: "warning" | "error";
  code:
    "missing-value" | "text-overflow" | "invalid-page" | "png-extra-page" | "custom-font-missing";
  rowNumber: number;
  fieldId: string;
}

export interface PreflightReport {
  schemaVersion: 1;
  recordCount: number;
  findings: PreflightFinding[];
  counts: Record<PreflightFinding["code"], number>;
}

export interface OutputName {
  rowIndex: number;
  baseName: string;
  fileName: string;
}
