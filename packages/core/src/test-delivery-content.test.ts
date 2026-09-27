import { expect, it } from "vitest";
import { parseQtiTestExecution } from "./test-parser.js";

// QTI 3 ASI information model §5.157: TestFeedback belongs to AssessmentTest or
// TestPart; access and an identifier outcome control candidate-visible content.
// https://www.imsglobal.org/spec/qti/v3p0/info/
function testXml(partContent = "", testContent = ""): string {
  return `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="T" title="Test">
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier">
    <qti-default-value><qti-value>DONE</qti-value></qti-default-value>
  </qti-outcome-declaration>
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
])("rejects feedback-only fixed delivery at %s scope with access %s", (scope, access) => {
  const content = feedback(access);
  const result = parseQtiTestExecution(scope === "part" ? testXml(content) : testXml("", content));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: "test.feedback.unsupported",
    severity: "error",
    path: expect.stringContaining("qti-test-feedback"),
    source: { line: expect.any(Number), column: expect.any(Number) },
  });
});

it("keeps ordinary fixed tests deliverable", () => {
  expect(parseQtiTestExecution(testXml())).toEqual({ ok: true, value: { kind: "fixed" } });
});

it("does not mistake foreign-namespace content for QTI test feedback", () => {
  expect(
    parseQtiTestExecution(testXml('<qti-test-feedback xmlns="urn:example:extension"/>')),
  ).toEqual({ ok: true, value: { kind: "fixed" } });
});
