import { expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  validateAssessmentItem,
  type QtiDocument,
  type QtiValue,
} from "./index.js";

function xml(declarations: string, rules: string, template = false): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="types" title="Type contracts" adaptive="false" time-dependent="false">${declarations}${template ? `<qti-template-processing>${rules}</qti-template-processing>` : ""}<qti-item-body><p>Type contracts.</p></qti-item-body>${template ? "" : `<qti-response-processing>${rules}</qti-response-processing>`}</qti-assessment-item>`;
}
const outcome =
  '<qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="float"/>';
const set = (expression: string) =>
  `<qti-set-outcome-value identifier="RESULT">${expression}</qti-set-outcome-value>`;
const base = (type: string, value: string) =>
  `<qti-base-value base-type="${type}">${value}</qti-base-value>`;
const custom = '<qti-custom-operator class="dynamic"/>';
function valid(source: string): QtiDocument {
  const result = parseQtiXml(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.ok).toBe(true);
  if (!result.document) throw new Error("Expected parsed document");
  expect(validateAssessmentItem(result.document)).toEqual({ ok: true, diagnostics: [] });
  return result.document;
}

// QTI 3.0.1 §8.17 and §2.11.3.28: multiple containers ignore order but retain
// multiplicities. Unicode collation equivalence cannot replace exact value equality.
it("matches permuted Unicode multisets without conflating distinct strings or ordered values", () => {
  const composed = base("string", "\u00e9");
  const decomposed = base("string", "e\u0301");
  for (const [container, right, expected] of [
    ["multiple", decomposed + composed, true],
    ["multiple", composed + composed, false],
    ["ordered", decomposed + composed, false],
  ] as const) {
    const expression = `<qti-match><qti-${container}>${composed}${decomposed}</qti-${container}><qti-${container}>${right}</qti-${container}></qti-match>`;
    const document = valid(
      xml(outcome.replace('base-type="float"', 'base-type="boolean"'), set(expression)),
    );
    expect(createItemSession(document).score().outcomes.RESULT).toBe(expected);
  }
});

// QTI 3.0.1 §5.130.2: assignment expressions must match the target variable's
// effective base type and cardinality, in both processing phases.
it("rejects incompatible assignments in response and template processing", () => {
  for (const [declaration, rule, template] of [
    [outcome, set(base("string", "pass")), false],
    [outcome, set(`<qti-multiple>${base("float", "2")}</qti-multiple>`), false],
    [
      '<qti-template-declaration identifier="RESULT" cardinality="single" base-type="float"/>',
      `<qti-set-template-value identifier="RESULT">${base("boolean", "true")}</qti-set-template-value>`,
      true,
    ],
    [
      '<qti-response-declaration identifier="RESULT" cardinality="single" base-type="integer"/>',
      `<qti-set-correct-response identifier="RESULT">${base("string", "2")}</qti-set-correct-response>`,
      true,
    ],
  ] as const) {
    const result = parseQtiXml(xml(declaration, rule, template));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.assignment.type", severity: "error" }),
    );
  }
});

// QTI 3.0.1 §2.11.3.24 and §2.11.3.40: integer division requires single integers;
// sum accepts numeric scalars and containers, but never coerces Boolean true to 1.
it("rejects known nonnumeric operands and wrong numeric cardinality", () => {
  for (const expression of [
    `<qti-sum>${base("boolean", "true")}${base("integer", "2")}</qti-sum>`,
    `<qti-integer-divide><qti-multiple>${base("integer", "4")}</qti-multiple>${base("integer", "2")}</qti-integer-divide>`,
  ]) {
    const result = parseQtiXml(xml(outcome, set(expression)));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.operand.type", severity: "error" }),
    );
  }
});

it("checks dynamic numeric operands without rejecting valid mixed numeric sums or NULL", () => {
  const document = valid(xml(outcome, set(`<qti-sum>${custom}${base("float", "2.5")}</qti-sum>`)));
  for (const [value, expected, code] of [
    [true, null, "processing.operand.type"],
    [2, 4.5, undefined],
    [null, null, undefined],
  ] satisfies Array<[QtiValue, QtiValue, string | undefined]>) {
    const session = createItemSession(document, undefined, {
      customOperators: { dynamic: () => value },
    });
    const score = session.score();
    expect(score.outcomes.RESULT).toBe(expected);
    if (code) expect(score.diagnostics).toContainEqual(expect.objectContaining({ code }));
    else expect(score.diagnostics).toEqual([]);
  }
});

it("rejects dynamic assignment results before they can make saved state unrestorable", () => {
  for (const template of [false, true]) {
    const declarations = template
      ? '<qti-template-declaration identifier="RESULT" cardinality="single" base-type="float"/>'
      : outcome;
    const rules = template
      ? `<qti-set-template-value identifier="RESULT">${custom}</qti-set-template-value>`
      : set(custom);
    const document = valid(xml(declarations, rules, template));
    const options = { customOperators: { dynamic: () => "pass" } };
    const session = createItemSession(document, undefined, options);
    const score = session.score();
    expect(score.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.assignment.type", severity: "error" }),
    );
    const state = session.serialize();
    expect(template ? state.templateValues?.RESULT : state.outcomes.RESULT).toBeNull();
    const saved: unknown = JSON.parse(JSON.stringify(state));
    if (!isQtiAttemptStateV1(saved)) throw new Error("Expected valid saved state");
    expect(createItemSession(document, saved, options).serialize()).toEqual(state);
  }
});
