import { describe, expect, expectTypeOf, it } from "vitest";
import { parseQtiTest, parseQtiTestExecution } from "./test-parser.js";
import { parseQtiXml } from "./parser.js";
import { serializeTestExpression } from "./test-expression-serializer.js";
import { startQtiTest, submitQtiTestAnswer } from "./test-session.js";
import { validateQtiTest } from "./test-validation.js";
import type { QtiTestDefinition } from "./test-model.js";
import type { QtiTestExpression } from "./test-expression.js";
import type { QtiProcessingExpression } from "./types.js";

const number = (value: number) => `<qti-base-value base-type="float">${value}</qti-base-value>`;
const bool = (value: boolean) => `<qti-base-value base-type="boolean">${value}</qti-base-value>`;
const missing = '<qti-variable identifier="UNSET"/>';

function testXml(expression: string, baseType = "boolean", branches = ""): string {
  return `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Test">
    <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="${baseType}"/>
    <qti-outcome-declaration identifier="UNSET" cardinality="single" base-type="boolean"/>
    <qti-outcome-declaration identifier="PRIOR" cardinality="single" base-type="float"><qti-default-value><qti-value>7</qti-value></qti-default-value></qti-outcome-declaration>
    <qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual">
      <qti-assessment-section identifier="first" title="First" visible="true">${branches}
        <qti-assessment-item-ref identifier="one" href="items/one.xml" category="group"/>
        <qti-assessment-item-ref identifier="two" href="items/two.xml" category="other"/>
      </qti-assessment-section>
      <qti-assessment-section identifier="second" title="Second" visible="true"><qti-assessment-item-ref identifier="three" href="items/three.xml" category="group"/></qti-assessment-section>
    </qti-test-part>
    <qti-outcome-processing><qti-set-outcome-value identifier="RESULT">${expression}</qti-set-outcome-value></qti-outcome-processing>
  </qti-assessment-test>`;
}

function executable(xml: string) {
  const parsed = parseQtiTest(xml);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

describe("closed test expression language", () => {
  it("keeps test-only nodes out of the item expression type and parser", () => {
    expectTypeOf<QtiTestExpression>().not.toExtend<QtiProcessingExpression>();
    const parsed = parseQtiXml(
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" adaptive="false" time-dependent="false"><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/><qti-item-body><p>Test</p></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-test-variables variable-identifier="SCORE"/></qti-sum></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`,
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
  });

  it.each([
    [bool(true), "boolean", true],
    ['<qti-variable identifier="PRIOR"/>', "float", 7],
    [`<qti-sum>${number(2)}${number(3.5)}</qti-sum>`, "float", 5.5],
    [`<qti-gt>${number(2)}${number(2)}</qti-gt>`, "boolean", false],
    [`<qti-gte>${number(2)}${number(2)}</qti-gte>`, "boolean", true],
    [`<qti-lt>${number(1)}${number(2)}</qti-lt>`, "boolean", true],
    [`<qti-lte>${number(3)}${number(2)}</qti-lte>`, "boolean", false],
    [`<qti-and>${bool(true)}${bool(false)}</qti-and>`, "boolean", false],
    [`<qti-or>${bool(false)}${bool(true)}</qti-or>`, "boolean", true],
    [`<qti-not>${bool(false)}</qti-not>`, "boolean", true],
    ['<qti-base-value base-type="string">A &amp; B</qti-base-value>', "string", "A & B"],
    ['<qti-base-value base-type="identifier">choice_A</qti-base-value>', "identifier", "choice_A"],
  ])("parses, evaluates and serializes %s", (xml, baseType, expected) => {
    const test = executable(testXml(xml, baseType));
    expect(startQtiTest(test).outcomes.RESULT).toBe(expected);
    const expression = test.outcomeProcessing[0]?.expression;
    if (!expression) throw new Error("Missing expression");
    const serialized = serializeTestExpression(expression);
    if (!serialized.ok) throw new Error("Expression did not serialize");
    expect(startQtiTest(executable(testXml(serialized.value, baseType))).outcomes.RESULT).toBe(
      expected,
    );
  });

  it.each([
    [missing, null],
    [`<qti-not>${missing}</qti-not>`, null],
    [`<qti-and>${missing}${bool(true)}</qti-and>`, null],
    [`<qti-and>${missing}${bool(false)}</qti-and>`, false],
    [`<qti-and>${bool(false)}${missing}</qti-and>`, false],
    [`<qti-or>${missing}${bool(false)}</qti-or>`, null],
    [`<qti-or>${missing}${bool(true)}</qti-or>`, true],
    [`<qti-or>${bool(true)}${missing}</qti-or>`, true],
    [
      `<qti-gt><qti-sum><qti-test-variables variable-identifier="SCORE"/></qti-sum>${number(0)}</qti-gt>`,
      null,
    ],
  ])("preserves QTI null semantics for %s", (xml, expected) => {
    expect(startQtiTest(executable(testXml(xml))).outcomes.RESULT).toBe(expected);
  });

  it("aggregates all or categorized scores and recomputes sequential assignments", () => {
    const xml = testXml(
      '<qti-sum><qti-test-variables variable-identifier="SCORE" include-category="group"/></qti-sum>',
      "float",
    ).replace(
      "</qti-outcome-processing>",
      '<qti-set-outcome-value identifier="PRIOR"><qti-sum><qti-variable identifier="RESULT"/><qti-test-variables variable-identifier="SCORE"/>' +
        number(10) +
        "</qti-sum></qti-set-outcome-value></qti-outcome-processing>",
    );
    const test = executable(xml);
    let session = startQtiTest(test);
    expect(session.outcomes).toMatchObject({ RESULT: null, PRIOR: null });
    for (const submission of [
      { itemRef: "one", score: 2 },
      { itemRef: "two", score: 3 },
    ]) {
      const result = submitQtiTestAnswer(test, session, submission);
      if (!result.ok) throw new Error("Submission failed");
      session = result.value;
    }
    expect(session.outcomes).toMatchObject({ RESULT: 2, PRIOR: 17 });
  });

  it.each([
    "<qti-sum/>",
    "<qti-and/>",
    "<qti-or/>",
    "<qti-not/>",
    `<qti-not>${bool(true)}${bool(false)}</qti-not>`,
    `<qti-gt>${number(1)}</qti-gt>`,
    `<qti-gt>${number(1)}${number(2)}${number(3)}</qti-gt>`,
    `<qti-base-value base-type="boolean">true${bool(false)}</qti-base-value>`,
    '<qti-variable identifier="UNSET" weight-identifier="weight"/>',
    '<qti-variable identifier="UNKNOWN"/>',
    '<qti-base-value base-type="boolean">banana</qti-base-value>',
    '<qti-base-value base-type="float">1oops</qti-base-value>',
    `<qti-not><qti-random/></qti-not>`,
    `<qti-not xmlns="urn:foreign">${bool(true)}</qti-not>`,
    `<qti-not>ignored${bool(true)}</qti-not>`,
    `<qti-and>${number(1)}${bool(true)}</qti-and>`,
  ])("rejects malformed or unsupported nested expressions: %s", (expression) => {
    expect(parseQtiTest(testXml(expression)).ok).toBe(false);
  });

  it("rejects unsupported score aggregation and incompatible assignment types", () => {
    for (const expression of [
      '<qti-sum><qti-test-variables variable-identifier="OTHER"/></qti-sum>',
      '<qti-sum><qti-test-variables variable-identifier="SCORE" include-category="missing"/></qti-sum>',
      '<qti-test-variables variable-identifier="SCORE"/>',
    ])
      expect(parseQtiTest(testXml(expression, "float")).ok).toBe(false);
    expect(parseQtiTest(testXml(number(1.5), "integer")).ok).toBe(false);
    expect(
      parseQtiTest(testXml('<qti-base-value base-type="string">id</qti-base-value>', "identifier"))
        .ok,
    ).toBe(false);
  });

  it("classifies fixed XML and validates sequenced XML on the same boundary", () => {
    expect(parseQtiTestExecution(testXml(bool(true)))).toEqual({
      ok: true,
      value: { kind: "fixed" },
    });
    const branch = `<qti-branch-rule target="EXIT_TEST">${bool(true)}</qti-branch-rule>`;
    expect(parseQtiTestExecution(testXml(bool(true), "boolean", branch))).toMatchObject({
      ok: true,
      value: { kind: "sequenced" },
    });
    expect(
      parseQtiTestExecution(testXml(bool(true), "boolean", '<qti-selection select="1"/>')).ok,
    ).toBe(false);
  });

  it("advances within sections, takes the first true branch, and falls through null predicates", () => {
    for (const [conditions, expected] of [
      [
        `<qti-branch-rule target="second">${bool(true)}</qti-branch-rule><qti-branch-rule target="EXIT_TEST">${bool(true)}</qti-branch-rule>`,
        "active",
      ],
      [`<qti-branch-rule target="EXIT_TEST">${missing}</qti-branch-rule>`, "active"],
      [`<qti-branch-rule target="EXIT_TEST">${bool(true)}</qti-branch-rule>`, "completed"],
    ]) {
      const test = executable(testXml(bool(true), "boolean", conditions));
      const first = submitQtiTestAnswer(test, startQtiTest(test), { itemRef: "one", score: 1 });
      if (!first.ok) throw new Error("First answer failed");
      expect(first.value).toMatchObject({ status: "active", currentItemRef: "two" });
      const second = submitQtiTestAnswer(test, first.value, { itemRef: "two", score: 1 });
      expect(second).toMatchObject({ ok: true, value: { status: expected } });
      if (expected === "active")
        expect(second).toMatchObject({ value: { currentItemRef: "three" } });
    }
  });

  it("owns validated data so later edits cannot invalidate startup or processing", () => {
    const parsed = executable(testXml(number(1), "float"));
    const expression = { type: "baseValue", baseType: "float", value: 4 } as const;
    const items = [{ identifier: "owned", href: "items/owned.xml", categories: ["group"] }];
    const definition: QtiTestDefinition = {
      ...parsed,
      sections: [{ identifier: "owned_section", title: "Owned", items, branches: [] }],
      outcomeProcessing: [{ type: "setOutcomeValue", identifier: "RESULT", expression }],
    };
    const result = validateQtiTest(definition);
    if (!result.ok) throw new Error("Definition invalid");
    items.length = 0;
    expect(startQtiTest(result.value)).toMatchObject({
      currentItemRef: "owned",
      outcomes: { RESULT: 4 },
    });
  });
});
