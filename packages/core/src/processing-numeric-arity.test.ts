import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";
import { statsOperatorValue } from "./processing-operators.js";

describe("numeric processing arity", () => {
  it.each(["sum", "product", "min", "max"])(
    "diagnoses and defensively evaluates empty qti-%s",
    (operator) => {
      const result = parseQtiXml(processingItem(`<qti-${operator}/>`));

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "processing.numeric.arity" }),
      );
      expect(outcomeValue(result.document)).toBeNull();
    },
  );

  it.each(["sum", "product", "min", "max"])(
    "returns null for qti-%s with a NULL operand",
    (operator) => {
      const result = parseQtiXml(processingItem(`<qti-${operator}><qti-null/></qti-${operator}>`));

      expect(result.ok).toBe(true);
      expect(outcomeValue(result.document)).toBeNull();
    },
  );

  it.each([
    ["sum", 6],
    ["product", 8],
    ["min", 2],
    ["max", 4],
  ])("preserves non-empty qti-%s evaluation", (operator, expected) => {
    const children =
      '<qti-base-value base-type="integer">2</qti-base-value><qti-base-value base-type="integer">4</qti-base-value>';
    const result = parseQtiXml(processingItem(`<qti-${operator}>${children}</qti-${operator}>`));

    expect(result.ok).toBe(true);
    expect(outcomeValue(result.document)).toBe(expected);
  });

  it.each(["", "<qti-multiple/><qti-ordered/>"])(
    "diagnoses qti-stats-operator with invalid child count",
    (children) => {
      const result = parseQtiXml(
        processingItem(`<qti-stats-operator name="mean">${children}</qti-stats-operator>`),
      );

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "processing.statsOperator.arity" }),
      );
      expect(outcomeValue(result.document)).toBeNull();
    },
  );

  it("returns null when the stats operand is NULL", () => {
    const result = parseQtiXml(
      processingItem('<qti-stats-operator name="mean"><qti-null/></qti-stats-operator>'),
    );

    expect(result.ok).toBe(true);
    expect(outcomeValue(result.document)).toBeNull();
  });

  it("defines an empty stats container as null and preserves non-empty statistics", () => {
    expect(statsOperatorValue("mean", [])).toBeNull();
    expect(statsOperatorValue("mean", [2, 4, 6])).toBe(4);
    expect(statsOperatorValue("popVariance", [2, 4, 6])).toBeCloseTo(8 / 3);
  });
});

function outcomeValue(document: ReturnType<typeof parseQtiXml>["document"]): unknown {
  if (!document) throw new Error("Expected parsed processing document.");
  return createItemSession(document).score().outcomes.RESULT;
}

function processingItem(expression: string): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-arity" title="numeric-arity" time-dependent="false">
      <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="float"/>
      <qti-item-body><p>Numeric arity test.</p></qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="RESULT">${expression}</qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
