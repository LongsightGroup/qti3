import type { QtiChoice } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  applyGapMatchAssignments,
  gapMatchResponseValue,
  tryGapMatchAssignment,
} from "./gap-match-assignment.js";

function gapSource(id: string, matchMax?: string): QtiChoice {
  return {
    identifier: id,
    text: id,
    role: "gapChoice",
    qtiName: "qti-gap-text",
    attributes: matchMax === undefined ? {} : { "match-max": matchMax },
  };
}

describe("gap-match-assignment", () => {
  it("accepts assignments within the configured maximum", () => {
    const current = new Map([["G1", gapSource("A", "1")]]);
    const result = tryGapMatchAssignment(current, "G2", gapSource("B", "1"), {
      maximumAssignments: 2,
    });

    expect(result.accepted).toBe(true);
    expect([...result.next.entries()]).toEqual([
      ["G1", gapSource("A", "1")],
      ["G2", gapSource("B", "1")],
    ]);
  });

  it("rejects assignments that exceed the configured maximum", () => {
    const current = new Map([
      ["G1", gapSource("A", "1")],
      ["G2", gapSource("B", "1")],
    ]);
    const result = tryGapMatchAssignment(current, "G3", gapSource("C", "1"), {
      maximumAssignments: 2,
    });

    expect(result.accepted).toBe(false);
    expect(result.next).toBe(current);
  });

  it("moves single-use sources between gaps when an origin gap is provided", () => {
    const source = gapSource("A", "1");
    const current = new Map([["G1", source]]);
    const result = tryGapMatchAssignment(current, "G2", source, {
      originGapIdentifier: "G1",
      maximumAssignments: 2,
    });

    expect(result.accepted).toBe(true);
    expect([...result.next.keys()]).toEqual(["G2"]);
  });

  it("serializes assignments into directed pair values", () => {
    const assignments = new Map([
      ["G1", gapSource("A")],
      ["G2", gapSource("B")],
    ]);
    expect(gapMatchResponseValue(assignments)).toEqual(["A G1", "B G2"]);
  });

  it("replaces assignment maps in place", () => {
    const target = new Map([["G1", gapSource("A")]]);
    const next = new Map([
      ["G2", gapSource("B")],
      ["G3", gapSource("C")],
    ]);
    applyGapMatchAssignments(target, next);
    expect([...target.entries()]).toEqual([
      ["G2", gapSource("B")],
      ["G3", gapSource("C")],
    ]);
  });
});
