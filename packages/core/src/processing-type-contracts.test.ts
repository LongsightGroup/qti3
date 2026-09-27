import { validQtiDocument as valid } from "../../../tests/fixtures/valid-qti-document.js";
import { expect, it } from "vitest";
import { createItemSession, isQtiAttemptStateV1, parseQtiXml, type QtiValue } from "./index.js";

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

// QTI 3.0.1 §5.130: assignments require explicit conversion in both numeric directions.
it("requires explicit numeric assignment conversion while preserving converted results", () => {
  for (const template of [false, true]) {
    const declaration = template
      ? outcome.replace("outcome-declaration", "template-declaration")
      : outcome;
    const rule = (expression: string) =>
      template
        ? `<qti-set-template-value identifier="RESULT">${expression}</qti-set-template-value>`
        : set(expression);
    const rejected = parseQtiXml(xml(declaration, rule(base("integer", "7")), template));
    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.assignment.type" }),
    );
    if (!rejected.document) throw new Error("Expected document");
    const rejectedSession = createItemSession(rejected.document);
    expect(rejectedSession.score().diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.assignment.type" }),
    );
    expect(
      template
        ? rejectedSession.serialize().templateValues?.RESULT
        : rejectedSession.serialize().outcomes.RESULT,
    ).toBeNull();
    const document = valid(
      xml(
        declaration,
        rule(`<qti-integer-to-float>${base("integer", "7")}</qti-integer-to-float>`),
        template,
      ),
    );
    const session = createItemSession(document);
    expect(session.score().diagnostics).toEqual([]);
    expect(
      template ? session.serialize().templateValues?.RESULT : session.serialize().outcomes.RESULT,
    ).toBe(7);
  }
});

// QTI 3.0.1 §§5.114, 5.151: conditional branches require single Booleans.
it("rejects non-Boolean conditions in both phases and checks dynamic branch selection", () => {
  for (const template of [false, true]) {
    const phase = template ? "template" : "response";
    const declaration = template
      ? outcome.replace("outcome-declaration", "template-declaration")
      : outcome;
    const assignment = (value: string) =>
      template
        ? `<qti-set-template-value identifier="RESULT">${base("float", value)}</qti-set-template-value>`
        : set(base("float", value));
    const rules = (expression: string) =>
      `<qti-${phase}-condition><qti-${phase}-if>${expression}${assignment("1")}</qti-${phase}-if><qti-${phase}-else>${assignment("0")}</qti-${phase}-else></qti-${phase}-condition>`;
    const rejected = parseQtiXml(xml(declaration, rules(base("string", "0")), template));
    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.condition.type" }),
    );
    const document = valid(xml(declaration, rules(custom), template));
    for (const value of ["0", [true], true, false, null] satisfies QtiValue[]) {
      const session = createItemSession(document, undefined, {
        customOperators: { dynamic: () => value },
      });
      const score = session.score();
      expect(template ? session.serialize().templateValues?.RESULT : score.outcomes.RESULT).toBe(
        value === true ? 1 : 0,
      );
      if (typeof value === "string" || Array.isArray(value))
        expect(score.diagnostics).toContainEqual(
          expect.objectContaining({ code: "processing.condition.type" }),
        );
      else expect(score.diagnostics).toEqual([]);
    }
  }
});

// QTI 3.0.1 §5.87.2: lookup inputs are single numeric/duration; match requires integer.
it("requires lookup tables and typed inputs without breaking numeric, duration or NULL lookups", () => {
  const table =
    '<qti-interpolation-table default-value="0"><qti-interpolation-table-entry source-value="1" target-value="10"/></qti-interpolation-table>';
  const declaration = outcome.replace("/>", `>${table}</qti-outcome-declaration>`);
  const lookup = (expression: string) =>
    `<qti-lookup-outcome-value identifier="RESULT">${expression}</qti-lookup-outcome-value>`;
  for (const [decl, expression, code] of [
    [outcome, base("integer", "1"), "processing.lookup.table"],
    [declaration, base("boolean", "true"), "processing.lookup.type"],
    [declaration, `<qti-multiple>${base("integer", "1")}</qti-multiple>`, "processing.lookup.type"],
  ]) {
    const result = parseQtiXml(xml(decl!, lookup(expression!)));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
  }
  for (const [expression, expected] of [
    [base("integer", "1"), 10],
    [base("float", "1.5"), 10],
    [base("duration", "2"), 10],
    ["<qti-null/>", 0],
  ] as const) {
    const score = createItemSession(valid(xml(declaration, lookup(expression)))).score();
    expect(score.outcomes.RESULT).toBe(expected);
    expect(score.diagnostics).toEqual([]);
  }
  const document = valid(xml(declaration, lookup(custom)));
  const score = createItemSession(document, undefined, {
    customOperators: { dynamic: () => true },
  }).score();
  expect(score.outcomes.RESULT).toBeNull();
  expect(score.diagnostics).toContainEqual(
    expect.objectContaining({ code: "processing.lookup.type" }),
  );
  const matchDeclaration =
    '<qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="string"><qti-match-table><qti-match-table-entry source-value="1" target-value="identifier"/></qti-match-table></qti-outcome-declaration>';
  const rejected = parseQtiXml(xml(matchDeclaration, lookup(base("float", "1"))));
  expect(rejected.ok).toBe(false);
  expect(rejected.diagnostics).toContainEqual(
    expect.objectContaining({ code: "processing.lookup.type" }),
  );
  expect(
    createItemSession(valid(xml(matchDeclaration, lookup(base("integer", "1"))))).score().outcomes
      .RESULT,
  ).toBe("identifier");
});

// QTI 3.0.1 §8.36 requires >1 observations for all variance/SD operators.
it("rejects undersized statistics without inventing zero variance", () => {
  for (const [operator, expected] of [
    ["sampleVariance", 2],
    ["sampleSD", Math.SQRT2],
    ["popVariance", 1],
    ["popSD", 1],
    ["mean", 4],
  ] as const) {
    const document = valid(
      xml(outcome, set(`<qti-stats-operator name="${operator}">${custom}</qti-stats-operator>`)),
    );
    for (const values of [[5], [3, 5], null]) {
      const score = createItemSession(document, undefined, {
        customOperators: { dynamic: () => values },
      }).score();
      const undersized = values?.length === 1 && operator !== "mean";
      expect(score.outcomes.RESULT).toBe(
        undersized || values === null ? null : values.length === 1 ? 5 : expected,
      );
      if (undersized)
        expect(score.diagnostics).toContainEqual(
          expect.objectContaining({ code: "processing.stats.size" }),
        );
      else expect(score.diagnostics).toEqual([]);
    }
  }
});
