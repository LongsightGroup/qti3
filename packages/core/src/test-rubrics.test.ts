import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseQtiTestRubrics, parseQtiTestExecution } from "./index.js";

const fixture = readFileSync(
  new URL("../../../tests/fixtures/test-delivery/rubric-static-scopes.xml", import.meta.url),
  "utf8",
);

// QTI 3.0.1 ASI §5.160: test rubrics retain audience, use, body and owning scope.
// Positive XML is independently validated by check:test-xsd's test-delivery fixture gate.
it("[ASI-TEST-RUBRIC-STATIC] retains authored scope and content without enabling a different execution profile", () => {
  const parsed = parseQtiTestRubrics(fixture);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("Expected static test rubrics");
  expect(
    parsed.value.map(({ scopeType, scopeIdentifier, node }) => [
      scopeType,
      scopeIdentifier,
      node.attributes.view,
      node.attributes.use,
    ]),
  ).toEqual([
    ["assessment-test", "T", "candidate", undefined],
    ["test-part", "P", "scorer", "scoring"],
    ["test-part", "P", "candidate scorer", "instructions"],
    ["assessment-section", "S", "candidate", "navigation"],
  ]);
  expect(JSON.stringify(parsed.value[2]?.node)).toContain('"qtiName":"strong"');
  expect(parsed.value[2]?.node.source?.path).toContain("qti-test-part");
  expect(parseQtiTestExecution(fixture)).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "test.rubric.unsupported" }),
    ]),
  });
});

it.each([
  ['<qti-printed-variable identifier="SCORE"/>', "test.rubric.dynamic.unsupported"],
  [
    '<qti-feedback-block identifier="A" outcome-identifier="FEEDBACK" show-hide="show">Feedback</qti-feedback-block>',
    "test.rubric.dynamic.unsupported",
  ],
  [
    '<qti-template-block template-identifier="A" identifier="T" show-hide="show">Template</qti-template-block>',
    "rubric.template.forbidden",
  ],
  [
    '<qti-choice-interaction response-identifier="R" max-choices="1"/>',
    "rubric.interaction.forbidden",
  ],
  [
    '<qti-rubric-block view="candidate" use="instructions"><qti-content-body>Nested</qti-content-body></qti-rubric-block>',
    "rubric.nested",
  ],
])("refuses static delivery that would omit authored behavior: %s", (content, code) => {
  const result = parseQtiTestRubrics(fixture.replace("Test instructions.", content));
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code, severity: "error" })]),
  });
});

it.each([
  ['view="candidate"', 'view="student"', "rubric.view.invalid"],
  ['view="candidate"', 'view="candidate" use="ext:custom"', "test.rubric.use.unsupported"],
  [
    "<qti-content-body><p>Test instructions.</p></qti-content-body>",
    '<qti-stylesheet href="local.css"/><qti-content-body><p>Test instructions.</p></qti-content-body>',
    "rubric.resource.unsupported",
  ],
])("rejects invalid audiences and unsupported presentation policy: %s", (before, after, code) => {
  expect(parseQtiTestRubrics(fixture.replace(before, after))).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
  });
});

it("returns explicit diagnostics for malformed XML and rubrics outside identified test scopes", () => {
  expect(parseQtiTestRubrics("<broken>")).toMatchObject({
    ok: false,
    diagnostics: [{ code: "test.rubric.xml" }],
  });
  expect(parseQtiTestRubrics(fixture.replace('identifier="T"', ""))).toMatchObject({
    ok: false,
    diagnostics: [{ code: "test.rubric.scope" }],
  });
  expect(
    parseQtiTestRubrics(
      fixture.replace(
        "<qti-content-body><p>Test instructions.</p></qti-content-body>",
        '<qti-content-body><div><qti-rubric-block view="candidate" use="instructions"><qti-content-body>Nested</qti-content-body></qti-rubric-block></div></qti-content-body>',
      ),
    ),
  ).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: "rubric.nested" })]),
  });
});
