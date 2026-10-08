import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assertQtiXmlSchema } from "../../../tests/fixtures/valid-qti-document.js";
import { requireTestResult } from "../../../tests/fixtures/test-result.js";
import { parseQtiTestRubrics } from "./test-rubrics.js";
import { parseQtiFixedTestOrdering, prepareQtiFixedTestOrder } from "./test-ordering.js";

const source = readFileSync(
  new URL(
    "../../../tests/fixtures/test-profile/fixed-ordering-instruction-sections.xml",
    import.meta.url,
  ),
  "utf8",
);

function definition() {
  assertQtiXmlSchema(source);
  return requireTestResult(parseQtiFixedTestOrdering(source));
}

// QTI 3.0.1 AssessmentSectionDType permits zero item references; implementation
// guide §4.6.1 retains candidate rubric content on entry to its authored section.
it("[ASI-INSTRUCTION-SECTION-ORDER] retains leading, intermediate and ending instruction scopes without inventing question references", () => {
  const parsed = definition();
  expect(
    parsed.sections.map(({ partIdentifier, sectionIdentifier, items }) => [
      partIdentifier,
      sectionIdentifier,
      items.map(({ identifier }) => identifier),
    ]),
  ).toEqual([
    ["P", "INTRO", []],
    ["P", "FIRST", ["Q1"]],
    ["P", "BETWEEN", []],
    ["P", "SECOND", ["Q2"]],
    ["P", "END", []],
  ]);
  const rubrics = requireTestResult(parseQtiTestRubrics(source));
  expect(rubrics.map(({ scopeType, scopeIdentifier }) => [scopeType, scopeIdentifier])).toEqual([
    ["assessment-section", "INTRO"],
    ["assessment-section", "BETWEEN"],
    ["assessment-section", "END"],
  ]);
  const expected = {
    schema: "qti3.fixed-test-order.v1",
    testIdentifier: "INSTRUCTIONS",
    sections: [
      { partIdentifier: "P", sectionIdentifier: "INTRO", itemRefs: [] },
      { partIdentifier: "P", sectionIdentifier: "FIRST", itemRefs: ["Q1"] },
      { partIdentifier: "P", sectionIdentifier: "BETWEEN", itemRefs: [] },
      { partIdentifier: "P", sectionIdentifier: "SECOND", itemRefs: ["Q2"] },
      { partIdentifier: "P", sectionIdentifier: "END", itemRefs: [] },
    ],
  };
  expect(
    requireTestResult(prepareQtiFixedTestOrder(parsed, { kind: "new", seed: "attempt" })),
  ).toEqual(expected);
  const serialized: unknown = JSON.parse(JSON.stringify(expected));
  expect(
    requireTestResult(prepareQtiFixedTestOrder(parsed, { kind: "restore", state: serialized })),
  ).toEqual(expected);
});

it.each([
  {
    sections: [
      { partIdentifier: "P", sectionIdentifier: "FIRST", itemRefs: ["Q1"] },
      { partIdentifier: "P", sectionIdentifier: "SECOND", itemRefs: ["Q2"] },
    ],
  },
  {
    sections: [
      { partIdentifier: "P", sectionIdentifier: "INTRO", itemRefs: ["Q1"] },
      { partIdentifier: "P", sectionIdentifier: "FIRST", itemRefs: ["Q1"] },
      { partIdentifier: "P", sectionIdentifier: "BETWEEN", itemRefs: [] },
      { partIdentifier: "P", sectionIdentifier: "SECOND", itemRefs: ["Q2"] },
      { partIdentifier: "P", sectionIdentifier: "END", itemRefs: [] },
    ],
  },
])(
  "rejects saved orders that remove instruction scopes or insert responses into them",
  ({ sections }) => {
    expect(
      prepareQtiFixedTestOrder(definition(), {
        kind: "restore",
        state: { schema: "qti3.fixed-test-order.v1", testIdentifier: "INSTRUCTIONS", sections },
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "test.ordering.state" }] });
  },
);
