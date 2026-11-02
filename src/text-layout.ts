/** Wrap using the target renderer's metrics, retaining explicit paragraph breaks. */
export function wrapText(
  text: string,
  width: number,
  measure: (value: string) => number,
): string[] {
  return text.split(/\r\n|\r|\n/).flatMap((paragraph) => {
    const lines: string[] = [];
    let current = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > width) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    lines.push(current);
    return lines;
  });
}
