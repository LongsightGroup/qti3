import { describe, expect, it } from "vitest";
import { createItemSession, MAX_QTI_REPEAT_RESULT_ELEMENTS, parseQtiXml } from "./index.js";

describe("qti-repeat processing limit", () => {
  it.each(["-1", "1.5"])("diagnoses invalid literal count %s", (numberRepeats) => {
    const result = parseQtiXml(repeatItem(numberRepeats, 1));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.repeat.numberRepeats" }),
    );
  });

  it("allows a literal count whose child expansion reaches the exact cap", () => {
    const result = parseQtiXml(repeatItem(String(MAX_QTI_REPEAT_RESULT_ELEMENTS / 2), 2));

    expect(result.ok).toBe(true);
    expect(repeatedOutcome(result.document)).toHaveLength(MAX_QTI_REPEAT_RESULT_ELEMENTS);
  });

  it("diagnoses and returns null for a literal child expansion above the cap", () => {
    const result = parseQtiXml(repeatItem(String(MAX_QTI_REPEAT_RESULT_ELEMENTS / 2 + 1), 2));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.repeat.limit" }),
    );
    expect(repeatedOutcome(result.document)).toBeNull();
  });

  it("allows a variable count whose child expansion reaches the exact cap", () => {
    const result = parseQtiXml(repeatItem("COUNT", 2, MAX_QTI_REPEAT_RESULT_ELEMENTS / 2));

    expect(result.ok).toBe(true);
    expect(repeatedOutcome(result.document)).toHaveLength(MAX_QTI_REPEAT_RESULT_ELEMENTS);
  });

  it("rejects a variable count above the cap without prolonged expansion", () => {
    const result = parseQtiXml(repeatItem("COUNT", 1, MAX_QTI_REPEAT_RESULT_ELEMENTS + 1));
    expect(result.ok).toBe(true);

    const startedAt = performance.now();
    expect(repeatedOutcome(result.document)).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  it("rejects variable count times child expansion above the cap", () => {
    const result = parseQtiXml(repeatItem("COUNT", 2, MAX_QTI_REPEAT_RESULT_ELEMENTS / 2 + 1));
    expect(result.ok).toBe(true);

    expect(repeatedOutcome(result.document)).toBeNull();
  });
});

function repeatedOutcome(
  document: ReturnType<typeof parseQtiXml>["document"],
): unknown[] | null | undefined {
  if (!document) throw new Error("Expected parsed repeat document.");
  const outcome = createItemSession(document).score().outcomes.REPEATED;
  return Array.isArray(outcome) ? outcome : outcome === null ? null : undefined;
}

function repeatItem(numberRepeats: string, childCount: number, variableCount?: number): string {
  const countDeclaration =
    variableCount === undefined
      ? ""
      : `<qti-outcome-declaration identifier="COUNT" cardinality="single" base-type="integer"><qti-default-value><qti-value>${variableCount}</qti-value></qti-default-value></qti-outcome-declaration>`;
  const children = Array.from(
    { length: childCount },
    (_, index) => `<qti-base-value base-type="integer">${index + 1}</qti-base-value>`,
  ).join("");
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="repeat-limit" title="repeat-limit" time-dependent="false">
      ${countDeclaration}
      <qti-outcome-declaration identifier="REPEATED" cardinality="ordered" base-type="integer"/>
      <qti-item-body><p>Repeat limit test.</p></qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="REPEATED">
          <qti-repeat number-repeats="${numberRepeats}">${children}</qti-repeat>
        </qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
