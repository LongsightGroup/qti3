import { describe, expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  prepareQtiDeliveryXml,
} from "./index.js";
import { adaptiveTemplatePresentationItemXml } from "./trusted-item.fixtures.js";

function cloneDocument() {
  const parsed =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="random-clone" title="Random clone" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
    <qti-response-declaration identifier="DEFAULT" cardinality="single" base-type="integer"/>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    <qti-outcome-declaration identifier="INITIAL" cardinality="single" base-type="integer"/>
    <qti-template-processing>
      <qti-set-correct-response identifier="RESPONSE"><qti-random-integer min="1" max="1000000"/></qti-set-correct-response>
      <qti-set-default-value identifier="DEFAULT"><qti-random-integer min="1" max="1000000"/></qti-set-default-value>
      <qti-set-default-value identifier="INITIAL"><qti-random-integer min="1" max="1000000"/></qti-set-default-value>
    </qti-template-processing>
    <qti-item-body><qti-text-entry-interaction response-identifier="RESPONSE"/></qti-item-body>
    <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
  </qti-assessment-item>`);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.ok).toBe(true);
  if (!parsed.document) throw new Error("Expected clone document");
  return parsed.document;
}

describe("restoring generated template clones", () => {
  it("preserves generation metadata when candidate-safe XML has no template processing", () => {
    const xml = adaptiveTemplatePresentationItemXml();
    const original = parseQtiXml(xml);
    if (!original.document) throw new Error("Expected original document");
    const session = createItemSession(original.document, undefined, { randomSeed: "delivery" });
    const state = session.serialize();
    const delivery = prepareQtiDeliveryXml(xml, {
      mode: "server-materialized-adaptive",
      outcomes: state.outcomes,
      templateValues: state.templateValues ?? {},
    });
    expect(delivery.ok).toBe(true);
    if (!delivery.candidateSafeXml) throw new Error("Expected candidate-safe XML");
    const candidate = parseQtiXml(delivery.candidateSafeXml);
    if (!candidate.document) throw new Error("Expected candidate document");
    expect(candidate.document.item.templateProcessing).toBeUndefined();
    const saved = createItemSession(candidate.document, state).serialize();
    expect(saved.templateProcessing).toEqual(state.templateProcessing);
    expect(saved.templateValues).toEqual(state.templateValues);
    expect(createItemSession(original.document, saved).correctResponses()).toEqual(
      session.correctResponses(),
    );
  });

  it("replays with generation-time built-ins while response processing sees the current environment", () => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="environment-clone" title="Environment clone" time-dependent="true">
      <qti-response-declaration identifier="R" cardinality="single" base-type="string"/>
      <qti-response-declaration identifier="D" cardinality="single" base-type="float"/>
      <qti-outcome-declaration identifier="NOW" cardinality="single" base-type="float"/>
      <qti-outcome-declaration identifier="ENV" cardinality="single" base-type="string"/>
      <qti-template-declaration identifier="COUNT" cardinality="single" base-type="integer"/>
      <qti-template-processing>
        <qti-set-correct-response identifier="R"><qti-field-value field-identifier="environmentIdentifier"><qti-variable identifier="QTI_CONTEXT"/></qti-field-value></qti-set-correct-response>
        <qti-set-default-value identifier="D"><qti-variable identifier="duration"/></qti-set-default-value>
        <qti-set-template-value identifier="COUNT"><qti-variable identifier="numAttempts"/></qti-set-template-value>
      </qti-template-processing>
      <qti-item-body><p>Environment clone.</p></qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="NOW"><qti-variable identifier="duration"/></qti-set-outcome-value>
        <qti-set-outcome-value identifier="ENV"><qti-field-value field-identifier="environmentIdentifier"><qti-variable identifier="QTI_CONTEXT"/></qti-field-value></qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>`);
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Expected environment clone");
    const original = createItemSession(parsed.document, undefined, {
      duration: 3.5,
      context: { environmentIdentifier: "initial" },
    });
    original.respond("R", "initial");
    original.score();
    const restored = createItemSession(parsed.document, original.serialize(), {
      duration: 99,
      context: { environmentIdentifier: "current" },
    });
    expect(restored.correctResponses().R).toBe("initial");
    expect(restored.presentationResponse("D")).toBe(3.5);
    expect(restored.serialize().templateValues?.COUNT).toBe(0);
    expect(restored.score().outcomes).toMatchObject({ NOW: 99, ENV: "current" });
  });

  it.each([undefined, "custom-seed", 173])(
    "preserves direct randomized answers and defaults across repeated restores (seed %s)",
    (randomSeed) => {
      const document = cloneDocument();
      const original = createItemSession(document, undefined, { randomSeed });
      const correct = original.correctResponses();
      const responseDefault = original.presentationResponse("DEFAULT");
      const initialOutcome = original.serialize().outcomes.INITIAL;
      let state = original.serialize();
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const restored = createItemSession(document, state, { randomSeed: "different" });
        expect(restored.correctResponses()).toEqual(correct);
        expect(restored.presentationResponse("DEFAULT")).toBe(responseDefault);
        restored.respond("RESPONSE", correct.RESPONSE ?? null);
        expect(restored.score().outcomes).toMatchObject({ SCORE: 1, INITIAL: initialOutcome });
        state = restored.serialize();
      }
    },
  );

  it("does not serialize generated answer keys or declaration defaults", () => {
    const session = createItemSession(cloneDocument(), undefined, { randomSeed: "private-clone" });
    const state = session.serialize();
    expect(isQtiAttemptStateV1(state)).toBe(true);
    expect(state).not.toHaveProperty("correctResponses");
    expect(state).not.toHaveProperty("responseDefaults");
    expect(state.responses).toEqual({});
  });

  it.each([{ numAttempts: -1 }, { duration: Infinity }, { context: {} }])(
    "rejects malformed generation environment fields: %j",
    (patch) => {
      const state = createItemSession(cloneDocument()).serialize();
      const generation = state.templateProcessing;
      if (!generation) throw new Error("Expected generation metadata");
      expect(
        isQtiAttemptStateV1({
          ...state,
          templateProcessing: {
            ...generation,
            environment: { ...generation.environment, ...patch },
          },
        }),
      ).toBe(false);
    },
  );

  it("rejects missing clone generation metadata instead of inventing a replacement clone", () => {
    const document = cloneDocument();
    const state = createItemSession(document).serialize();
    const { templateProcessing: _templateProcessing, ...missing } = state;
    expect(() => createItemSession(document, missing)).toThrow("template generation");
  });

  it.each([
    null,
    {},
    { schema: "unknown", seed: "seed" },
    { schema: "qti3.template-processing.v1", seed: NaN },
    { schema: "qti3.template-processing.v1", seed: {} },
  ])("rejects malformed generation metadata at the state boundary: %j", (templateProcessing) => {
    const state = createItemSession(cloneDocument()).serialize();
    expect(isQtiAttemptStateV1({ ...state, templateProcessing })).toBe(false);
  });
});
