import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseQtiTestExecution } from "./test-parser.js";
import { startQtiTest, submitQtiTestAnswer } from "./test-session.js";
import { validateQtiTest } from "./test-validation.js";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../../../tests/fixtures/test-delivery/${name}.xml`, import.meta.url),
    "utf8",
  );

// QTI 3.0.1 ASI information model §5.157: TestFeedback belongs to AssessmentTest or
// TestPart; access and an identifier outcome control candidate-visible content.
// https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html
function testXml(partContent = "", testContent = ""): string {
  return `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="T" title="Test">
  <qti-test-part identifier="P" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="S" title="Section" visible="true">
      <qti-assessment-item-ref identifier="I" href="item.xml"/>
    </qti-assessment-section>
    ${partContent}
  </qti-test-part>
  ${testContent}
</qti-assessment-test>`;
}

function feedback(access: string): string {
  return `<qti-test-feedback identifier="DONE" outcome-identifier="FEEDBACK" access="${access}" show-hide="show">
    <qti-content-body><p>Candidate feedback.</p></qti-content-body>
  </qti-test-feedback>`;
}

it.each([
  ["part", "during"],
  ["part", "atEnd"],
  ["test", "during"],
  ["test", "atEnd"],
])(
  "[ASI-TEST-FEEDBACK] rejects feedback-only fixed delivery at %s scope with access %s",
  (scope, access) => {
    const result = parseQtiTestExecution(fixture(`feedback-${scope}-${access}`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "test.feedback.unsupported",
      severity: "error",
      path: expect.stringContaining("qti-test-feedback"),
      source: { line: expect.any(Number), column: expect.any(Number) },
    });
  },
);

it("keeps ordinary fixed tests deliverable", () => {
  expect(parseQtiTestExecution(testXml())).toEqual({ ok: true, value: { kind: "fixed" } });
});

it("rejects foreign extensions without misidentifying them as QTI test feedback", () => {
  const result = parseQtiTestExecution(
    testXml('<qti-test-feedback xmlns="urn:example:extension"/>'),
  );
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "test.xml.unsupported" }] });
});

// §2.9: outcome processing is required even when navigation needs no branching.
it("[ASI-TEST-OUTCOMES] executes outcome processing on an otherwise fixed route", () => {
  const xml = fixture("outcomes");
  const result = parseQtiTestExecution(xml);
  expect(result.ok).toBe(true);
  if (!result.ok || result.value.kind !== "sequenced") throw new Error("Expected test runtime");
  const test = result.value.test;
  expect(validateQtiTest(test).ok).toBe(true);
  const initial = startQtiTest(test);
  expect(initial.outcomes.TOTAL).toBeNull();
  const submitted = submitQtiTestAnswer(test, initial, { itemRef: "I", score: 3.5 });
  expect(submitted).toMatchObject({
    ok: true,
    value: { status: "completed", outcomes: { TOTAL: 3.5 } },
  });
});

it("[ASI-TEST-OUTCOMES-REJECT] refuses unsupported outcome programs without branching", () => {
  const result = parseQtiTestExecution(fixture("outcomes-unsupported"));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "test.xml.unsupported" }),
  );
});

it.each(["test", "part", "section"])(
  "[ASI-TEST-RUBRIC] refuses omitted instructions at %s scope",
  (scope) => {
    const xml = fixture(`rubric-${scope}`);
    expect(parseQtiTestExecution(xml)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "test.rubric.unsupported" }],
    });
  },
);

function withConstraint(scope: string, constraint: string): string {
  const xml = testXml();
  if (scope === "test") return xml.replace("<qti-test-part ", `${constraint}<qti-test-part `);
  if (scope === "part")
    return xml.replace("<qti-assessment-section ", `${constraint}<qti-assessment-section `);
  if (scope === "section")
    return xml.replace("<qti-assessment-item-ref ", `${constraint}<qti-assessment-item-ref `);
  return xml.replace(
    '<qti-assessment-item-ref identifier="I" href="item.xml"/>',
    `<qti-assessment-item-ref identifier="I" href="item.xml">${constraint}</qti-assessment-item-ref>`,
  );
}

// §7.40: time limits belong to test, part, section, and item reference scopes.
it.each(["test", "part", "section", "item"])(
  "[ASI-TEST-TIMING] rejects unenforced time limits at %s scope",
  (scope) => {
    expect(parseQtiTestExecution(fixture(`timing-${scope}`))).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "test.time-limits.unsupported",
          severity: "error",
          path: expect.stringContaining("qti-time-limits"),
        },
      ],
    });
  },
);

// §7.19: inherited controls affect all items unless overridden at a narrower scope.
it.each(["part", "section", "item"])(
  "[ASI-TEST-CONTROLS] rejects unapplied session controls at %s scope",
  (scope) => {
    expect(parseQtiTestExecution(fixture(`controls-${scope}`))).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "test.session-control.unsupported",
          severity: "error",
          path: expect.stringContaining("qti-item-session-control"),
        },
      ],
    });
  },
);

it("retains all delivery blockers instead of stopping at the first one", () => {
  const xml = withConstraint(
    "part",
    '<qti-item-session-control max-attempts="1"/><qti-time-limits max-time="60"/>',
  ).replace("</qti-test-part>", `${feedback("during")}</qti-test-part>`);
  expect(parseQtiTestExecution(xml)).toMatchObject({
    ok: false,
    diagnostics: [
      { code: "test.session-control.unsupported" },
      { code: "test.time-limits.unsupported" },
      { code: "test.feedback.unsupported" },
    ],
  });
});
