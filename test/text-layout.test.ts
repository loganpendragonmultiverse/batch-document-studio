import { describe, expect, it } from "vitest";
import { wrapText } from "../src/text-layout";

describe("text layout", () => {
  it("retains explicit LF, CRLF, CR and empty lines", () => {
    expect(wrapText("First\r\nSecond\n\nThird\rFourth\n", 100, (text) => text.length)).toEqual([
      "First",
      "Second",
      "",
      "Third",
      "Fourth",
      "",
    ]);
  });
  it("wraps paragraphs using renderer metrics without dropping Unicode or long words", () => {
    expect(wrapText("Élodie Chen\nLongWord", 7, (text) => text.length)).toEqual([
      "Élodie",
      "Chen",
      "LongWord",
    ]);
    expect(wrapText("", 10, (text) => text.length)).toEqual([""]);
  });
});
