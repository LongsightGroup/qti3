import {
  interactionSupport,
  qtiScalarToString,
  qtiValueToString,
  type QtiAttemptStateV1,
  type QtiDiagnostic,
  type QtiInteractionType,
  type QtiValue,
} from "@longsightgroup/qti3-core";

export interface QtiExpectedDiagnostic {
  code: string;
  severity?: QtiDiagnostic["severity"] | undefined;
  path?: string | undefined;
}

export interface QtiFixtureAttempt {
  name: string;
  responses: Record<string, QtiValue>;
  expectedOutcomes: Record<string, QtiValue>;
  expectedResponses?: Record<string, QtiValue> | undefined;
  expectedState?: Partial<QtiAttemptStateV1> | undefined;
}

export interface QtiFixture {
  id: string;
  category: "interaction" | "processing" | "adaptive" | "basic" | "tolerance";
  interactionType?: QtiInteractionType | undefined;
  qtiName?: string | undefined;
  title: string;
  xml: string;
  expectedParseDiagnostics: QtiExpectedDiagnostic[];
  expectedValidationDiagnostics: QtiExpectedDiagnostic[];
  attempts: QtiFixtureAttempt[];
}

const silentWavDataUri =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

export const interactionFixtures: QtiFixture[] = interactionSupport.map((support) =>
  createInteractionFixture(support.interactionType, support.qtiName),
);

export const processingFixtures: QtiFixture[] = [
  createMappingProcessingFixture(),
  createGenericMatchProcessingFixture(),
  createTemplateProcessingFixture(),
  createTemplateContentFixture(),
  createAdvancedProcessingFixture(),
];

export const adaptiveFixtures: QtiFixture[] = [createAdaptiveFeedbackFixture()];

export const basicItemPlayerFixtures: QtiFixture[] = [
  createBasicHtmlSubsetFixture(),
  createBasicTemplateResponseProcessingFixture(),
  createBasicCompositeItemFixture(),
  createBasicMathMlFixture(),
  createBasicSharedVocabularyFixture(),
  createBasicAltTextFixture(),
];

export const basicItemPlayerToleranceFixtures: QtiFixture[] = [
  createBasicExtraItemFeatureToleranceFixture(),
  createBasicModalFeedbackToleranceFixture(),
];

export const canonicalFixtures: QtiFixture[] = [
  ...interactionFixtures,
  ...processingFixtures,
  ...adaptiveFixtures,
];

export function getFixtureById(id: string): QtiFixture | undefined {
  return canonicalFixtures.find((fixture) => fixture.id === id);
}

function createInteractionFixture(
  interactionType: QtiInteractionType,
  qtiName: string,
): QtiFixture {
  if (interactionType === "inlineChoice") return createInlineChoiceFixture(qtiName);

  const id = `${interactionType}-reference`;
  const response = defaultResponse(interactionType);
  const body = renderInteractionXml(qtiName, interactionType);
  const hasAttemptResponse = Boolean(response.identifier && response.correct !== null);

  return {
    id,
    category: "interaction",
    interactionType,
    qtiName,
    title: `${interactionType} reference fixture`,
    xml: assessmentItem(id, response, body),
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "correct",
        responses: hasAttemptResponse ? { [response.identifier!]: response.correct } : {},
        expectedOutcomes: hasAttemptResponse ? { SCORE: 1 } : { SCORE: 0 },
        expectedResponses: hasAttemptResponse ? { [response.identifier!]: response.correct } : {},
        expectedState: {
          schema: "qti3.attempt-state.v1",
          itemIdentifier: id,
          status: hasAttemptResponse ? "interacting" : "initialized",
        },
      },
    ],
  };
}

function createInlineChoiceFixture(qtiName: string): QtiFixture {
  const id = "inlineChoice-reference";
  const responses = {
    RESPONSE_DECLARATION: "A",
    RESPONSE_OUTCOME: "B",
  };

  return {
    id,
    category: "interaction",
    interactionType: "inlineChoice",
    qtiName,
    title: "inlineChoice reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE_DECLARATION" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="RESPONSE_OUTCOME" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>B</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Choose QTI terms directly in the sentence.</p>
    <p>In QTI 3.0, an interaction writes a candidate answer to a <${qtiName} response-identifier="RESPONSE_DECLARATION"><qti-inline-choice identifier="A">response declaration</qti-inline-choice><qti-inline-choice identifier="B">template declaration</qti-inline-choice><qti-inline-choice identifier="C">rubric block</qti-inline-choice></${qtiName}>, and response processing writes derived values such as SCORE to an <${qtiName} response-identifier="RESPONSE_OUTCOME"><qti-inline-choice identifier="A">item body</qti-inline-choice><qti-inline-choice identifier="B">outcome declaration</qti-inline-choice><qti-inline-choice identifier="C">choice interaction</qti-inline-choice></${qtiName}>.</p>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE_DECLARATION"/>
          <qti-correct identifier="RESPONSE_DECLARATION"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-sum>
            <qti-variable identifier="SCORE"/>
            <qti-base-value base-type="float">1</qti-base-value>
          </qti-sum>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE_OUTCOME"/>
          <qti-correct identifier="RESPONSE_OUTCOME"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-sum>
            <qti-variable identifier="SCORE"/>
            <qti-base-value base-type="float">1</qti-base-value>
          </qti-sum>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "correct",
        responses,
        expectedOutcomes: { SCORE: 2 },
        expectedResponses: responses,
        expectedState: {
          schema: "qti3.attempt-state.v1",
          itemIdentifier: id,
          status: "interacting",
        },
      },
    ],
  };
}

function createMappingProcessingFixture(): QtiFixture {
  const id = "mapping-processing-reference";
  return {
    id,
    category: "processing",
    title: "Mapping response-processing reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-mapping default-value="0">
      <qti-map-entry map-key="A" mapped-value="2"/>
      <qti-map-entry map-key="B" mapped-value="1"/>
    </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Choose the best-supported scoring expression for a mapped response.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">qti-map-response</qti-simple-choice>
      <qti-simple-choice identifier="B">qti-match</qti-simple-choice>
      <qti-simple-choice identifier="C">qti-null</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "mapped",
        responses: { RESPONSE: "A" },
        expectedOutcomes: { SCORE: 2 },
        expectedResponses: { RESPONSE: "A" },
      },
    ],
  };
}

function createGenericMatchProcessingFixture(): QtiFixture {
  const id = "generic-match-processing-reference";
  return {
    id,
    category: "processing",
    title: "Generic qti-match response-processing reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Choose the expression that compares two arbitrary processing values.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">qti-match</qti-simple-choice>
      <qti-simple-choice identifier="B">qti-map-response</qti-simple-choice>
      <qti-simple-choice identifier="C">qti-random</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">matched</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">not-matched</qti-base-value></qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "matched",
        responses: { RESPONSE: "A" },
        expectedOutcomes: { SCORE: 1, FEEDBACK: "matched" },
        expectedResponses: { RESPONSE: "A" },
      },
      {
        name: "not-matched",
        responses: { RESPONSE: "B" },
        expectedOutcomes: { SCORE: 0, FEEDBACK: "not-matched" },
        expectedResponses: { RESPONSE: "B" },
      },
    ],
  };
}

function createTemplateProcessingFixture(): QtiFixture {
  const id = "template-processing-reference";
  return {
    id,
    category: "processing",
    title: "Template-processing reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-template-declaration identifier="BASE" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="ANSWER" cardinality="single" base-type="integer"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-template-processing>
    <qti-set-template-value identifier="BASE"><qti-base-value base-type="integer">2</qti-base-value></qti-set-template-value>
    <qti-set-template-value identifier="ANSWER">
      <qti-sum><qti-variable identifier="BASE"/><qti-base-value base-type="integer">3</qti-base-value></qti-sum>
    </qti-set-template-value>
    <qti-set-correct-response identifier="RESPONSE"><qti-variable identifier="ANSWER"/></qti-set-correct-response>
  </qti-template-processing>
  <qti-item-body>
    <p>Template processing generates the correct numeric response before delivery.</p>
    <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10" step="1"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "generated-correct",
        responses: { RESPONSE: 5 },
        expectedOutcomes: { SCORE: 1 },
        expectedResponses: { RESPONSE: 5 },
        expectedState: { templateValues: { BASE: 2, ANSWER: 5 } },
      },
    ],
  };
}

function createTemplateContentFixture(): QtiFixture {
  const id = "template-content-reference";
  return {
    id,
    category: "processing",
    title: "Template content and MathML variable reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-template-declaration identifier="PATH" cardinality="single" base-type="identifier"/>
  <qti-template-declaration identifier="COUNT" cardinality="single" base-type="integer" math-variable="true"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-template-processing>
    <qti-set-template-value identifier="PATH"><qti-base-value base-type="identifier">reference</qti-base-value></qti-set-template-value>
    <qti-set-template-value identifier="COUNT"><qti-base-value base-type="integer">3</qti-base-value></qti-set-template-value>
  </qti-template-processing>
  <qti-item-body>
    <qti-template-block template-identifier="PATH" identifier="reference" show-hide="show">
      <qti-content-body><p>The generated reference branch is visible.</p></qti-content-body>
    </qti-template-block>
    <qti-template-block template-identifier="PATH" identifier="distractor" show-hide="show">
      <qti-content-body><p>The distractor branch should be hidden.</p></qti-content-body>
    </qti-template-block>
    <p>The generated count appears in MathML as <math><mrow><mi>COUNT</mi><mo>+</mo><mn>1</mn></mrow></math>.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Template content is controlled by template variables.</qti-simple-choice>
      <qti-simple-choice identifier="B">Template content ignores template variables.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "correct",
        responses: { RESPONSE: "A" },
        expectedOutcomes: { SCORE: 1 },
        expectedResponses: { RESPONSE: "A" },
        expectedState: { templateValues: { PATH: "reference", COUNT: 3 } },
      },
    ],
  };
}

function createAdvancedProcessingFixture(): QtiFixture {
  const id = "advanced-processing-reference";
  return {
    id,
    category: "processing",
    title: "Advanced response-processing expression reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="ROUNDED" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="GCD_VALUE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="LCM_VALUE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="MEAN_VALUE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="REPEATED" cardinality="ordered" base-type="identifier"/>
  <qti-outcome-declaration identifier="REPEATED_SIZE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="ANY_INSIDE" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="NONE_INSIDE" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="IN_POLY" cardinality="single" base-type="boolean"/>
  <qti-item-body>
    <p>Reference fixture for advanced QTI response-processing expressions.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Run advanced response processing.</qti-simple-choice>
      <qti-simple-choice identifier="B">Do not run advanced response processing.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-match>
        <qti-set-outcome-value identifier="ROUNDED">
          <qti-equal-rounded rounding-mode="decimalPlaces" figures="2">
            <qti-base-value base-type="float">3.141</qti-base-value>
            <qti-base-value base-type="float">3.142</qti-base-value>
          </qti-equal-rounded>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="GCD_VALUE">
          <qti-gcd>
            <qti-base-value base-type="integer">24</qti-base-value>
            <qti-multiple>
              <qti-base-value base-type="integer">18</qti-base-value>
              <qti-base-value base-type="integer">30</qti-base-value>
            </qti-multiple>
          </qti-gcd>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="LCM_VALUE">
          <qti-lcm>
            <qti-base-value base-type="integer">4</qti-base-value>
            <qti-base-value base-type="integer">6</qti-base-value>
          </qti-lcm>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="MEAN_VALUE">
          <qti-stats-operator name="mean">
            <qti-multiple>
              <qti-base-value base-type="integer">2</qti-base-value>
              <qti-base-value base-type="integer">4</qti-base-value>
              <qti-base-value base-type="integer">6</qti-base-value>
            </qti-multiple>
          </qti-stats-operator>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="REPEATED">
          <qti-repeat number-repeats="2">
            <qti-base-value base-type="identifier">A</qti-base-value>
            <qti-ordered>
              <qti-base-value base-type="identifier">B</qti-base-value>
              <qti-base-value base-type="identifier">C</qti-base-value>
            </qti-ordered>
          </qti-repeat>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="REPEATED_SIZE">
          <qti-container-size>
            <qti-variable identifier="REPEATED"/>
          </qti-container-size>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="ANY_INSIDE">
          <qti-inside shape="rect" coords="10,10,20,20">
            <qti-multiple>
              <qti-base-value base-type="point">5 5</qti-base-value>
              <qti-base-value base-type="point">15 15</qti-base-value>
            </qti-multiple>
          </qti-inside>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="NONE_INSIDE">
          <qti-inside shape="circle" coords="50,50,5">
            <qti-base-value base-type="point">15 15</qti-base-value>
          </qti-inside>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="IN_POLY">
          <qti-inside shape="poly" coords="0,0,40,0,40,40,0,40">
            <qti-base-value base-type="point">12 12</qti-base-value>
          </qti-inside>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "advanced",
        responses: { RESPONSE: "A" },
        expectedOutcomes: {
          ROUNDED: true,
          GCD_VALUE: 6,
          LCM_VALUE: 12,
          MEAN_VALUE: 4,
          REPEATED: ["A", "B", "C", "A", "B", "C"],
          REPEATED_SIZE: 6,
          ANY_INSIDE: true,
          NONE_INSIDE: false,
          IN_POLY: true,
        },
        expectedResponses: { RESPONSE: "A" },
      },
    ],
  };
}

function createAdaptiveFeedbackFixture(): QtiFixture {
  const id = "adaptive-feedback-reference";
  return {
    id,
    category: "adaptive",
    title: "Adaptive feedback reference fixture",
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
    <p>Use the hint control or answer the item.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Reference implementations expose feedback through outcomes.</qti-simple-choice>
      <qti-simple-choice identifier="B">Reference implementations hide all outcomes.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="HINT" title="Show hint"/>
    <qti-feedback-block identifier="HINT_FEEDBACK" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Hint feedback is visible after the end-attempt interaction.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="HINT"/>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">HINT_FEEDBACK</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus"><qti-base-value base-type="identifier">completed</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "hint",
        responses: { HINT: true },
        expectedOutcomes: { SCORE: 0, FEEDBACK: "HINT_FEEDBACK", completionStatus: "unknown" },
        expectedResponses: { HINT: true },
        expectedState: { status: "interacting" },
      },
      {
        name: "completed",
        responses: { RESPONSE: "A" },
        expectedOutcomes: { SCORE: 1, completionStatus: "completed" },
        expectedResponses: { RESPONSE: "A" },
        expectedState: { status: "completed" },
      },
    ],
  };
}

function createBasicHtmlSubsetFixture(): QtiFixture {
  const id = "basic-html-subset";
  const image =
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2010%2010'%3E%3Crect%20width='10'%20height='10'%20fill='white'/%3E%3C/svg%3E";
  return {
    id,
    category: "basic",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic HTML subset fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <section>
      <h2>QTI item body content</h2>
      <figure>
        <img src="${image}" alt="Simple square diagram" width="10" height="10"/>
        <figcaption>Diagram caption.</figcaption>
      </figure>
      <table>
        <caption>Declaration roles</caption>
        <thead><tr><th scope="col">Declaration</th><th scope="col">Role</th></tr></thead>
        <tbody><tr><td>response</td><td>candidate answer</td></tr></tbody>
      </table>
    </section>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">The HTML subset is preserved.</qti-simple-choice>
      <qti-simple-choice identifier="B">The HTML subset is ignored.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 1 }, id)],
  };
}

function createBasicTemplateResponseProcessingFixture(): QtiFixture {
  const id = "basic-template-response-processing";
  return {
    id,
    category: "basic",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic template response processing fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-mapping default-value="0">
      <qti-map-entry map-key="A" mapped-value="2"/>
      <qti-map-entry map-key="B" mapped-value="0"/>
    </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Select the mapped response.</qti-prompt>
      <qti-simple-choice identifier="A">Mapped response</qti-simple-choice>
      <qti-simple-choice identifier="B">Default response</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 2 }, id)],
  };
}

function createBasicCompositeItemFixture(): QtiFixture {
  const id = "basic-composite-item";
  return {
    id,
    category: "basic",
    title: "Basic composite item fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="CHOICE_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="TEXT_RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response><qti-value>SCORE</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE_RESPONSE" max-choices="1">
      <qti-prompt>Which declaration stores candidate input?</qti-prompt>
      <qti-simple-choice identifier="A">Response declaration</qti-simple-choice>
      <qti-simple-choice identifier="B">Outcome declaration</qti-simple-choice>
    </qti-choice-interaction>
    <p>Type the built-in score outcome name: <qti-text-entry-interaction response-identifier="TEXT_RESPONSE" expected-length="8"/></p>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="CHOICE_RESPONSE"/>
          <qti-correct identifier="CHOICE_RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-sum>
            <qti-variable identifier="SCORE"/>
            <qti-base-value base-type="float">1</qti-base-value>
          </qti-sum>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="TEXT_RESPONSE"/>
          <qti-correct identifier="TEXT_RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-sum>
            <qti-variable identifier="SCORE"/>
            <qti-base-value base-type="float">1</qti-base-value>
          </qti-sum>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      basicCorrectAttempt({ CHOICE_RESPONSE: "A", TEXT_RESPONSE: "SCORE" }, { SCORE: 2 }, id),
    ],
  };
}

function createBasicMathMlFixture(): QtiFixture {
  const id = "basic-mathml";
  return {
    id,
    category: "basic",
    interactionType: "textEntry",
    qtiName: "qti-text-entry-interaction",
    title: "Basic MathML fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response><qti-value>4</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Solve <math><mrow><mn>2</mn><mo>+</mo><mn>2</mn></mrow></math>: <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="4"/></p>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "4" }, { SCORE: 1 }, id)],
  };
}

function createBasicSharedVocabularyFixture(): QtiFixture {
  const id = "basic-shared-vocabulary";
  return {
    id,
    category: "basic",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic shared interaction vocabulary fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p data-qti-suppress-tts="computer-read-aloud">Shared QTI vocabulary remains authored content metadata.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1" class="qti-labels-decimal qti-labels-suffix-parenthesis">
      <qti-simple-choice identifier="A">Shared vocabulary is preserved.</qti-simple-choice>
      <qti-simple-choice identifier="B">Shared vocabulary is removed.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 1 }, id)],
  };
}

function createBasicAltTextFixture(): QtiFixture {
  const id = "basic-alt-text";
  const image =
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2010'%3E%3Crect%20width='20'%20height='10'%20fill='white'/%3E%3C/svg%3E";
  return {
    id,
    category: "basic",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic image alt text fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p><img src="${image}" alt="Timeline diagram with two milestones" width="20" height="10"/></p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>What accessibility text is required for graphics?</qti-prompt>
      <qti-simple-choice identifier="A">Alternative text</qti-simple-choice>
      <qti-simple-choice identifier="B">A package title</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 1 }, id)],
  };
}

function createBasicExtraItemFeatureToleranceFixture(): QtiFixture {
  const id = "basic-extra-item-feature-tolerance";
  return {
    id,
    category: "tolerance",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic tolerance fixture with extra QTI item features",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-assessment-stimulus-ref identifier="stimulus-extra" href="../stimuli/stimulus.xml" title="Optional shared stimulus"/>
  <qti-companion-materials-info>
    <qti-digital-material label="Reference card" mime-type="text/plain">
      <qti-file-href>../materials/reference.txt</qti-file-href>
      <qti-resource-icon>../materials/reference.svg</qti-resource-icon>
    </qti-digital-material>
  </qti-companion-materials-info>
  <qti-stylesheet href="../styles/extra.css" type="text/css" media="screen"/>
  <qti-item-body>
    <qti-rubric-block view="candidate">
      <qti-content-body>
        <p>Optional rubric guidance remains visible.</p>
      </qti-content-body>
    </qti-rubric-block>
    <p data-catalog-idref="term-extra">Select the Basic response while extra item metadata is present.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Which option should score?</qti-prompt>
      <qti-simple-choice identifier="A">Supported Basic choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Unsupported extra feature</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="term-extra">
      <qti-card support="linguistic-guidance">
        <qti-html-content>Extra means beyond the Basic evidence target.</qti-html-content>
      </qti-card>
    </qti-catalog>
  </qti-catalog-info>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 1 }, id)],
  };
}

function createBasicModalFeedbackToleranceFixture(): QtiFixture {
  const id = "basic-modal-feedback-tolerance";
  return {
    id,
    category: "tolerance",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Basic tolerance fixture with extra modal feedback",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Which content path should keep working with extra feedback metadata?</qti-prompt>
      <qti-simple-choice identifier="A">Supported Basic interaction</qti-simple-choice>
      <qti-simple-choice identifier="B">Unsupported extra behavior</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">correct</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">incorrect</qti-base-value></qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
  <qti-modal-feedback identifier="correct" outcome-identifier="FEEDBACK" show-hide="show">
    <qti-content-body><p>Extra modal feedback is available.</p></qti-content-body>
  </qti-modal-feedback>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RESPONSE: "A" }, { SCORE: 1, FEEDBACK: "correct" }, id)],
  };
}

function basicCorrectAttempt(
  responses: Record<string, QtiValue>,
  expectedOutcomes: Record<string, QtiValue>,
  itemIdentifier: string,
): QtiFixtureAttempt {
  return {
    name: "correct",
    responses,
    expectedResponses: responses,
    expectedOutcomes,
    expectedState: {
      schema: "qti3.attempt-state.v1",
      itemIdentifier,
      status: "interacting",
      responses,
      outcomes: expectedOutcomes,
    },
  };
}

function assessmentItem(
  identifier: string,
  response: { identifier?: string; cardinality: string; baseType: string; correct: QtiValue },
  interactionXml: string,
): string {
  const areaMappingXml =
    response.baseType === "point"
      ? `
        <qti-area-mapping default-value="0"><qti-area-map-entry shape="circle" coords="240,88,18" mapped-value="1"/></qti-area-mapping>`
      : "";
  const responseDeclaration = response.identifier
    ? `
      <qti-response-declaration identifier="${response.identifier}" cardinality="${response.cardinality}" base-type="${response.baseType}">
        ${response.correct === null ? "" : `<qti-correct-response>${valuesXml(response.correct)}</qti-correct-response>`}${areaMappingXml}
      </qti-response-declaration>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false" xml:lang="en">
  ${responseDeclaration}
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>${itemIntro(identifier)}</p>
    ${interactionXml}
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/${response.baseType === "point" ? "map_response_point.xml" : "match_correct"}"/>
</qti-assessment-item>`;
}

function valuesXml(value: QtiValue): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => `<qti-value>${escapeXml(qtiScalarToString(item))}</qti-value>`)
      .join("");
  }
  return `<qti-value>${escapeXml(qtiValueToString(value))}</qti-value>`;
}

function defaultResponse(interactionType: QtiInteractionType): {
  identifier?: string;
  cardinality: string;
  baseType: string;
  correct: QtiValue;
} {
  if (interactionType === "media") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "integer", correct: 1 };
  }
  if (interactionType === "endAttempt") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "boolean", correct: true };
  }
  if (interactionType === "choice") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correct: "A",
    };
  }
  if (interactionType === "inlineChoice" || interactionType === "hottext") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correct: "A",
    };
  }
  if (interactionType === "order" || interactionType === "graphicOrder") {
    return {
      identifier: "RESPONSE",
      cardinality: "ordered",
      baseType: "identifier",
      correct: ["A", "B", "C"],
    };
  }
  if (interactionType === "associate") {
    return {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "pair",
      correct: ["A B"],
    };
  }
  if (interactionType === "graphicAssociate") {
    return {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "pair",
      correct: ["A B", "C D"],
    };
  }
  if (
    interactionType === "gapMatch" ||
    interactionType === "graphicGapMatch" ||
    interactionType === "match"
  ) {
    return {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "directedPair",
      correct: ["A G1", "B G2"],
    };
  }
  if (interactionType === "slider") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "integer", correct: 50 };
  }
  if (interactionType === "hotspot") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "identifier", correct: "A" };
  }
  if (interactionType === "selectPoint" || interactionType === "positionObject") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "point", correct: "240 88" };
  }
  if (interactionType === "upload") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "file",
      correct: "upload.txt",
    };
  }
  if (interactionType === "drawing") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "file",
      correct: null,
    };
  }
  if (interactionType === "textEntry") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
      correct: "SCORE",
    };
  }
  return { identifier: "RESPONSE", cardinality: "single", baseType: "string", correct: "A" };
}

function renderInteractionXml(qtiName: string, interactionType: QtiInteractionType): string {
  if (interactionType === "endAttempt") {
    return `<${qtiName} response-identifier="RESPONSE" title="Show hint"/>`;
  }
  if (interactionType === "media") {
    return `<${qtiName} response-identifier="RESPONSE" autostart="false" min-plays="1"><object data="${silentWavDataUri}" type="audio/wav">Silent WAV fixture audio</object></${qtiName}>`;
  }
  if (interactionType === "slider") {
    return `<${qtiName} response-identifier="RESPONSE" lower-bound="0" upper-bound="100" step="1"><qti-prompt>Set the response-processing share to 50 percent.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "extendedText") {
    return `<${qtiName} response-identifier="RESPONSE" expected-lines="4"><qti-prompt>Explain why a QTI item player should keep response capture separate from scoring and analytics.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "textEntry") {
    return `<p>Response processing stores the final numeric result in the outcome named <${qtiName} response-identifier="RESPONSE" expected-length="10"/>.</p>`;
  }
  if (interactionType === "order") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Put these QTI runtime steps in the usual player order.</qti-prompt><qti-simple-choice identifier="A">Load and parse the assessment item</qti-simple-choice><qti-simple-choice identifier="B">Capture the candidate response</qti-simple-choice><qti-simple-choice identifier="C">Apply response processing to produce outcomes</qti-simple-choice></${qtiName}>`;
  }
  if (interactionType === "hottext") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the phrase that names the QTI construct for storing a candidate answer.</qti-prompt><p>A <qti-hottext identifier="A">response declaration</qti-hottext> defines the variable used by an interaction. An <qti-hottext identifier="B">outcome declaration</qti-hottext> stores derived results such as SCORE. A <qti-hottext identifier="C">template declaration</qti-hottext> supports item variability before delivery.</p></${qtiName}>`;
  }
  if (interactionType === "hotspot") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the region representing response capture in the delivery flow.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/><qti-hotspot-choice identifier="A" shape="rect" coords="184,52,296,124"/><qti-hotspot-choice identifier="B" shape="rect" coords="24,52,136,124"/><qti-hotspot-choice identifier="C" shape="rect" coords="344,52,456,124"/></${qtiName}>`;
  }
  if (interactionType === "graphicOrder") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Order the visual regions from item definition to candidate response to scoring outcome.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/><qti-hotspot-choice identifier="A" hotspot-label="Item XML" shape="rect" coords="24,52,136,124"/><qti-hotspot-choice identifier="B" hotspot-label="Response capture" shape="rect" coords="184,52,296,124"/><qti-hotspot-choice identifier="C" hotspot-label="Outcomes" shape="rect" coords="184,178,296,250"/></${qtiName}>`;
  }
  if (interactionType === "graphicAssociate") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Associate each highlighted delivery-region role with its paired region.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/><qti-associable-hotspot identifier="A" hotspot-label="Item XML" shape="rect" coords="24,52,136,124" match-max="1"/><qti-associable-hotspot identifier="B" hotspot-label="Response capture" shape="rect" coords="184,52,296,124" match-max="1"/><qti-associable-hotspot identifier="C" hotspot-label="Processing rules" shape="rect" coords="344,52,456,124" match-max="1"/><qti-associable-hotspot identifier="D" hotspot-label="Outcomes" shape="rect" coords="184,178,296,250" match-max="1"/></${qtiName}>`;
  }
  if (interactionType === "selectPoint") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Mark the exact point where the candidate response enters the player pipeline.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/></${qtiName}>`;
  }
  if (interactionType === "positionObject") {
    return `<qti-position-object-stage><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/><${qtiName} response-identifier="RESPONSE"><qti-prompt>Drag the marker onto the response capture step.</qti-prompt><object data="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2048'%3E%3Crect%20x='4'%20y='4'%20width='56'%20height='40'%20rx='8'%20fill='%23fff3bf'%20stroke='%23212529'%20stroke-width='4'/%3E%3Cpath%20d='M32%2044%20L24%2058%20L40%2058%20Z'%20fill='%23fff3bf'%20stroke='%23212529'%20stroke-width='4'/%3E%3C/svg%3E" type="image/svg+xml" width="64" height="48"/></${qtiName}></qti-position-object-stage>`;
  }
  if (interactionType === "upload") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Upload a text file named upload.txt containing implementation notes.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "drawing") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Annotate the diagram by circling the response capture step.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/></${qtiName}>`;
  }
  if (interactionType === "portableCustom") {
    return `<${qtiName} response-identifier="RESPONSE" custom-interaction-type-identifier="urn:qti3:fixture:portable-custom" module="fixture-portable-custom"><qti-prompt>Use the portable custom interaction contract to return A.</qti-prompt><qti-interaction-modules primary-configuration="modules/module_resolution.js"><qti-interaction-module id="fixture-portable-custom" primary-path="modules/fixture-portable-custom"/></qti-interaction-modules><qti-interaction-markup><div class="qti3-fixture-pci-markup">Portable custom fixture markup</div></qti-interaction-markup></${qtiName}>`;
  }
  if (interactionType === "custom") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Enter the response value A.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "match" || interactionType === "associate") {
    if (interactionType === "match") {
      return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Match each QTI declaration with the thing it stores.</qti-prompt><qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">Response declaration</qti-simple-associable-choice><qti-simple-associable-choice identifier="B" match-max="1">Outcome declaration</qti-simple-associable-choice><qti-simple-associable-choice identifier="C" match-max="1">Template declaration</qti-simple-associable-choice></qti-simple-match-set><qti-simple-match-set><qti-simple-associable-choice identifier="G1" match-max="1">Candidate response value</qti-simple-associable-choice><qti-simple-associable-choice identifier="G2" match-max="1">Derived outcome or feedback state</qti-simple-associable-choice><qti-simple-associable-choice identifier="G3" match-max="1">Pre-delivery variable value</qti-simple-associable-choice></qti-simple-match-set></${qtiName}>`;
    }
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the two QTI concepts that belong together.</qti-prompt><qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">Interaction</qti-simple-associable-choice><qti-simple-associable-choice identifier="B" match-max="1">Response declaration</qti-simple-associable-choice><qti-simple-associable-choice identifier="C" match-max="1">Outcome declaration</qti-simple-associable-choice></qti-simple-match-set></${qtiName}>`;
  }
  if (interactionType === "graphicGapMatch") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Complete the diagram labels for a QTI item lifecycle.</qti-prompt><object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/><qti-gap-text identifier="A" match-max="1">response declaration</qti-gap-text><qti-gap-text identifier="B" match-max="1">outcome declaration</qti-gap-text><qti-gap-text identifier="C" match-max="1">template declaration</qti-gap-text><p>The interaction writes to a <qti-gap identifier="G1"/> and scoring writes to an <qti-gap identifier="G2"/>.</p></${qtiName}>`;
  }
  if (interactionType === "gapMatch") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Complete the sentence about QTI runtime state.</qti-prompt><qti-gap-text identifier="A" match-max="1">response declaration</qti-gap-text><qti-gap-text identifier="B" match-max="1">outcome declaration</qti-gap-text><qti-gap-text identifier="C" match-max="1">template declaration</qti-gap-text><p>An interaction records the candidate answer in a <qti-gap identifier="G1"/>, while scoring writes SCORE to an <qti-gap identifier="G2"/>.</p></${qtiName}>`;
  }
  return `<${qtiName} response-identifier="RESPONSE" max-choices="1"><qti-prompt>Which QTI element declares the variable that stores a candidate response?</qti-prompt><qti-simple-choice identifier="A">qti-response-declaration</qti-simple-choice><qti-simple-choice identifier="B">qti-outcome-declaration</qti-simple-choice><qti-simple-choice identifier="C">qti-template-declaration</qti-simple-choice><qti-simple-choice identifier="D">qti-rubric-block</qti-simple-choice></${qtiName}>`;
}

function itemIntro(identifier: string): string {
  const intros: Record<string, string> = {
    "associate-reference": "Create one association from a shared pool of QTI concepts.",
    "choice-reference": "Select one answer from a standard single-choice interaction.",
    "drawing-reference": "Annotate the delivery-flow diagram with a freehand drawing.",
    "endAttempt-reference": "Use an end-attempt control to request an adaptive action.",
    "extendedText-reference": "Write a short explanation in a multiline response.",
    "gapMatch-reference": "Fill the sentence with QTI terms from the token bank.",
    "graphicAssociate-reference": "Connect related regions in the delivery-flow diagram.",
    "graphicGapMatch-reference": "Complete labels for the lifecycle diagram from the token bank.",
    "graphicOrder-reference": "Order diagram regions by selecting them in sequence.",
    "hotspot-reference": "Select one meaningful region on the delivery-flow diagram.",
    "hottext-reference": "Select a phrase directly inside the reading passage.",
    "match-reference": "Pair each source declaration with one target description.",
    "media-reference": "Render media through a native browser playback control.",
    "order-reference": "Arrange the runtime steps in their usual order.",
    "positionObject-reference": "Move the marker object onto the target stage.",
    "portableCustom-reference": "Exercise the portable custom interaction host contract.",
    "selectPoint-reference": "Mark an exact point on the diagram.",
    "slider-reference": "Set a numeric response with a range control.",
    "textEntry-reference": "Type a short QTI outcome name in the sentence.",
    "upload-reference": "Choose a file as the candidate response.",
  };
  return intros[identifier] ?? `${identifier} reference item.`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
