import { planOutputNames } from "./core";
import { generateArchive } from "./render";
export async function generateQueue(
  options: Parameters<typeof generateArchive>[0] & {
    batchSize: number;
    onArchive: (blob: Blob, part: number) => Promise<void>;
  },
): Promise<number> {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 50)
    throw new Error("Choose 1–50 records per ZIP.");
  const names = planOutputNames(options.dataset.rows, options.filenamePattern, options.format);
  let completed = 0;
  for (let start = 0; start < options.dataset.rows.length; start += options.batchSize) {
    options.signal?.throwIfAborted();
    const rows = options.dataset.rows.slice(start, start + options.batchSize);
    const dataset = {
      ...options.dataset,
      rows,
      rowNumbers: rows.map((_, i) => options.dataset.rowNumbers?.[start + i] ?? start + i + 2),
    };
    const archive = await generateArchive({
      ...options,
      dataset,
      plannedNames: names
        .slice(start, start + options.batchSize)
        .map((name, i) => ({ ...name, rowIndex: i })),
      onProgress: (n) => options.onProgress?.(start + n, options.dataset.rows.length),
    });
    options.signal?.throwIfAborted();
    await options.onArchive(archive, ++completed);
  }
  return completed;
}
