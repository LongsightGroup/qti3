import type { QtiChoice } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  assignedSingleUseSourceIds,
  clearSingleUseSourceAssignments,
  isSingleUseGapSource,
} from "./gap-match-source-bank.js";

function gapSource(id: string, matchMax?: string): QtiChoice {
  return {
    identifier: id,
    text: id,
    role: "gapChoice",
    qtiName: "qti-gap-text",
    attributes: matchMax === undefined ? {} : { "match-max": matchMax },
  };
}

describe("gap-match-source-bank", () => {
  it("detects single-use gap sources", () => {
    expect(isSingleUseGapSource(gapSource("A", "1"))).toBe(true);
    expect(isSingleUseGapSource(gapSource("B", "2"))).toBe(false);
    expect(isSingleUseGapSource(gapSource("C"))).toBe(false);
  });

  it("derives assigned single-use source ids", () => {
    const sources = [gapSource("A", "1"), gapSource("B", "2"), gapSource("C", "1")];
    const assignments = new Map([
      ["G1", sources[0]!],
      ["G2", sources[1]!],
    ]);

    expect(assignedSingleUseSourceIds(sources, assignments)).toEqual(new Set(["A"]));
  });

  it("clears other assignments for a single-use source", () => {
    const source = gapSource("A", "1");
    const assignments = new Map([
      ["G1", source],
      ["G2", source],
    ]);

    clearSingleUseSourceAssignments(assignments, source, "G2");

    expect([...assignments.keys()]).toEqual(["G2"]);
  });
});
