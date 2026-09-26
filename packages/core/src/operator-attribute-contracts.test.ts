import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  serializeResponseProcessing,
} from "./index.js";

// QTI 3 §2.7.2: numeric attribute references bind single numeric template/outcome variables.
const integer = '<qti-base-value base-type="integer">1</qti-base-value>';
const operators = [
  [
    '<qti-round-to rounding-mode="decimalPlaces" figures="{N}"><qti-base-value base-type="float">1.234</qti-base-value></qti-round-to>',
    "float",
    "single",
    1.2,
  ],
  ['<qti-random-integer min="{N}" max="{N}" step="{N}"/>', "integer", "single", 1],
  ['<qti-random-float min="{N}" max="{N}"/>', "float", "single", 1],
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
    const processing = parsed.document.item.responseProcessing;
    if (!processing) throw new Error("Expected processing");
    const serialized = serializeResponseProcessing(processing);
    expect(serialized.diagnostics).toEqual([]);
    expect(serialized.xml).toContain("{N}");
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

// QTI 3 §§5.119.2, 7.33, 7.34: literal ranges and defaults apply only to omitted attributes.
it.each([
  ['<qti-random-integer max="0"/>', "integer", 0],
  ['<qti-random-float max="0"/>', "float", 0],
  [
    '<qti-round-to rounding-mode="decimalPlaces" figures="0"><qti-base-value base-type="float">1.7</qti-base-value></qti-round-to>',
    "float",
    2,
  ],
])("honors literal/default boundaries: %s", (expression, baseType, expected) => {
  const parsed = parseQtiXml(item(expression, baseType, "single", ""));
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  expect(createItemSession(parsed.document).score().outcomes.RESULT).toBe(expected);
});

it.each([
  '<qti-random-integer min="{N}" max="0"/>',
  '<qti-random-integer min="0" max="1" step="{ZERO}"/>',
  '<qti-random-float min="{N}" max="0"/>',
  '<qti-round-to rounding-mode="significantFigures" figures="{ZERO}"><qti-base-value base-type="float">1.7</qti-base-value></qti-round-to>',
])("returns NULL for invalid resolved numeric bounds: %s", (expression) => {
  const declarations =
    '<qti-template-declaration identifier="N" base-type="integer" cardinality="single"><qti-default-value><qti-value>1</qti-value></qti-default-value></qti-template-declaration><qti-template-declaration identifier="ZERO" base-type="integer" cardinality="single"><qti-default-value><qti-value>0</qti-value></qti-default-value></qti-template-declaration>';
  const parsed = parseQtiXml(item(expression, "float", "single", declarations));
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  expect(createItemSession(parsed.document).score().outcomes.RESULT).toBeNull();
});

it.each([
  ["<qti-random-integer/>", "processing.randomInteger.attribute"],
  ["<qti-random-float/>", "processing.randomFloat.attribute"],
  ['<qti-random-integer min="" max="0"/>', "processing.randomInteger.integer"],
  ['<qti-random-integer max="0" step=""/>', "processing.randomInteger.integer"],
  ['<qti-random-float min="" max="0"/>', "processing.randomFloat.numeric"],
  ['<qti-random-integer max=""/>', "processing.randomInteger.integer"],
  ['<qti-random-integer max="1" step="0"/>', "processing.randomInteger.step"],
  ['<qti-random-float min="1" max="0"/>', "processing.randomFloat.bounds"],
  [
    '<qti-round-to rounding-mode="decimalPlaces" figures="-1">' + integer + "</qti-round-to>",
    "processing.roundingFigures",
  ],
  [
    '<qti-round-to rounding-mode="significantFigures" figures="0">' + integer + "</qti-round-to>",
    "processing.roundingFigures",
  ],
  [
    '<qti-round-to rounding-mode="decimalPlaces" figures="1.0">' + integer + "</qti-round-to>",
    "processing.roundingFigures",
  ],
  [
    '<qti-round-to rounding-mode="decimalPlaces">' + integer + "</qti-round-to>",
    "processing.roundingFigures",
  ],
])("rejects invalid raw attributes: %s", (expression, code) => {
  const parsed = parseQtiXml(item(expression, "float", "single", ""));
  expect(parsed.ok).toBe(false);
  expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ code, severity: "error" }));
});
