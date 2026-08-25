import { describe, expect, it } from "vitest";
import { scoreAreaMapping } from "./processing-mapping.js";
import type { QtiAreaMapping } from "./types.js";

const areaMapping: QtiAreaMapping = {
  defaultValue: -1,
  entries: [
    {
      shape: "rect",
      coords: [0, 0, 20, 20],
      mappedValue: 2,
      attributes: {},
    },
    {
      shape: "rect",
      coords: [10, 10, 30, 30],
      mappedValue: 3,
      attributes: {},
    },
  ],
  attributes: {},
};

describe("scoreAreaMapping", () => {
  it("adds every area that contains one point", () => {
    expect(scoreAreaMapping("15 15", areaMapping)).toBe(5);
  });

  it("maps one area at most once across response points", () => {
    expect(scoreAreaMapping(["5 5", "6 6"], areaMapping)).toBe(2);
  });

  it("maps different areas across different response points", () => {
    expect(scoreAreaMapping(["5 5", "25 25"], areaMapping)).toBe(5);
  });

  it("applies the default once to an unmatched point", () => {
    expect(scoreAreaMapping("40 40", areaMapping)).toBe(-1);
  });

  it("combines unique area matches with defaults for unmatched points", () => {
    expect(scoreAreaMapping(["5 5", "6 6", "25 25", "40 40"], areaMapping)).toBe(4);
  });
});
