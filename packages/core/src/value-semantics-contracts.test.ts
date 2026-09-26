import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "./index.js";

// QTI 3 §8.21 inverse function ranges, §2.7.2 braced variable references,
// and BaseTypeEnum point values. Expected results are independent of serialization.
function evaluate(expression: string, baseType = "float", cardinality = "single") {
  const parsed =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="values" title="Values" time-dependent="false">
    <qti-outcome-declaration identifier="RESULT" cardinality="${cardinality}" base-type="${baseType}"/>
    <qti-template-declaration identifier="N" cardinality="single" base-type="integer"><qti-default-value><qti-value>2</qti-value></qti-default-value></qti-template-declaration>
    <qti-item-body><p>Evaluate.</p></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="RESULT">${expression}</qti-set-outcome-value></qti-response-processing></qti-assessment-item>`);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected valid document");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const result = createItemSession(parsed.document).score();
  expect(result.diagnostics).toEqual([]);
  return result.outcomes.RESULT;
}
const integer = (value: number) => `<qti-base-value base-type="integer">${value}</qti-base-value>`;
const point = (value: string) => `<qti-base-value base-type="point">${value}</qti-base-value>`;

describe("QTI value semantics", () => {
  it.each([
    ["acot", -1, -Math.PI / 4],
    ["acot", 1, Math.PI / 4],
    ["acot", 0, Math.PI / 2],
    ["acsc", 1, Math.PI / 2],
    ["acsc", -1, -Math.PI / 2],
    ["acsc", 0, null],
    ["asec", 1, 0],
    ["asec", -1, Math.PI],
    ["asec", 0.5, null],
  ] as const)("evaluates %s(%s)", (name, value, expected) => {
    const result = evaluate(
      `<qti-math-operator name="${name}"><qti-base-value base-type="float">${value}</qti-base-value></qti-math-operator>`,
    );
    if (expected === null) expect(result).toBeNull();
    else expect(result).toBeCloseTo(expected, 12);
  });
  it.each(["2", "{N}"])("resolves index and repeat counts %s", (count) => {
    expect(
      evaluate(
        `<qti-index n="${count}"><qti-ordered>${integer(10)}${integer(20)}</qti-ordered></qti-index>`,
        "integer",
      ),
    ).toBe(20);
    expect(
      evaluate(
        `<qti-repeat number-repeats="${count}">${integer(10)}</qti-repeat>`,
        "integer",
        "ordered",
      ),
    ).toEqual([10, 10]);
  });
  it("resolves braced any-N, rounding, and tolerance attributes", () => {
    expect(
      evaluate(
        '<qti-any-n min="{N}" max="{N}"><qti-base-value base-type="boolean">true</qti-base-value><qti-base-value base-type="boolean">true</qti-base-value></qti-any-n>',
        "boolean",
      ),
    ).toBe(true);
    expect(
      evaluate(
        `<qti-equal-rounded figures="{N}" rounding-mode="significantFigures">${integer(123)}${integer(124)}</qti-equal-rounded>`,
        "boolean",
      ),
    ).toBe(true);
    expect(
      evaluate(
        `<qti-equal tolerance-mode="absolute" tolerance="{N}">${integer(10)}${integer(12)}</qti-equal>`,
        "boolean",
      ),
    ).toBe(true);
  });
  it.each(["01 02", "+1 +02", "1  2", " 1\t2 "])(
    "compares equivalent point %j in scalar and collection expressions",
    (value) => {
      expect(evaluate(`<qti-match>${point(value)}${point("1 2")}</qti-match>`, "boolean")).toBe(
        true,
      );
      expect(
        evaluate(
          `<qti-match><qti-multiple>${point(value)}${point("3 4")}</qti-multiple><qti-multiple>${point("3 4")}${point("1 2")}</qti-multiple></qti-match>`,
          "boolean",
        ),
      ).toBe(true);
      expect(evaluate(`<qti-match>${point(value)}${point("2 1")}</qti-match>`, "boolean")).toBe(
        false,
      );
    },
  );
});

it.each([
  ["N", "integer", "single"],
  ["{MISSING}", "integer", "single"],
  ["{N}", "string", "single"],
  ["{N}", "integer", "multiple"],
  ["{N}", "float", "single"],
])(
  "diagnoses invalid index attribute %s with %s/%s declaration",
  (reference, baseType, cardinality) => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid-reference" title="Invalid reference" time-dependent="false">
    <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="integer"/>
    <qti-template-declaration identifier="N" cardinality="${cardinality}" base-type="${baseType}"/>
    <qti-item-body><p>Evaluate.</p></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="RESULT"><qti-index n="${reference}"><qti-ordered>${integer(10)}${integer(20)}</qti-ordered></qti-index></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`);
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.index.n", severity: "error" }),
    );
  },
);
it("scores a candidate's equivalent point coordinates correctly", () => {
  const parsed =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="point" title="Point" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point"><qti-correct-response><qti-value>01 02</qti-value></qti-correct-response></qti-response-declaration>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    <qti-item-body><qti-select-point-interaction response-identifier="RESPONSE" max-choices="1"><img src="image.png" width="100" height="100" alt="Select a point"/></qti-select-point-interaction></qti-item-body>
    <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml"/></qti-assessment-item>`);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected valid item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const session = createItemSession(parsed.document);
  for (const value of ["1 2", "+01 +02", "1  2"]) {
    session.respond("RESPONSE", value);
    expect(session.score().outcomes.SCORE).toBe(1);
  }
  session.respond("RESPONSE", "2 1");
  expect(session.score().outcomes.SCORE).toBe(0);
});
