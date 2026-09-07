import { expect, it } from "vitest";
import { alignmentGuides, placeField, selectedDataset } from "../src/layout";
import type { TextField } from "../src/types";
it("clamps nudges and computes page-specific edge/center guides", () => {
  const field = { id: "one", x: 0.2, y: 0.2, width: 0.6, height: 0.1, pageIndex: 0 } as TextField;
  expect(placeField(field, 2, -1)).toMatchObject({ x: 0.4, y: 0 });
  expect(field.x).toBe(0.2);
  expect(() => placeField(field, NaN, 0)).toThrow("finite");
  expect(alignmentGuides(field, []).x).toContain(0.5);
  expect(alignmentGuides(field, [{ ...field, id: "two", x: 0.2, pageIndex: 1 }]).x).not.toContain(
    0.2,
  );
  expect(alignmentGuides(field, [{ ...field, id: "two", x: 0.2 }]).x).toContain(0.2);
});
it("selects unique record ranges while preserving original worksheet row numbers", () => {
  const data = { rows: [{ name: "a" }, { name: "b" }, { name: "c" }], rowNumbers: [2, 4, 8] };
  expect(selectedDataset(data, "3,1-2,2").rowNumbers).toEqual([2, 4, 8]);
  expect(selectedDataset(data, "2").rows).toEqual([{ name: "b" }]);
  expect(selectedDataset(data, "all")).toEqual(data);
  for (const bad of ["", "0", "4", "3-1", "1,x"])
    expect(() => selectedDataset(data, bad)).toThrow();
  expect(selectedDataset({ rows: data.rows }, "2").rowNumbers).toEqual([3]);
});
