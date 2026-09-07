import { clamp } from "./core";
import type { TextField } from "./types";
export function placeField(field: TextField, x: number, y: number): TextField {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Position must be finite.");
  return { ...field, x: clamp(x, 0, 1 - field.width), y: clamp(y, 0, 1 - field.height) };
}
export function alignmentGuides(
  field: TextField,
  others: TextField[],
): { x: number[]; y: number[] } {
  const result = { x: [] as number[], y: [] as number[] };
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const anchors = [
      0,
      0.5,
      1,
      ...others
        .filter((f) => f.id !== field.id && f.pageIndex === field.pageIndex)
        .flatMap((f) => [f[axis], f[axis] + f[size] / 2, f[axis] + f[size]]),
    ];
    result[axis] = [
      ...new Set(
        anchors.filter((a) =>
          [field[axis], field[axis] + field[size] / 2, field[axis] + field[size]].some(
            (b) => Math.abs(a - b) < 0.006,
          ),
        ),
      ),
    ];
  }
  return result;
}
export function selectedDataset<
  T extends { rows: Record<string, string>[]; rowNumbers?: number[] },
>(dataset: T, selection: string): T & { rowNumbers: number[] } {
  if (!selection.trim()) throw new Error("Select record numbers, for example 1-3,5, or all.");
  const indices = new Set<number>();
  if (selection.trim().toLowerCase() === "all") dataset.rows.forEach((_, i) => indices.add(i));
  else
    for (const part of selection.split(",")) {
      const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);
      if (!match) throw new Error("Use record numbers such as 1-3,5.");
      const first = Number(match[1]),
        last = Number(match[2] ?? match[1]);
      if (first < 1 || last < first || last > dataset.rows.length)
        throw new Error("Record selection is outside this worksheet.");
      for (let n = first; n <= last; n++) indices.add(n - 1);
    }
  const order = [...indices].sort((a, b) => a - b);
  return {
    ...dataset,
    rows: order.map((i) => dataset.rows[i]!),
    rowNumbers: order.map((i) => dataset.rowNumbers?.[i] ?? i + 2),
  };
}
