import { wrapText } from "./text-layout";
import type {
  Dataset,
  OutputFormat,
  OutputName,
  PreflightFinding,
  PreflightReport,
  ProjectRecipe,
  TemplateDocument,
  TextField,
} from "./types";

const RESERVED_WINDOWS_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

// Reserve authored names before allocating suffixes so later columns keep their identity.
function uniqueNames(bases: string[], separator: string): string[] {
  const reserved = new Set(bases.map((base) => base.toLowerCase()));
  const used = new Set<string>();
  const next = new Map<string, number>();
  return bases.map((base) => {
    const key = base.toLowerCase();
    let candidate = base;
    if (used.has(key)) {
      let suffix = next.get(key) ?? 2;
      do {
        candidate = `${base}${separator}${suffix++}`;
      } while (reserved.has(candidate.toLowerCase()) || used.has(candidate.toLowerCase()));
      next.set(key, suffix);
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function normalizeHeaders(values: unknown[]): string[] {
  return uniqueNames(
    values.map((value, index) => String(value ?? "").trim() || `column_${index + 1}`),
    "_",
  );
}

export function interpolate(pattern: string, row: Record<string, string>): string {
  return pattern.replace(/\{([^{}]+)\}/g, (_match, key: string) => row[key] ?? "");
}

export function safeBaseName(value: string, fallback: string): string {
  const withoutControls = Array.from(value.normalize("NFKC"))
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("");
  const cleaned = withoutControls
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
  const selected = cleaned || fallback;
  return RESERVED_WINDOWS_NAMES.has(selected.toUpperCase()) ? `document-${selected}` : selected;
}

export function planOutputNames(
  rows: Record<string, string>[],
  pattern: string,
  extension: "pdf" | "png",
): OutputName[] {
  const bases = rows.map((row, index) =>
    safeBaseName(interpolate(pattern, row), `document-${index + 1}`),
  );
  const resolved = uniqueNames(bases, "-");
  return resolved.map((name, rowIndex) => ({
    rowIndex,
    baseName: bases[rowIndex]!,
    fileName: `${name}.${extension}`,
  }));
}

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function validateFields(fields: TextField[], headers: string[]): string[] {
  const errors: string[] = [];
  if (fields.length === 0) errors.push("Add at least one field to the template.");
  for (const field of fields) {
    if (!headers.includes(field.column)) errors.push(`Field ${field.id} has no valid column.`);
    if (field.x < 0 || field.x + field.width > 1 || field.y < 0 || field.y + field.height > 1) {
      errors.push(`Field ${field.id} is outside the template.`);
    }
    if (field.fontSize < 6 || field.fontSize > 240) {
      errors.push(`Field ${field.id} has an unsupported font size.`);
    }
    if (!Number.isInteger(field.pageIndex) || field.pageIndex < 0) {
      errors.push(`Field ${field.id} has an invalid page.`);
    }
    if (field.minFontSize < 4 || field.minFontSize > field.fontSize) {
      errors.push(`Field ${field.id} has an invalid minimum font size.`);
    }
    if (field.lineHeight < 0.8 || field.lineHeight > 3) {
      errors.push(`Field ${field.id} has an unsupported line height.`);
    }
  }
  return errors;
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce(
    (width, character) =>
      width +
      (/[MW@#%]/.test(character) ? 0.82 : /[ilI .,]/.test(character) ? 0.3 : 0.55) * fontSize,
    0,
  );
}

export function preflightBatch(options: {
  dataset: Dataset;
  fields: TextField[];
  template: TemplateDocument;
  format: OutputFormat;
  hasCustomFont: boolean;
}): PreflightReport {
  const findings: PreflightFinding[] = [];
  for (const [rowIndex, row] of options.dataset.rows.entries()) {
    for (const field of options.fields) {
      const value = row[field.column] ?? "";
      const page = options.template.pageSizes[field.pageIndex];
      if (!page)
        findings.push({
          severity: "error",
          code: "invalid-page",
          rowNumber: options.dataset.rowNumbers?.[rowIndex] ?? rowIndex + 2,
          fieldId: field.id,
        });
      if (!value.trim())
        findings.push({
          severity: "warning",
          code: "missing-value",
          rowNumber: options.dataset.rowNumbers?.[rowIndex] ?? rowIndex + 2,
          fieldId: field.id,
        });
      const availableWidth = page ? field.width * page.width : 0;
      const availableHeight = page ? field.height * page.height : 0;
      const estimatedWidth = estimateTextWidth(
        value,
        field.fit === "shrink" ? field.minFontSize : field.fontSize,
      );
      const lines =
        field.fit === "wrap" && availableWidth
          ? wrapText(value, availableWidth, (text) => estimateTextWidth(text, field.fontSize))
              .length
          : 1;
      const overflowsWidth = field.fit !== "wrap" && estimatedWidth > availableWidth;
      const overflowsHeight =
        field.fit === "wrap" && lines * field.fontSize * field.lineHeight > availableHeight;
      if (page && (overflowsWidth || overflowsHeight)) {
        findings.push({
          severity: "warning",
          code: "text-overflow",
          rowNumber: options.dataset.rowNumbers?.[rowIndex] ?? rowIndex + 2,
          fieldId: field.id,
        });
      }
      if (options.format === "png" && field.pageIndex > 0)
        findings.push({
          severity: "warning",
          code: "png-extra-page",
          rowNumber: options.dataset.rowNumbers?.[rowIndex] ?? rowIndex + 2,
          fieldId: field.id,
        });
      if (field.fontFamily === "custom" && !options.hasCustomFont)
        findings.push({
          severity: "error",
          code: "custom-font-missing",
          rowNumber: options.dataset.rowNumbers?.[rowIndex] ?? rowIndex + 2,
          fieldId: field.id,
        });
    }
  }
  const counts: PreflightReport["counts"] = {
    "missing-value": 0,
    "text-overflow": 0,
    "invalid-page": 0,
    "png-extra-page": 0,
    "custom-font-missing": 0,
  };
  for (const finding of findings) counts[finding.code] += 1;
  return { schemaVersion: 1, recordCount: options.dataset.rows.length, findings, counts };
}

export function createRecipe(options: {
  template: TemplateDocument;
  fields: TextField[];
  outputFormat: OutputFormat;
  filenamePattern: string;
  customFontName: string | null;
  createdAt?: string;
}): ProjectRecipe {
  return {
    format: "batch-document-studio-recipe",
    version: 1,
    createdAt: options.createdAt ?? new Date().toISOString(),
    template: {
      name: options.template.name,
      mimeType: options.template.mimeType,
      pageCount: options.template.pageSizes.length,
    },
    fields: structuredClone(options.fields),
    outputFormat: options.outputFormat,
    filenamePattern: options.filenamePattern,
    customFontName: options.customFontName,
  };
}

export function validateRecipe(value: unknown): ProjectRecipe {
  if (!value || typeof value !== "object") throw new Error("Recipe must be a JSON object.");
  const recipe = value as ProjectRecipe;
  if (
    recipe.format !== "batch-document-studio-recipe" ||
    recipe.version !== 1 ||
    !Array.isArray(recipe.fields)
  ) {
    throw new Error("Unsupported Batch Document Studio recipe.");
  }
  return recipe;
}

export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) return { red: 0, green: 0, blue: 0 };
  const value = Number.parseInt(match[1], 16);
  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}
