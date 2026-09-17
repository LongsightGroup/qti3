import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

function container(kind: string, values: string[]): string {
  return `<qti-${kind}>${values.map((value) => `<qti-base-value base-type="identifier">${value}</qti-base-value>`).join("")}</qti-${kind}>`;
}

describe("container containment", () => {
  it.each(["multiple", "ordered", "variable", "delete", "repeat"])(
    "respects cardinality and sequence through %s",
    (kind) => {
      const ordered = kind !== "multiple";
      const literal = container(ordered ? "ordered" : "multiple", ["A", "B", "B", "C"]);
      const collection =
        kind === "variable"
          ? '<qti-variable identifier="VALUES"/>'
          : kind === "delete"
            ? `<qti-delete><qti-base-value base-type="identifier">Z</qti-base-value>${literal}</qti-delete>`
            : kind === "repeat"
              ? `<qti-repeat number-repeats="1">${literal}</qti-repeat>`
              : literal;
      for (const [values, expected] of [
        [["C", "A"], !ordered],
        [["A", "C"], !ordered],
        [["B", "B"], true],
        [["B", "C"], true],
        [["B", "B", "B"], false],
        [["A", "B", "B", "C"], true],
        [[], null],
      ] satisfies Array<[string[], boolean | null]>) {
        const parsed =
          parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="contains" title="Contains" time-dependent="false">
          <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="boolean"/>
          <qti-template-declaration identifier="VALUES" cardinality="ordered" base-type="identifier"><qti-default-value><qti-value>A</qti-value><qti-value>B</qti-value><qti-value>B</qti-value><qti-value>C</qti-value></qti-default-value></qti-template-declaration>
          <qti-item-body><p>Container containment.</p></qti-item-body>
          <qti-response-processing><qti-set-outcome-value identifier="RESULT"><qti-contains>${collection}${container(ordered ? "ordered" : "multiple", values)}</qti-contains></qti-set-outcome-value></qti-response-processing>
        </qti-assessment-item>`);
        expect(parsed.ok).toBe(true);
        if (!parsed.document) throw new Error("Expected parsed item");
        expect(createItemSession(parsed.document).score().outcomes.RESULT).toBe(expected);
      }
    },
  );
});
