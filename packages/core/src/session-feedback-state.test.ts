import { expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  validateAssessmentItem,
} from "./index.js";

// QTI 3 §7.19.3: review without feedback uses effective defaults, including template processing.
it("[ASI-FEEDBACK-STATE] retains processing history and regenerates initial outcomes independently of saved outcomes", () => {
  const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-state" title="Feedback state" time-dependent="false">
    <qti-outcome-declaration identifier="FEEDBACK" cardinality="multiple" base-type="identifier"><qti-default-value><qti-value>AUTHORED</qti-value></qti-default-value></qti-outcome-declaration>
    <qti-template-processing><qti-set-default-value identifier="FEEDBACK"><qti-multiple><qti-base-value base-type="identifier">GENERATED</qti-base-value></qti-multiple></qti-set-default-value></qti-template-processing>
    <qti-item-body><p>Feedback state.</p></qti-item-body>
    <qti-response-processing><qti-set-outcome-value identifier="FEEDBACK"><qti-multiple><qti-base-value base-type="identifier">HELP</qti-base-value></qti-multiple></qti-set-outcome-value></qti-response-processing>
  </qti-assessment-item>`;
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected document");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const session = createItemSession(parsed.document);
  expect(session.serialize().responseProcessingCompleted).toBe(false);
  session.beginAttempt();
  expect(session.serialize().responseProcessingCompleted).toBe(false);
  expect(session.initialOutcomeValue("FEEDBACK")).toEqual(["GENERATED"]);
  const scored = session.score();
  expect(scored.diagnostics).toEqual([]);
  expect(scored.state.responseProcessingCompleted).toBe(true);
  expect(scored.outcomes.FEEDBACK).toEqual(["HELP"]);
  const saved: unknown = JSON.parse(JSON.stringify(scored.state));
  expect(isQtiAttemptStateV1(saved)).toBe(true);
  if (!isQtiAttemptStateV1(saved)) throw new Error("Expected valid state");
  const restored = createItemSession(parsed.document, saved);
  expect(restored.initialOutcomeValue("FEEDBACK")).toEqual(["GENERATED"]);
  expect(restored.serialize().outcomes.FEEDBACK).toEqual(["HELP"]);
  expect(restored.serialize().responseProcessingCompleted).toBe(true);
  const defaults = restored.initialOutcomeValue("FEEDBACK");
  if (Array.isArray(defaults)) defaults.push("MUTATION");
  expect(restored.initialOutcomeValue("FEEDBACK")).toEqual(["GENERATED"]);
  expect(isQtiAttemptStateV1({ ...saved, responseProcessingCompleted: "true" })).toBe(false);
});

// A saved feedback marker must describe the outcomes of this successful processing invocation.
it("clears successful processing evidence before a failed rescore and retains it across response edits", () => {
  const parsed = parseQtiXml(
    `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rescore" title="Rescore" time-dependent="false"><qti-response-declaration identifier="PATTERN" cardinality="single" base-type="string"/><qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="boolean"/><qti-item-body><qti-extended-text-interaction response-identifier="PATTERN"/></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="FEEDBACK"><qti-pattern-match pattern="{PATTERN}"><qti-base-value base-type="string">A</qti-base-value></qti-pattern-match></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`,
  );
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const session = createItemSession(parsed.document);
  session.respond("PATTERN", "A");
  expect(session.score().state.responseProcessingCompleted).toBe(true);
  session.respond("PATTERN", "[");
  expect(session.serialize().responseProcessingCompleted).toBe(true);
  expect(session.serialize().outcomes.FEEDBACK).toBe(true);
  const failed = session.score();
  expect(failed.diagnostics).toContainEqual(
    expect.objectContaining({ code: "processing.pattern.syntax", severity: "error" }),
  );
  expect(failed.outcomes.FEEDBACK).toBeNull();
  expect(failed.state.responseProcessingCompleted).toBe(false);
  expect(
    createItemSession(parsed.document, failed.state).serialize().responseProcessingCompleted,
  ).toBe(false);
  session.respond("PATTERN", "A");
  expect(session.score().state.responseProcessingCompleted).toBe(true);
});
