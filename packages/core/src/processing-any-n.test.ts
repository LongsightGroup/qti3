import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./index.js";

describe("qti-any-n parsing and validation", () => {
  it.each([
    ["min", `max="2"`, "processing.anyN.min.required"],
    ["max", `min="1"`, "processing.anyN.max.required"],
  ])("diagnoses a missing %s attribute", (_attribute, attributes, code) => {
    const result = parseQtiXml(anyNItemXml(attributes));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        severity: "error",
        path: expect.stringContaining("/qti-any-n[1]"),
      }),
    );
  });

  it.each([
    [`min="1.5" max="2"`, "processing.anyN.min.integer"],
    [`min="1" max="2.5"`, "processing.anyN.max.integer"],
  ])("diagnoses non-integer literal bounds", (attributes, code) => {
    const result = parseQtiXml(anyNItemXml(attributes));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: "error" }));
  });

  it("accepts integer literal bounds", () => {
    const result = parseQtiXml(anyNItemXml(`min="1" max="2"`));

    expect(result.ok).toBe(true);
    expect(anyNExpression(result)).toMatchObject({ type: "anyN", min: "1", max: "2" });
  });

  it("accepts declared variable-reference bounds", () => {
    const result = parseQtiXml(
      anyNItemXml(
        `min="MINIMUM" max="MAXIMUM"`,
        `<qti-outcome-declaration identifier="MINIMUM" cardinality="single" base-type="integer"/>
         <qti-template-declaration identifier="MAXIMUM" cardinality="single" base-type="integer"/>`,
      ),
    );

    expect(result.ok).toBe(true);
    expect(anyNExpression(result)).toMatchObject({
      type: "anyN",
      min: "MINIMUM",
      max: "MAXIMUM",
    });
  });

  it("diagnoses undeclared variable-reference bounds", () => {
    const result = parseQtiXml(anyNItemXml(`min="MISSING_MIN" max="MISSING_MAX"`));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.anyN.min.reference" }),
        expect.objectContaining({ code: "processing.anyN.max.reference" }),
      ]),
    );
  });

  it("rejects response variables that the evaluator cannot use as bounds", () => {
    const result = parseQtiXml(
      anyNItemXml(
        `min="RESPONSE_BOUND" max="2"`,
        '<qti-response-declaration identifier="RESPONSE_BOUND" cardinality="single" base-type="integer"/>',
      ),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.anyN.min.reference" }),
    );
  });
});

function anyNExpression(result: ReturnType<typeof parseQtiXml>) {
  const rule = result.document?.item.responseProcessing?.rules[0];
  return rule?.type === "setOutcomeValue" ? rule.expression : undefined;
}

function anyNItemXml(attributes: string, boundDeclarations = ""): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="any-n" title="Any N" time-dependent="false">
      <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="boolean"/>
      ${boundDeclarations}
      <qti-item-body><p>Any N validation.</p></qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="RESULT">
          <qti-any-n ${attributes}>
            <qti-base-value base-type="boolean">true</qti-base-value>
            <qti-base-value base-type="boolean">false</qti-base-value>
          </qti-any-n>
        </qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
