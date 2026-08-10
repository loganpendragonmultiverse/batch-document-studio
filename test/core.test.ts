import { describe, expect, it } from "vitest";

import {
  clamp,
  createRecipe,
  hexToRgb,
  interpolate,
  normalizeHeaders,
  planOutputNames,
  preflightBatch,
  safeBaseName,
  validateFields,
  validateRecipe,
} from "../src/core";
import type { TextField } from "../src/types";

const validField: TextField = {
  id: "name",
  column: "first_name",
  x: 0.2,
  y: 0.4,
  width: 0.6,
  height: 0.15,
  fontSize: 32,
  color: "#112233",
  alignment: "center",
  pageIndex: 0,
  fit: "shrink",
  minFontSize: 10,
  lineHeight: 1.2,
  fontFamily: "helvetica",
};

describe("normalizeHeaders", () => {
  it("fills blank headers and makes duplicate names stable", () => {
    expect(normalizeHeaders(["Name", "", "name", null])).toEqual([
      "Name",
      "column_2",
      "name_2",
      "column_4",
    ]);
  });
});

describe("interpolate", () => {
  it("replaces known fields and removes unknown values", () => {
    expect(interpolate("{first} {last} {missing}", { first: "Ada", last: "Lovelace" })).toBe(
      "Ada Lovelace ",
    );
  });
});

describe("safeBaseName", () => {
  it("removes unsafe path characters and trailing dots", () => {
    expect(safeBaseName("A/B: C*D. ", "fallback")).toBe("A-B- C-D");
  });

  it("uses a fallback and guards reserved Windows names", () => {
    expect(safeBaseName("   ", "document-1")).toBe("document-1");
    expect(safeBaseName("CON", "fallback")).toBe("document-CON");
  });

  it("limits long generated filenames", () => {
    expect(safeBaseName("x".repeat(200), "fallback")).toHaveLength(120);
  });
});

describe("planOutputNames", () => {
  it("resolves case-insensitive collisions deterministically", () => {
    const names = planOutputNames(
      [{ name: "Taylor" }, { name: "taylor" }, { name: "" }],
      "{name}",
      "pdf",
    );
    expect(names.map((entry) => entry.fileName)).toEqual([
      "Taylor.pdf",
      "taylor-2.pdf",
      "document-3.pdf",
    ]);
  });
});

describe("field validation", () => {
  it("accepts a mapped in-bounds field", () => {
    expect(validateFields([validField], ["first_name"])).toEqual([]);
  });

  it("reports an empty field list", () => {
    expect(validateFields([], ["first_name"])).toContain("Add at least one field to the template.");
  });

  it("reports missing columns, positions, and font sizes", () => {
    const errors = validateFields(
      [{ ...validField, column: "unknown", x: -1, y: 2, fontSize: 5 }],
      ["first_name"],
    );
    expect(errors).toHaveLength(4);
  });
});

describe("numeric and color helpers", () => {
  it("clamps values", () => {
    expect(clamp(-2)).toBe(0);
    expect(clamp(0.4)).toBe(0.4);
    expect(clamp(5)).toBe(1);
  });

  it("converts six-digit hex colors and falls back to black", () => {
    expect(hexToRgb("#ff8000")).toEqual({ red: 1, green: 128 / 255, blue: 0 });
    expect(hexToRgb("invalid")).toEqual({ red: 0, green: 0, blue: 0 });
  });
});

describe("project recipes and preflight", () => {
  const template = {
    bytes: new Uint8Array(),
    name: "award.pdf",
    mimeType: "application/pdf" as const,
    width: 600,
    height: 400,
    preview: {} as HTMLCanvasElement,
    previews: [{} as HTMLCanvasElement, {} as HTMLCanvasElement],
    pageSizes: [
      { width: 600, height: 400 },
      { width: 600, height: 400 },
    ],
  };

  it("exports recipe settings without recipient data", () => {
    const recipe = createRecipe({
      template,
      fields: [validField],
      outputFormat: "pdf",
      filenamePattern: "{first_name}",
      customFontName: null,
      createdAt: "2026-08-10T00:00:00Z",
    });
    expect(validateRecipe(recipe)).toEqual(recipe);
    expect(JSON.stringify(recipe)).not.toContain("recipient");
  });

  it("reports missing values, overflow, pages, and fonts without copying values", () => {
    const fields: TextField[] = [
      { ...validField, id: "overflow", fit: "clip", width: 0.02 },
      { ...validField, id: "page", pageIndex: 3 },
      { ...validField, id: "font", fontFamily: "custom" },
    ];
    const report = preflightBatch({
      dataset: {
        sourceName: "people.csv",
        headers: ["first_name"],
        rows: [{ first_name: "A very long private recipient value" }, { first_name: "" }],
      },
      fields,
      template,
      format: "png",
      hasCustomFont: false,
    });
    expect(report.counts["text-overflow"]).toBeGreaterThan(0);
    expect(report.counts["invalid-page"]).toBeGreaterThan(0);
    expect(report.counts["custom-font-missing"]).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain("private recipient");
  });
});
