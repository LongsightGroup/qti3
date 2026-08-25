import { describe, expect, it } from "vitest";
import {
  assertQtiAttemptStateV1,
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
} from "./index.js";

describe("core session state", () => {
  it("parses and scores a choice item", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-prompt>Who was the first president?</qti-prompt>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">Washington</qti-simple-choice>
            <qti-simple-choice identifier="B">Adams</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.prompt).toBe("Who was the first president?");
    expect(result.document?.item.interactions[0]?.type).toBe("choice");
    expect(result.document?.item.interactions[0]?.prompt).toBeUndefined();

    const session = createItemSession(result.document!);
    expect(session.serialize().status).toBe("initialized");
    session.respond("RESPONSE", "A");
    expect(session.serialize().status).toBe("interacting");
    expect(session.score().outcomes.SCORE).toBe(1);
    expect(session.serialize().schema).toBe("qti3.attempt-state.v1");
    session.setStatus("suspended");
    expect(session.serialize().status).toBe("suspended");

    const restored = createItemSession(result.document!, session.serialize());
    expect(restored.serialize().status).toBe("suspended");
  });

  it("keeps serialized attempt state detached from live session internals", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="state-contract" title="state-contract" time-dependent="false">
        <qti-response-declaration identifier="ORDER" cardinality="ordered" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="LIST" cardinality="ordered" base-type="identifier"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="ORDER">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-order-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-set-outcome-value identifier="LIST">
            <qti-ordered>
              <qti-base-value base-type="identifier">A</qti-base-value>
              <qti-base-value base-type="identifier">B</qti-base-value>
            </qti-ordered>
          </qti-set-outcome-value>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const response = ["A", "B"];
    session.respond("ORDER", response);
    response[0] = "B";
    expect(session.serialize().responses.ORDER).toEqual(["A", "B"]);

    const serialized = session.serialize();
    (serialized.responses.ORDER as string[])[0] = "B";
    expect(session.serialize().responses.ORDER).toEqual(["A", "B"]);

    const priorState = session.serialize();
    const restored = createItemSession(result.document!, priorState);
    (priorState.responses.ORDER as string[])[1] = "A";
    expect(restored.serialize().responses.ORDER).toEqual(["A", "B"]);

    const scored = session.score();
    (scored.outcomes.LIST as string[])[0] = "B";
    expect(session.serialize().outcomes.LIST).toEqual(["A", "B"]);
  });

  it("preserves restored validation messages until the attempt changes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="validation-state" title="validation-state" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const state = createItemSession(result.document!).serialize();
    state.validationMessages = [
      {
        code: "response.required",
        severity: "error",
        message: "RESPONSE requires a response.",
        path: "RESPONSE",
        source: { line: 1, column: 2, offset: 3, path: "/qti-assessment-item" },
      },
    ];

    const restored = createItemSession(result.document!, state);
    expect(restored.serialize().validationMessages).toEqual(state.validationMessages);

    state.validationMessages[0]!.message = "mutated";
    state.validationMessages[0]!.source!.line = 99;
    expect(restored.serialize().validationMessages[0]).toMatchObject({
      message: "RESPONSE requires a response.",
      source: { line: 1 },
    });

    const restoredState = restored.serialize();
    restoredState.validationMessages[0]!.message = "mutated serialized snapshot";
    restoredState.validationMessages[0]!.source!.line = 101;
    expect(restored.serialize().validationMessages[0]).toMatchObject({
      message: "RESPONSE requires a response.",
      source: { line: 1 },
    });

    restored.respond("RESPONSE", "A");
    expect(restored.serialize().validationMessages).toEqual([]);
  });

  it("rejects incompatible restored attempt state", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="state-target" title="state-target" time-dependent="false">
        <qti-template-declaration identifier="TEMPLATE" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body><p>State target.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const state = createItemSession(result.document!).serialize();
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        schema: "qti3.attempt-state.v0" as "qti3.attempt-state.v1",
      }),
    ).toThrow("Unsupported QTI attempt state schema qti3.attempt-state.v0.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        itemIdentifier: "other-item",
      }),
    ).toThrow("Cannot restore state for other-item into state-target.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        responses: { UNKNOWN_RESPONSE: "A" },
      }),
    ).toThrow("Cannot restore unknown response identifier UNKNOWN_RESPONSE.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        outcomes: { UNKNOWN_OUTCOME: 1 },
      }),
    ).toThrow("Cannot restore unknown outcome identifier UNKNOWN_OUTCOME.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        templateValues: { UNKNOWN_TEMPLATE: 1 },
      }),
    ).toThrow("Cannot restore unknown template identifier UNKNOWN_TEMPLATE.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        validationMessages: [
          {
            code: "response.required",
            severity: "error",
            message: "Unknown response requires a response.",
            path: "UNKNOWN_RESPONSE",
          },
        ],
      }),
    ).toThrow("Cannot restore validation message for unknown response UNKNOWN_RESPONSE.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        outcomes: { completionStatus: "finished" },
      }),
    ).toThrow("Cannot restore unsupported completionStatus finished.");
  });

  it("rejects restored state values that do not match declarations", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="state-value-shape" title="state-value-shape" time-dependent="false">
        <qti-template-declaration identifier="COUNT" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier"/>
        <qti-response-declaration identifier="ORDER" cardinality="ordered" base-type="identifier"/>
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="CHOICE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const state = createItemSession(result.document!).serialize();
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        responses: { CHOICE: ["A"] },
      }),
    ).toThrow("Cannot restore response CHOICE: expected single value.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        responses: { ORDER: "A" },
      }),
    ).toThrow("Cannot restore response ORDER: expected ordered value container.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        responses: { POINT: "10" },
      }),
    ).toThrow("Cannot restore response POINT: value 10 is not valid for base-type point.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        outcomes: { SCORE: "high" },
      }),
    ).toThrow("Cannot restore outcome SCORE: value high is not valid for base-type float.");
    expect(() =>
      createItemSession(result.document!, {
        ...state,
        templateValues: { COUNT: "many" },
      }),
    ).toThrow("Cannot restore template COUNT: value many is not valid for base-type integer.");
  });

  it("exposes a runtime guard for the public attempt state contract", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="state-guard" title="state-guard" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body><p>State guard.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const state = createItemSession(result.document!).serialize();
    expect(isQtiAttemptStateV1(state)).toBe(true);
    expect(() => assertQtiAttemptStateV1(state)).not.toThrow();

    const badStatus = { ...state, status: "reviewing" };
    expect(isQtiAttemptStateV1(badStatus)).toBe(false);
    expect(() => createItemSession(result.document!, badStatus as never)).toThrow(
      "QTI attempt state status reviewing is not supported.",
    );

    const badResponses = { ...state, responses: { RESPONSE: Number.NaN } };
    expect(isQtiAttemptStateV1(badResponses)).toBe(false);
    expect(() => assertQtiAttemptStateV1(badResponses)).toThrow(
      "QTI attempt state responses must be a record of QTI values.",
    );

    const badDiagnostics = { ...state, validationMessages: [{ code: "x", severity: "fatal" }] };
    expect(isQtiAttemptStateV1(badDiagnostics)).toBe(false);
    expect(() => assertQtiAttemptStateV1(badDiagnostics)).toThrow(
      "QTI attempt state validationMessages must be an array of diagnostics.",
    );
  });

  it("restores opaque portable custom interaction state", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci-state" title="pci-state" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-portable-custom-interaction
            response-identifier="RESPONSE"
            custom-interaction-type-identifier="urn:qti3:fixture:portable-custom"
            module="fixture-portable-custom"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "A");
    session.setInteractionState("RESPONSE", { selected: ["A"], cursor: 2 });
    const state = session.serialize();
    expect(state.interactionStates?.RESPONSE).toEqual({ selected: ["A"], cursor: 2 });

    (state.interactionStates!.RESPONSE as { selected: string[] }).selected[0] = "mutated";
    expect(session.interactionState("RESPONSE")).toEqual({ selected: ["A"], cursor: 2 });

    const restored = createItemSession(result.document!, session.serialize());
    expect(restored.serialize().interactionStates?.RESPONSE).toEqual({
      selected: ["A"],
      cursor: 2,
    });
  });

  it("keeps ordered cardinality order-sensitive", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order" title="order" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-order-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", ["B", "A"]);
    expect(session.score().outcomes.SCORE).toBe(0);
    session.respond("RESPONSE", ["A", "B"]);
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("tracks built-in completionStatus and adaptive outcome retention", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive" adaptive="true" title="adaptive" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="TRACE" cardinality="single" base-type="identifier">
          <qti-default-value><qti-value>start</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable identifier="RESPONSE"/>
                <qti-correct identifier="RESPONSE"/>
              </qti-match>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">1</qti-base-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="completionStatus">
                <qti-base-value base-type="identifier">completed</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="TRACE">
                <qti-base-value base-type="identifier">wrong-first</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    expect(session.serialize().outcomes.completionStatus).toBe("not_attempted");

    session.respond("RESPONSE", "B");
    expect(session.serialize().outcomes.completionStatus).toBe("unknown");
    expect(session.score().outcomes).toMatchObject({
      SCORE: 0,
      TRACE: "wrong-first",
      completionStatus: "unknown",
    });

    session.respond("RESPONSE", "A");
    const scored = session.score();
    expect(scored.outcomes).toMatchObject({
      SCORE: 1,
      TRACE: "wrong-first",
      completionStatus: "completed",
    });
    expect(scored.state.status).toBe("completed");
  });

  it("rejects explicit declarations for built-in completionStatus", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-completion" title="bad-completion" time-dependent="false">
        <qti-outcome-declaration identifier="completionStatus" cardinality="single" base-type="identifier"/>
        <qti-item-body><p>Bad item.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "declaration.outcome.builtIn" })]),
    );
  });
});
