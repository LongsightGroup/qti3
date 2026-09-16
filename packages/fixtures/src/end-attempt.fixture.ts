import type { QtiFixture } from "./index.js";

/** Synthetic MIT-licensed adaptive item: requesting help is independent of answering. */
export function createEndAttemptFixture(): QtiFixture {
  const id = "endAttempt-reference";
  return {
    id,
    category: "interaction",
    interactionType: "endAttempt",
    qtiName: "qti-end-attempt-interaction",
    title: "Planning hint with a separately scored answer",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" adaptive="true" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HINT" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>A coastal town has replaced a wetland with paved parking. After storms with similar rainfall, more water now reaches the streets and flooding occurs more often. Choose the explanation best supported by these observations. You may request a planning hint before answering.</p>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1">
      <qti-prompt>Which explanation best accounts for the increased flooding?</qti-prompt>
      <qti-simple-choice identifier="A">Replacing the wetland with pavement reduced water absorption and increased runoff into the streets.</qti-simple-choice>
      <qti-simple-choice identifier="B">The town's storms must now produce more rain, even though the measured rainfall is similar.</qti-simple-choice>
      <qti-simple-choice identifier="C">Pavement absorbs more water than wetland soil, so less water reaches the streets.</qti-simple-choice>
    </qti-choice-interaction>
    <p><qti-end-attempt-interaction response-identifier="HINT" title="Show planning hint"/></p>
    <qti-feedback-block identifier="PLANNING_HINT" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Compare how wetland soil and pavement absorb rainfall, then trace where the remaining water flows.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="HINT"/>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">PLANNING_HINT</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus"><qti-base-value base-type="identifier">completed</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus"><qti-base-value base-type="identifier">incomplete</qti-base-value></qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "answer-after-hint",
        responses: { HINT: true, RESPONSE: "A" },
        expectedResponses: { HINT: true, RESPONSE: "A" },
        expectedOutcomes: { SCORE: 1, FEEDBACK: "PLANNING_HINT", completionStatus: "completed" },
        expectedState: { status: "completed" },
      },
      {
        name: "hint-alone-earns-no-credit",
        responses: { HINT: true },
        expectedResponses: { HINT: true },
        expectedOutcomes: { SCORE: 0, FEEDBACK: "PLANNING_HINT", completionStatus: "incomplete" },
        expectedState: { status: "interacting" },
      },
      {
        name: "incorrect-answer-with-hint",
        responses: { HINT: true, RESPONSE: "B" },
        expectedOutcomes: { SCORE: 0, FEEDBACK: "PLANNING_HINT", completionStatus: "incomplete" },
        expectedState: { status: "interacting" },
      },
      {
        name: "correct-answer-without-hint",
        responses: { RESPONSE: "A" },
        expectedOutcomes: { SCORE: 1, FEEDBACK: null, completionStatus: "completed" },
        expectedState: { status: "completed" },
      },
    ],
  };
}
