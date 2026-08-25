import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, visibleModalFeedback } from "./index.js";

describe("response processing", () => {
  it("diagnoses unsupported and response-processing-forbidden processing elements", () => {
    const unsupported = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-processing" title="unsupported-processing" time-dependent="false">
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body><p>Unsupported processing expression.</p></qti-item-body>
        <qti-response-processing>
          <qti-set-outcome-value identifier="SCORE">
            <qti-unsupported-expression/>
          </qti-set-outcome-value>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(unsupported.ok).toBe(false);
    expect(unsupported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "processing.unsupported",
        message:
          "qti-unsupported-expression is not currently supported as a QTI processing element.",
        path: "/qti-assessment-item/qti-response-processing[1]/qti-set-outcome-value[1]/qti-unsupported-expression[1]",
      }),
    );

    const forbidden = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="forbidden-response-processing" title="forbidden-response-processing" time-dependent="false">
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body><p>Forbidden processing expression.</p></qti-item-body>
        <qti-response-processing>
          <qti-set-outcome-value identifier="SCORE">
            <qti-outcome-minimum/>
          </qti-set-outcome-value>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(forbidden.ok).toBe(false);
    for (const name of [
      "qti-number-correct",
      "qti-number-incorrect",
      "qti-number-presented",
      "qti-number-responded",
      "qti-number-selected",
      "qti-outcome-minimum",
      "qti-outcome-maximum",
      "qti-test-variables",
    ] as const) {
      const result = parseQtiXml(`
        <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${name}" title="${name}" time-dependent="false">
          <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
          <qti-item-body><p>Forbidden processing expression.</p></qti-item-body>
          <qti-response-processing>
            <qti-set-outcome-value identifier="SCORE"><${name}/></qti-set-outcome-value>
          </qti-response-processing>
        </qti-assessment-item>
      `);

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "processing.response.forbidden",
          message: `${name} must not be used in qti-response-processing.`,
        }),
      );
    }
    expect(forbidden.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "processing.response.forbidden",
        message: "qti-outcome-minimum must not be used in qti-response-processing.",
        path: "/qti-assessment-item/qti-response-processing[1]/qti-set-outcome-value[1]/qti-outcome-minimum[1]",
      }),
    );
  });

  it("diagnoses unsupported response-processing templates", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-template" title="unsupported-template" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://example.invalid/not_map_response"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "processing.template.unsupported",
        severity: "error",
      }),
    );
  });

  it("requires bound end-attempt interactions to use a single boolean response", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="end-attempt-shape" title="end-attempt-shape" time-dependent="false">
        <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
        <qti-response-declaration identifier="WRONG" cardinality="multiple" base-type="identifier"/>
        <qti-item-body>
          <qti-end-attempt-interaction response-identifier="END" title="Show hint"/>
          <qti-end-attempt-interaction response-identifier="WRONG" title="Finish"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.cardinality",
          message: "qti-end-attempt-interaction expects single cardinality, got multiple.",
        }),
        expect.objectContaining({
          code: "interaction.baseType",
          message: "qti-end-attempt-interaction expects boolean base type, got identifier.",
        }),
      ]),
    );
  });

  it("validates processing rule targets and variable references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-processing-refs" title="bad-processing-refs" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-template-declaration identifier="TEMPLATE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value identifier="MISSING_TEMPLATE">
            <qti-variable identifier="MISSING_VARIABLE"/>
          </qti-set-template-value>
          <qti-set-correct-response identifier="MISSING_RESPONSE">
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-is-null>
                <qti-variable identifier="MISSING_VARIABLE"/>
              </qti-is-null>
              <qti-set-outcome-value identifier="MISSING_OUTCOME">
                <qti-map-response identifier="MISSING_RESPONSE"/>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.templateTarget.reference" }),
        expect.objectContaining({ code: "processing.correctResponse.reference" }),
        expect.objectContaining({ code: "processing.outcomeTarget.reference" }),
        expect.objectContaining({ code: "processing.variable.reference" }),
        expect.objectContaining({ code: "processing.response.reference" }),
      ]),
    );
  });

  it("does not mask missing processing identifiers with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-processing-ids" title="missing-processing-ids" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-template-declaration identifier="TEMPLATE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value>
            <qti-base-value base-type="integer">1</qti-base-value>
          </qti-set-template-value>
          <qti-set-correct-response>
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable/>
                <qti-correct/>
              </qti-match>
              <qti-set-outcome-value>
                <qti-map-response/>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else-if>
              <qti-variable/>
            </qti-response-else-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    const templateRule = result.document?.item.templateProcessing?.rules[0];
    expect(templateRule?.type).toBe("setTemplateValue");
    expect(templateRule?.type === "setTemplateValue" ? templateRule.identifier : undefined).toBe(
      "",
    );
    const responseRule = result.document?.item.responseProcessing?.conditions[0]?.thenRules[0];
    expect(responseRule?.type).toBe("setOutcomeValue");
    expect(responseRule?.type === "setOutcomeValue" ? responseRule.identifier : undefined).toBe("");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.templateTarget" }),
        expect.objectContaining({ code: "processing.correctResponse" }),
        expect.objectContaining({ code: "processing.outcomeTarget" }),
        expect.objectContaining({ code: "processing.variable" }),
        expect.objectContaining({ code: "processing.response" }),
        expect.objectContaining({ code: "processing.correct" }),
      ]),
    );
  });

  it("parses, validates, and resolves modal feedback", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback" title="feedback" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
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
              <qti-set-outcome-value identifier="FEEDBACK">
                <qti-base-value base-type="identifier">correct</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="FEEDBACK">
                <qti-base-value base-type="identifier">incorrect</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
        <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">
          Correct feedback.
        </qti-modal-feedback>
        <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="incorrect" show-hide="show">
          Incorrect feedback.
        </qti-modal-feedback>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.modalFeedback).toHaveLength(2);

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "A");
    const scored = session.score();
    expect(scored.outcomes.FEEDBACK).toBe("correct");
    expect(visibleModalFeedback(result.document!.item, scored.outcomes)).toMatchObject([
      { identifier: "correct", text: "Correct feedback." },
    ]);
  });

  it("evaluates response else-if branches before the final else", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="else-if" title="else-if" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="C">C</qti-simple-choice>
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
            </qti-response-if>
            <qti-response-else-if>
              <qti-equal>
                <qti-variable identifier="RESPONSE"/>
                <qti-base-value base-type="identifier">B</qti-base-value>
              </qti-equal>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0.5</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.responseProcessing?.conditions[0]?.elseIfs).toHaveLength(1);

    const partial = createItemSession(result.document!);
    partial.respond("RESPONSE", "B");
    expect(partial.score().outcomes.SCORE).toBe(0.5);

    const incorrect = createItemSession(result.document!);
    incorrect.respond("RESPONSE", "C");
    expect(incorrect.score().outcomes.SCORE).toBe(0);
  });

  it("resolves outcome variables during cumulative response processing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="cumulative" title="cumulative" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="A" mapped-value="1"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-response-declaration identifier="RESPONSE2" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="B" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE1">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
          <qti-choice-interaction response-identifier="RESPONSE2">
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-not><qti-is-null><qti-variable identifier="RESPONSE1"/></qti-is-null></qti-not>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-variable identifier="SCORE"/>
                  <qti-map-response identifier="RESPONSE1"/>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
          <qti-response-condition>
            <qti-response-if>
              <qti-not><qti-is-null><qti-variable identifier="RESPONSE2"/></qti-is-null></qti-not>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-variable identifier="SCORE"/>
                  <qti-map-response identifier="RESPONSE2"/>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE1", "A");
    session.respond("RESPONSE2", "B");
    expect(session.score().outcomes.SCORE).toBe(3);
    expect(session.score().outcomes.SCORE).toBe(3);
  });

  it("validates modal feedback outcome references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-invalid" title="feedback-invalid" time-dependent="false">
        <qti-item-body>
          <p>No interaction.</p>
        </qti-item-body>
        <qti-modal-feedback outcome-identifier="MISSING" identifier="shown">Shown</qti-modal-feedback>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "feedback.outcomeIdentifier.reference" }),
    );
  });

  it("honors response-processing fragments and exit-response rules", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="exit-response" title="exit-response" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="TRACE" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-processing-fragment>
            <qti-response-condition>
              <qti-response-if>
                <qti-base-value base-type="boolean">true</qti-base-value>
                <qti-response-processing-fragment>
                  <qti-set-outcome-value identifier="SCORE">
                    <qti-base-value base-type="float">1</qti-base-value>
                  </qti-set-outcome-value>
                  <qti-exit-response/>
                  <qti-set-outcome-value identifier="TRACE">
                    <qti-base-value base-type="integer">99</qti-base-value>
                  </qti-set-outcome-value>
                </qti-response-processing-fragment>
              </qti-response-if>
            </qti-response-condition>
          </qti-response-processing-fragment>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">2</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.SCORE).toBe(1);
    expect(score.outcomes.TRACE).toBe(0);
  });
});
