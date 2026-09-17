import { describe, expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  scoreQtiItemServerSide,
} from "./index.js";

function item(timed = true, adaptive = false) {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="builtins" title="Built-ins" time-dependent="${timed}" adaptive="${adaptive}">
    <qti-response-declaration identifier="R" cardinality="single" base-type="string"/>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    <qti-outcome-declaration identifier="COUNT" cardinality="single" base-type="integer"/>
    <qti-outcome-declaration identifier="STATUS" cardinality="single" base-type="identifier"/>
    <qti-outcome-declaration identifier="CONTEXT" cardinality="record"/>
    <qti-template-declaration identifier="ENVIRONMENT" cardinality="single" base-type="string"/>
    <qti-template-processing><qti-set-template-value identifier="ENVIRONMENT"><qti-field-value field-identifier="environmentIdentifier"><qti-variable identifier="QTI_CONTEXT"/></qti-field-value></qti-set-template-value></qti-template-processing>
    <qti-item-body><p>Response: <qti-text-entry-interaction response-identifier="R"/></p></qti-item-body>
    <qti-response-processing>
      <qti-set-outcome-value identifier="SCORE">${timed ? '<qti-variable identifier="duration"/>' : '<qti-base-value base-type="float">1</qti-base-value>'}</qti-set-outcome-value>
      <qti-set-outcome-value identifier="COUNT"><qti-variable identifier="numAttempts"/></qti-set-outcome-value>
      <qti-set-outcome-value identifier="STATUS"><qti-variable identifier="completionStatus"/></qti-set-outcome-value>
      <qti-set-outcome-value identifier="CONTEXT"><qti-variable identifier="QTI_CONTEXT"/></qti-set-outcome-value>
    </qti-response-processing>
  </qti-assessment-item>`;
}

function document(timed = true, adaptive = false) {
  const parsed = parseQtiXml(item(timed, adaptive));
  expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  if (!parsed.document) throw new Error("Expected parsed built-in item.");
  return parsed.document;
}

describe("built-in item session variables", () => {
  it.each([false, true])(
    "counts attempt boundaries, not individual responses or suspended sessions (adaptive=%s)",
    (adaptive) => {
      const doc = document(false, adaptive);
      const session = createItemSession(doc);
      expect(session.serialize().builtInVariables?.numAttempts).toBe(0);
      session.beginAttempt();
      session.beginAttempt();
      session.respond("R", "first");
      session.respond("R", "edited");
      session.setStatus("suspended");
      const resumed = createItemSession(doc, session.serialize());
      resumed.setStatus("interacting");
      expect(resumed.score().outcomes).toMatchObject({ COUNT: 1, STATUS: "unknown" });
      const afterFeedback = createItemSession(doc, resumed.serialize());
      afterFeedback.respond("R", "second");
      expect(afterFeedback.score().outcomes.COUNT).toBe(2);
      afterFeedback.setStatus("completed");
      afterFeedback.beginAttempt();
      expect(afterFeedback.serialize().builtInVariables?.numAttempts).toBe(2);
    },
  );

  it("resolves initial completionStatus and numAttempts without declarations", () => {
    const result = createItemSession(document(false)).score();
    expect(result.outcomes).toMatchObject({ COUNT: 0, STATUS: "not_attempted" });
  });

  it("resolves host context before template processing and preserves all fields on restore", () => {
    const doc = document(false);
    const context = {
      candidateIdentifier: "candidate-1",
      testIdentifier: "test-2",
      environmentIdentifier: "practice",
    };
    const session = createItemSession(doc, undefined, { context });
    context.environmentIdentifier = "mutated";
    expect(session.serialize().templateValues?.ENVIRONMENT).toBe("practice");
    const saved = session.serialize();
    const restored = createItemSession(doc, saved);
    if (saved.builtInVariables) saved.builtInVariables.context.environmentIdentifier = "changed";
    expect(restored.score().outcomes.CONTEXT).toEqual({
      ...context,
      environmentIdentifier: "practice",
    });
    expect(createItemSession(doc).score().outcomes.CONTEXT).toEqual({
      candidateIdentifier: "",
      testIdentifier: "",
      environmentIdentifier: "",
    });
  });

  it("accumulates float seconds, excludes suspension, and resumes from persisted elapsed time", () => {
    let milliseconds = 1000;
    const doc = document();
    const options = { now: () => milliseconds };
    const session = createItemSession(doc, undefined, options);
    session.beginAttempt();
    milliseconds += 1250.9;
    session.setStatus("suspended");
    expect(session.serialize().builtInVariables?.duration).toBeCloseTo(1.2509, 8);
    milliseconds += 10_000;
    const restored = createItemSession(doc, session.serialize(), options);
    milliseconds += 5000;
    restored.setStatus("interacting");
    milliseconds += 750;
    expect(restored.score().outcomes).toMatchObject({ SCORE: 2, COUNT: 1 });
    restored.setStatus("completed");
    milliseconds += 1000;
    expect(restored.serialize().builtInVariables?.duration).toBeCloseTo(2.0009, 8);
  });

  it("accepts trusted elapsed seconds for server scoring and diagnoses unavailable/invalid time", () => {
    const scored = scoreQtiItemServerSide({
      itemXml: item(),
      trustedResponses: { R: "answer" },
      sessionEnvironment: { duration: 3.5, context: { environmentIdentifier: "exam" } },
    });
    expect(scored.ok).toBe(true);
    expect(scored.score).toBe(3.5);
    expect(scored.state?.templateValues?.ENVIRONMENT).toBe("exam");
    const missing = createItemSession(document()).score();
    expect(missing.outcomes.SCORE).toBeNull();
    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.duration.unavailable" }),
    );
    for (const duration of [-1, NaN, Infinity]) {
      expect(
        createItemSession(document(), undefined, { duration }).score().diagnostics,
      ).toContainEqual(expect.objectContaining({ code: "session.duration.invalid" }));
    }
  });

  it("retains fractional milliseconds across repeated suspended candidate sessions", () => {
    let time = 0;
    const doc = document();
    const options = { now: () => time };
    let session = createItemSession(doc, undefined, options);
    for (let candidateSession = 0; candidateSession < 5; candidateSession += 1) {
      session.beginAttempt();
      time += 250.9;
      session.setStatus("suspended");
      session = createItemSession(doc, session.serialize(), options);
    }
    session.beginAttempt();
    expect(session.score().outcomes).toMatchObject({ SCORE: 1.254, COUNT: 1 });
  });

  it("counts submitted responses before a scoring host closes the item", () => {
    const result = scoreQtiItemServerSide({
      itemXml: item(false),
      trustedResponses: { R: "answer" },
      status: "completed",
    });
    expect(result.ok).toBe(true);
    expect(result.state?.status).toBe("completed");
    expect(result.outcomes).toMatchObject({ COUNT: 1, STATUS: "unknown" });
    expect(result.state?.builtInVariables).toMatchObject({
      numAttempts: 1,
      attemptInProgress: false,
    });
  });

  it("diagnoses a clock that moves backwards", () => {
    let time = 1000;
    const session = createItemSession(document(), undefined, { now: () => time });
    time = 500;
    expect(session.score().diagnostics).toContainEqual(
      expect.objectContaining({ code: "session.duration.invalid" }),
    );
  });

  it("rejects non-timed duration references and explicit declarations of reserved variables", () => {
    expect(
      parseQtiXml(item().replace('time-dependent="true"', 'time-dependent="false"')).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "processing.variable.reference" }));
    for (const identifier of ["numAttempts", "duration", "QTI_CONTEXT"]) {
      expect(
        parseQtiXml(
          item(false).replace(
            'identifier="R" cardinality=',
            `identifier="${identifier}" cardinality=`,
          ),
        ).diagnostics,
      ).toContainEqual(expect.objectContaining({ code: "declaration.builtIn" }));
    }
  });

  it("validates built-in state and isolates restored records", () => {
    const saved = createItemSession(document(false)).serialize();
    expect(isQtiAttemptStateV1(saved)).toBe(true);
    for (const patch of [
      { numAttempts: -1 },
      { numAttempts: 1.5 },
      { duration: Infinity },
      { duration: -1 },
      { attemptInProgress: true },
      { context: { environmentIdentifier: 2 } },
    ]) {
      expect(
        isQtiAttemptStateV1({
          ...saved,
          builtInVariables: { ...saved.builtInVariables, ...patch },
        }),
      ).toBe(false);
    }
  });
});
