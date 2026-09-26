import { expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "./index.js";

// QTI 3 §2.7.2: numeric attribute references bind single numeric template/outcome variables.
const integer = '<qti-base-value base-type="integer">1</qti-base-value>';
const operators = [
  [
    '<qti-index n="{N}"><qti-ordered>' + integer + "</qti-ordered></qti-index>",
    "integer",
    "single",
    1,
  ],
  ['<qti-repeat number-repeats="{N}">' + integer + "</qti-repeat>", "integer", "ordered", [1]],
  [
    '<qti-any-n min="{N}" max="{N}"><qti-base-value base-type="boolean">true</qti-base-value></qti-any-n>',
    "boolean",
    "single",
    true,
  ],
  [
    '<qti-equal-rounded figures="{N}" rounding-mode="significantFigures">' +
      integer +
      integer +
      "</qti-equal-rounded>",
    "boolean",
    "single",
    true,
  ],
  [
    '<qti-equal tolerance-mode="absolute" tolerance="{N}">' + integer + integer + "</qti-equal>",
    "boolean",
    "single",
    true,
  ],
] as const;

function item(expression: string, baseType: string, cardinality: string, declaration: string) {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="attributes" title="Attributes" time-dependent="false">
    ${declaration.startsWith("<qti-response-") ? declaration : ""}<qti-outcome-declaration identifier="RESULT" base-type="${baseType}" cardinality="${cardinality}"/>${declaration.startsWith("<qti-response-") ? "" : declaration}
    <qti-item-body><p>Evaluate.</p></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="RESULT">${expression}</qti-set-outcome-value></qti-response-processing></qti-assessment-item>`;
}
for (const [expression, baseType, cardinality, expected] of operators) {
  it.each(["template", "outcome"])(`${expression} resolves a %s declaration`, (kind) => {
    const declaration = `<qti-${kind}-declaration identifier="N" base-type="integer" cardinality="single"><qti-default-value><qti-value>1</qti-value></qti-default-value></qti-${kind}-declaration>`;
    const parsed = parseQtiXml(item(expression, baseType, cardinality, declaration));
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Expected item");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    const scored = createItemSession(parsed.document).score();
    expect(scored.diagnostics).toEqual([]);
    expect(scored.outcomes.RESULT).toEqual(expected);
  });
  it.each([
    "",
    '<qti-template-declaration identifier="N" base-type="string" cardinality="single"/>',
    '<qti-template-declaration identifier="N" base-type="integer" cardinality="multiple"/>',
    '<qti-response-declaration identifier="N" base-type="integer" cardinality="single"/>',
  ])(`${expression} rejects ineligible declarations: %s`, (declaration) => {
    const parsed = parseQtiXml(item(expression, baseType, cardinality, declaration));
    expect(parsed.ok).toBe(false);
    expect(
      parsed.diagnostics.some(
        (entry) => entry.severity === "error" && entry.code.startsWith("processing."),
      ),
    ).toBe(true);
  });
}
