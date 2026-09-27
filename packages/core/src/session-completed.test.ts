import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  processQtiAdaptiveItemTurn,
  validateAssessmentItem,
  scoreQtiItemServerSide,
} from "./index.js";

// QTI 3 §§2.2,2.5: completed adaptive items close; response processing must stop.
const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="closed" title="Closed" adaptive="true" time-dependent="false">
<qti-response-declaration identifier="DONE" cardinality="single" base-type="boolean"/>
<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
<qti-item-body><qti-end-attempt-interaction response-identifier="DONE" title="Finish"/></qti-item-body>
<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value><qti-set-outcome-value identifier="completionStatus"><qti-base-value base-type="identifier">completed</qti-base-value></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`;

it("[ASI-ADAPTIVE-CLOSED] rejects edits and scoring of a completed adaptive session, including restore", () => {
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const session = createItemSession(parsed.document);
  const first = session.score({ endAttemptResponseIdentifier: "DONE" });
  expect(first.diagnostics).toEqual([]);
  expect(first.outcomes.SCORE).toBe(1);
  for (const target of [
    session,
    createItemSession(parsed.document, first.state),
    createItemSession(parsed.document, { ...first.state, status: "interacting" }),
  ]) {
    expect(target.respond("DONE", false)).toContainEqual(
      expect.objectContaining({ code: "session.completed" }),
    );
    for (const diagnostics of [
      target.setStatus("interacting"),
      target.beginAttempt(),
      target.setInteractionState("DONE", null),
    ]) {
      expect(diagnostics).toContainEqual(expect.objectContaining({ code: "session.completed" }));
    }
    const rejected = target.score({ endAttemptResponseIdentifier: "DONE" });
    expect(rejected.diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.completed", severity: "error" }),
    );
    expect(rejected.state).toEqual(first.state);
    expect(target.serialize()).toEqual(first.state);
  }
});

it("keeps finalized grades on repeated adaptive turns but allows read-only refresh", () => {
  const first = processQtiAdaptiveItemTurn({ itemXml: xml, endAttemptResponseIdentifier: "DONE" });
  expect(first.ok).toBe(true);
  expect(first.score).toBe(1);
  expect(first.state?.status).toBe("completed");
  for (const submission of [
    { endAttemptResponseIdentifier: "DONE" },
    { trustedResponses: { DONE: false } },
  ]) {
    const repeated = processQtiAdaptiveItemTurn({
      itemXml: xml,
      priorState: first.state,
      ...submission,
    });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.completed" }),
    );
    expect(repeated.state).toEqual(first.state);
  }
  const refresh = processQtiAdaptiveItemTurn({ itemXml: xml, priorState: first.state });
  expect(refresh.ok).toBe(true);
  expect(refresh.state).toEqual(first.state);
});

it("scores the final server submission before applying a host-requested close", () => {
  const result = scoreQtiItemServerSide({
    itemXml: xml,
    status: "completed",
    endAttemptResponseIdentifier: "DONE",
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.score).toBe(1);
  expect(result.state?.status).toBe("completed");
  expect(result.state?.builtInVariables?.numAttempts).toBe(1);
});
