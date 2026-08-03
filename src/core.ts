import type { OutputName, TextField } from "./types";

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

export function normalizeHeaders(values: unknown[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value, index) => {
    const raw = String(value ?? "").trim();
    const base = raw || `column_${index + 1}`;
    const current = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), current + 1);
    return current === 0 ? base : `${base}_${current + 1}`;
  });
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
  const collisions = new Map<string, number>();
  return rows.map((row, index) => {
    const baseName = safeBaseName(interpolate(pattern, row), `document-${index + 1}`);
    const key = baseName.toLowerCase();
    const occurrence = (collisions.get(key) ?? 0) + 1;
    collisions.set(key, occurrence);
    const resolved = occurrence === 1 ? baseName : `${baseName}-${occurrence}`;
    return { rowIndex: index, baseName, fileName: `${resolved}.${extension}` };
  });
}

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function validateFields(fields: TextField[], headers: string[]): string[] {
  const errors: string[] = [];
  if (fields.length === 0) errors.push("Add at least one field to the template.");
  for (const field of fields) {
    if (!headers.includes(field.column)) errors.push(`Field ${field.id} has no valid column.`);
    if (field.x < 0 || field.x > 1 || field.y < 0 || field.y > 1) {
      errors.push(`Field ${field.id} is outside the template.`);
    }
    if (field.fontSize < 6 || field.fontSize > 240) {
      errors.push(`Field ${field.id} has an unsupported font size.`);
    }
  }
  return errors;
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
