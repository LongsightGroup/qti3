import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  materializeQtiItemSubmission,
  scoreQtiItemServerSide,
} from "./index.js";

// QTI 3 §5.45: default values are ignored and only the triggering interaction is true.
const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="end" title="End attempt" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="HINT" cardinality="single" base-type="boolean"><qti-default-value><qti-value>true</qti-value></qti-default-value></qti-response-declaration>
  <qti-response-declaration identifier="DONE" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="HINTVALUE" cardinality="single" base-type="boolean"/>
  <qti-item-body><qti-end-attempt-interaction response-identifier="HINT" title="Hint"/><qti-end-attempt-interaction response-identifier="DONE" title="Finish"/></qti-item-body>
  <qti-response-processing><qti-set-outcome-value identifier="HINTVALUE"><qti-variable identifier="HINT"/></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`;
it("sets end-attempt responses from each trigger including host scoring and restore", () => {
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  let session = createItemSession(parsed.document);
  expect(session.presentationResponse("HINT")).toBe(false);
  expect(session.score().state.responses).toEqual({ HINT: false, DONE: false });
  expect(session.score({ endAttemptResponseIdentifier: "HINT" }).outcomes.HINTVALUE).toBe(true);
  session = createItemSession(parsed.document, session.serialize());
  const finished = session.score({ endAttemptResponseIdentifier: "DONE" });
  expect(finished.state.responses).toEqual({ HINT: false, DONE: true });
  expect(finished.outcomes.HINTVALUE).toBe(false);
  session.score({ endAttemptResponseIdentifier: "HINT" });
  expect(session.score().outcomes.HINTVALUE).toBe(false);
});

it("carries an explicit end-attempt trigger through server scoring and submission materialization", () => {
  const itemXml = xml.replace('adaptive="true"', 'adaptive="false"');
  const score = scoreQtiItemServerSide({ itemXml, endAttemptResponseIdentifier: "HINT" });
  expect(score.diagnostics).toEqual([]);
  expect(score.outcomes.HINTVALUE).toBe(true);
  const hint = materializeQtiItemSubmission({ itemXml: xml, endAttemptResponseIdentifier: "HINT" });
  expect(hint.diagnostics).toEqual([]);
  expect(hint.state?.outcomes.HINTVALUE).toBe(true);
  const done = materializeQtiItemSubmission({
    itemXml: xml,
    existingState: hint.state,
    endAttemptResponseIdentifier: "DONE",
  });
  expect(done.diagnostics).toEqual([]);
  expect(done.state?.responses).toEqual({ HINT: false, DONE: true });
  expect(done.state?.outcomes.HINTVALUE).toBe(false);
});

// A host trigger must identify an actual end-attempt interaction; invalid input is atomic.
it.each(["TYPO", "SCORE", ""])(
  "rejects invalid trigger %j without changing the attempt",
  (identifier) => {
    const parsed = parseQtiXml(xml);
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Expected item");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    const session = createItemSession(parsed.document);
    session.score({ endAttemptResponseIdentifier: "HINT" });
    const before = session.serialize();
    const result = session.score({ endAttemptResponseIdentifier: identifier });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "session.endAttempt.identifier", severity: "error" }),
    ]);
    expect(result.state).toEqual(before);
    expect(session.serialize()).toEqual(before);
    const submitted = materializeQtiItemSubmission({
      itemXml: xml,
      existingState: before,
      endAttemptResponseIdentifier: identifier,
    });
    expect(submitted.ok).toBe(false);
    expect(submitted.diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.endAttempt.identifier" }),
    );
    const scored = scoreQtiItemServerSide({
      itemXml: xml.replace('adaptive="true"', 'adaptive="false"'),
      endAttemptResponseIdentifier: identifier,
    });
    expect(scored.ok).toBe(false);
    expect(scored.diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.endAttempt.identifier" }),
    );
  },
);
