import type { QtiChoice } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  assignedLimitedSourceIds,
  clearSingleUseSourceAssignments,
  isSingleUseGapSource,
  sourceUseLimitExceeded,
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

  it("derives assigned source ids whose match-max limit is reached", () => {
    const sources = [gapSource("A", "1"), gapSource("B", "2"), gapSource("C", "1")];
    const assignments = new Map([
      ["G1", sources[0]!],
      ["G2", sources[1]!],
      ["G3", sources[1]!],
    ]);

    expect(assignedLimitedSourceIds(sources, assignments)).toEqual(new Set(["A", "B"]));
  });

  it("detects source usage beyond match-max", () => {
    const source = gapSource("A", "2");
    const assignments = new Map([
      ["G1", source],
      ["G2", source],
      ["G3", source],
    ]);

    expect(sourceUseLimitExceeded(assignments, source)).toBe(true);
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
