import {
  interactionSupport,
  qtiScalarToString,
  qtiValueToString,
  type QtiDiagnostic,
  type QtiInteractionType,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { createBasicRichInlineChoiceFixture } from "./basic-rich-inline-choice.fixture.js";
import { basicCorrectAttempt, type QtiFixtureAttempt } from "./fixture-attempts.js";
import { createRandomIntegerTemplateFixture } from "./random-integer-template.fixture.js";
import {
  createBasicTemplateProcessingFixture,
  createTemplateProcessingFixture,
} from "./template-processing.fixture.js";

export type { QtiFixtureAttempt };

export interface QtiExpectedDiagnostic {
  code: string;
  severity?: QtiDiagnostic["severity"] | undefined;
  path?: string | undefined;
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
const deliveryFlowImage = "hotspot-flow.svg";
const unlabeledDeliveryFlowImage = "hotspot-flow-unlabeled.svg";
// These paired fixture images share geometry; keep authored hotspot coordinates synchronized.

export const interactionFixtures: QtiFixture[] = interactionSupport.map((support) =>
  createInteractionFixture(support.interactionType, support.qtiName),
);

export const processingFixtures: QtiFixture[] = [
  createMappingProcessingFixture(),
  createGenericMatchProcessingFixture(),
  createTemplateProcessingFixture(),
  createRandomIntegerTemplateFixture(),
  createTemplateContentFixture(),
  createAdvancedProcessingFixture(),
];

export const adaptiveFixtures: QtiFixture[] = [createAdaptiveFeedbackFixture()];

export const basicItemPlayerFixtures: QtiFixture[] = [
  createBasicHtmlSubsetFixture(),
  createBasicTemplateResponseProcessingFixture(),
  createBasicTemplateProcessingFixture(),
  createBasicCompositeItemFixture(),
  createBasicMathMlFixture(),
  createBasicRichInlineChoiceFixture(),
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

/** Every packaged assessment-item fixture used for player rendering and accessibility sweeps. */
export const allQuestionItemFixtures: QtiFixture[] = [
  ...interactionFixtures,
  ...processingFixtures,
  ...adaptiveFixtures,
  ...basicItemPlayerFixtures,
  ...basicItemPlayerToleranceFixtures,
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
    <p>Read the sentence from a school-news article and choose the words that make the account accurate.</p>
    <p>After a three-week pilot, the cafeteria team reported that the reusable tray program <${qtiName} response-identifier="RESPONSE_DECLARATION"><qti-inline-choice identifier="A">reduced lunchroom waste</qti-inline-choice><qti-inline-choice identifier="B">increased disposable packaging</qti-inline-choice><qti-inline-choice identifier="C">left trash levels unchanged</qti-inline-choice><qti-inline-choice identifier="D">stopped food donations</qti-inline-choice></${qtiName}>, and the strongest evidence was the <${qtiName} response-identifier="RESPONSE_OUTCOME"><qti-inline-choice identifier="A">number of students who bought lunch</qti-inline-choice><qti-inline-choice identifier="B">drop in bags collected after lunch</qti-inline-choice><qti-inline-choice identifier="C">color of the new trays</qti-inline-choice><qti-inline-choice identifier="D">menu posted on Monday</qti-inline-choice></${qtiName}>.</p>
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
    <p>A wetlands team measured dissolved oxygen, stream temperature, and visible algae after a summer storm. Which conclusion is best supported by the evidence?</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Runoff probably carried nutrients into the stream, because algae increased while dissolved oxygen fell.</qti-simple-choice>
      <qti-simple-choice identifier="B">The stream was unaffected by the storm, because the students visited the same site each day.</qti-simple-choice>
      <qti-simple-choice identifier="C">The warmer water caused the field notebooks to record more precise measurements.</qti-simple-choice>
      <qti-simple-choice identifier="D">The data show that all aquatic organisms left the stream immediately after the storm.</qti-simple-choice>
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
    <p>A city council is comparing two proposals for a dangerous intersection near a middle school. Which recommendation most directly addresses the crash pattern described in the traffic report?</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Add a protected left-turn phase during arrival and dismissal, when most crashes occur.</qti-simple-choice>
      <qti-simple-choice identifier="B">Replace the nearby street trees, even though visibility was not cited in the report.</qti-simple-choice>
      <qti-simple-choice identifier="C">Move the bus stop two blocks away without changing the intersection controls.</qti-simple-choice>
      <qti-simple-choice identifier="D">Paint a mural on the retaining wall to make the corridor feel more welcoming.</qti-simple-choice>
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
      <qti-content-body><p>The selected field site is the north marsh, where students recorded three bird species during the morning count.</p></qti-content-body>
    </qti-template-block>
    <qti-template-block template-identifier="PATH" identifier="distractor" show-hide="show">
      <qti-content-body><p>The alternate field site is the south meadow, which is not part of this delivered item variant.</p></qti-content-body>
    </qti-template-block>
    <p>The checklist shows the <qti-template-inline template-identifier="PATH" identifier="reference" show-hide="show">north marsh observation</qti-template-inline><qti-template-inline template-identifier="PATH" identifier="reference" show-hide="hide">south meadow observation</qti-template-inline> because the item variant selected that site before delivery.</p>
    <p>If one additional species is confirmed, the total would be <math><mrow><mi>COUNT</mi><mo>+</mo><mn>1</mn></mrow></math>.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">The north marsh branch is the delivered version, so the observation count applies to that site.</qti-simple-choice>
      <qti-simple-choice identifier="B">Both site branches should be treated as visible observations from the same visit.</qti-simple-choice>
      <qti-simple-choice identifier="C">The site branch can only be chosen after a candidate submits an answer.</qti-simple-choice>
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
    <p>A robotics team is checking a test run summary. The controller rounded two sensor readings, calculated gear-ratio factors, averaged three speed trials, repeated a command sequence, and checked whether plotted points fell inside target zones. Which review action should run the complete analysis?</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Approve the full diagnostics run so every derived result is recalculated from the test data.</qti-simple-choice>
      <qti-simple-choice identifier="B">Skip the diagnostics because the raw readings are already listed in the notebook.</qti-simple-choice>
      <qti-simple-choice identifier="C">Run only the pretest setup, which cannot evaluate the completed trial.</qti-simple-choice>
      <qti-simple-choice identifier="D">Archive the run without checking the target-zone points.</qti-simple-choice>
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
    <p>A student is revising a claim about an ecosystem after reading a data table. The hint gives a scaffold, but the scored answer should still identify the best evidence-based revision.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Revise the claim to explain that lower plant cover may increase erosion during heavy rain.</qti-simple-choice>
      <qti-simple-choice identifier="B">Keep the original claim because one table is never useful as evidence.</qti-simple-choice>
      <qti-simple-choice identifier="C">Revise the claim to say rainfall has no connection to soil movement.</qti-simple-choice>
      <qti-simple-choice identifier="D">Focus only on the names of the sites, not the measured plant cover.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="HINT" title="Show hint"/>
    <qti-feedback-block identifier="HINT_FEEDBACK" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Hint: Compare the rows with the lowest plant cover to the rows with the most soil movement after rain.</p></qti-content-body>
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
  <qti-response-declaration identifier="LABEL_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HORIZONTAL_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="STACKING_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HIDDEN_CONTROL_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HOTTEXT_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="ORDER_RESPONSE" cardinality="ordered" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value><qti-value>C</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="MATCH_RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A B</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="TABULAR_MATCH_RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>MS1 MT1</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="GAP_RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A G1</qti-value><qti-value>B G2</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="BLOCK_TEXT_WIDTH_RESPONSE" cardinality="single" base-type="string"/>
  <qti-response-declaration identifier="INLINE_TEXT_WIDTH_RESPONSE" cardinality="single" base-type="string"/>
  <qti-response-declaration identifier="INLINE_CHOICE_WIDTH_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="GRAPHIC_GAP_RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>GA GT1</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p data-qti-suppress-tts="computer-read-aloud">Shared QTI vocabulary remains authored content metadata.</p>
    <div class="qti-layout-row">
      <div class="qti-layout-col6 qti-bordered">
        <p class="qti-align-center qti-text-indent-2">Stimulus content may use the QTI twelve-column layout grid.</p>
      </div>
      <div class="qti-layout-col6 qti-well">
        <p><span class="qti-underline">Presentation vocabulary</span> includes inline, alignment, and appearance classes.</p>
        <ul class="qti-list-style-type-square">
          <li><span class="qti-italic qti-display-inline-block qti-valign-middle">List styles are rendered by the player.</span></li>
        </ul>
        <p class="qti-writing-mode-vertical-rl"><span class="qti-text-combine-upright-all">2026</span></p>
      </div>
    </div>
    <qti-choice-interaction response-identifier="LABEL_RESPONSE" max-choices="1" class="qti-labels-decimal qti-labels-suffix-parenthesis">
      <qti-simple-choice identifier="A">Shared vocabulary is preserved.</qti-simple-choice>
      <qti-simple-choice identifier="B">Shared vocabulary is removed.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="HORIZONTAL_RESPONSE" max-choices="1" class="qti-orientation-horizontal">
      <qti-simple-choice identifier="A">Horizontal orientation is represented as shared vocabulary.</qti-simple-choice>
      <qti-simple-choice identifier="B">Horizontal orientation is represented as a deprecated attribute.</qti-simple-choice>
      <qti-simple-choice identifier="C">Horizontal orientation is ignored.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="STACKING_RESPONSE" max-choices="1" class="qti-choices-stacking-3 qti-orientation-vertical">
      <qti-simple-choice identifier="A">Stacked vertical choices preserve authored order.</qti-simple-choice>
      <qti-simple-choice identifier="B">Stacked vertical choices require framework templates.</qti-simple-choice>
      <qti-simple-choice identifier="C">Stacked vertical choices change scoring.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="HIDDEN_CONTROL_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-labels-cjk-ideographic qti-labels-suffix-period qti-writing-orientation-vertical-rl">
      <qti-simple-choice identifier="A">Hidden input controls remain programmatically available.</qti-simple-choice>
      <qti-simple-choice identifier="B">Hidden input controls remove keyboard access.</qti-simple-choice>
    </qti-choice-interaction>
    <qti-hottext-interaction response-identifier="HOTTEXT_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-unselected-hidden">
      <p>Hot text can <qti-hottext identifier="A">hide unselected indicators</qti-hottext> without hiding choices from assistive technology.</p>
    </qti-hottext-interaction>
    <qti-order-interaction response-identifier="ORDER_RESPONSE" class="qti-choices-top qti-labels-decimal qti-labels-suffix-parenthesis">
      <qti-simple-choice identifier="A">Parse item XML.</qti-simple-choice>
      <qti-simple-choice identifier="B">Capture ordered response.</qti-simple-choice>
      <qti-simple-choice identifier="C">Score the attempt.</qti-simple-choice>
    </qti-order-interaction>
    <qti-match-interaction response-identifier="MATCH_RESPONSE" class="qti-choices-right">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="1">Shared vocabulary class</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="B" match-max="1">Portable layout hint</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
    <qti-match-interaction response-identifier="TABULAR_MATCH_RESPONSE" class="qti-match-tabular" data-first-column-header="Source">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="MS1" match-max="1">Tabular row header</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="MT1" match-max="1">Tabular column header</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
    <qti-gap-match-interaction response-identifier="GAP_RESPONSE" class="qti-gap-placement qti-choices-left" data-choices-container-width="160">
      <qti-gap-text identifier="A" match-max="1">choice bank</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">target passage</qti-gap-text>
      <p>Shared vocabulary positions the <qti-gap identifier="G1" class="qti-input-width-10"/> beside the <qti-gap identifier="G2" class="qti-input-width-20"/>.</p>
    </qti-gap-match-interaction>
    <qti-text-entry-interaction response-identifier="BLOCK_TEXT_WIDTH_RESPONSE" class="qti-input-width-20" expected-length="4"/>
    <p>Shared vocabulary sizes inline text entry <qti-text-entry-interaction response-identifier="INLINE_TEXT_WIDTH_RESPONSE" class="qti-input-width-4" expected-length="30"/> and inline choice <qti-inline-choice-interaction response-identifier="INLINE_CHOICE_WIDTH_RESPONSE" class="qti-input-width-15">
      <qti-inline-choice identifier="A">narrow</qti-inline-choice>
      <qti-inline-choice identifier="B">wide</qti-inline-choice>
    </qti-inline-choice-interaction> controls.</p>
    <qti-graphic-gap-match-interaction response-identifier="GRAPHIC_GAP_RESPONSE" class="qti-selections-dark qti-unselected-hidden qti-choices-bottom" data-choices-container-width="180">
      <object data="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='120'%3E%3Crect width='180' height='120' fill='%23777'/%3E%3C/svg%3E" alt="Shared vocabulary graphic gap target." type="image/svg+xml" width="180" height="120"/>
      <qti-gap-text identifier="GA" match-max="1">graphic source</qti-gap-text>
      <qti-gap-text identifier="GB" match-max="1">spare source</qti-gap-text>
      <qti-associable-hotspot identifier="GT1" shape="rect" coords="24,24,84,76" match-max="1"/>
      <qti-associable-hotspot identifier="GT2" shape="rect" coords="100,24,160,76" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="LABEL_RESPONSE"/><qti-correct identifier="LABEL_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="HORIZONTAL_RESPONSE"/><qti-correct identifier="HORIZONTAL_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="STACKING_RESPONSE"/><qti-correct identifier="STACKING_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="HIDDEN_CONTROL_RESPONSE"/><qti-correct identifier="HIDDEN_CONTROL_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="HOTTEXT_RESPONSE"/><qti-correct identifier="HOTTEXT_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="ORDER_RESPONSE"/><qti-correct identifier="ORDER_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="MATCH_RESPONSE"/><qti-correct identifier="MATCH_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="TABULAR_MATCH_RESPONSE"/><qti-correct identifier="TABULAR_MATCH_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="GAP_RESPONSE"/><qti-correct identifier="GAP_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if><qti-match><qti-variable identifier="GRAPHIC_GAP_RESPONSE"/><qti-correct identifier="GRAPHIC_GAP_RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      basicCorrectAttempt(
        {
          LABEL_RESPONSE: "A",
          HORIZONTAL_RESPONSE: "A",
          STACKING_RESPONSE: "A",
          HIDDEN_CONTROL_RESPONSE: "A",
          HOTTEXT_RESPONSE: "A",
          ORDER_RESPONSE: ["A", "B", "C"],
          MATCH_RESPONSE: ["A B"],
          TABULAR_MATCH_RESPONSE: ["MS1 MT1"],
          GAP_RESPONSE: ["A G1", "B G2"],
          GRAPHIC_GAP_RESPONSE: ["GA GT1"],
        },
        { SCORE: 10 },
        id,
      ),
    ],
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
  if (interactionType === "order") {
    return {
      identifier: "RESPONSE",
      cardinality: "ordered",
      baseType: "identifier",
      correct: ["A", "B", "C", "D"],
    };
  }
  if (interactionType === "graphicOrder") {
    return {
      identifier: "RESPONSE",
      cardinality: "ordered",
      baseType: "identifier",
      correct: ["A", "B", "D", "C"],
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
    return { identifier: "RESPONSE", cardinality: "single", baseType: "integer", correct: 2024 };
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
      correct: "estuary",
    };
  }
  return { identifier: "RESPONSE", cardinality: "single", baseType: "string", correct: "A" };
}

function renderInteractionXml(qtiName: string, interactionType: QtiInteractionType): string {
  if (interactionType === "endAttempt") {
    return `<p>A student is comparing two explanations for why a coastal town floods more often after storms. The end-attempt control lets the student request a scaffold before submitting the final answer.</p><${qtiName} response-identifier="RESPONSE" title="Show planning hint"/>`;
  }
  if (interactionType === "media") {
    return `<${qtiName} response-identifier="RESPONSE" autostart="false" min-plays="1"><qti-prompt>Play the town-hall audio excerpt once before answering the follow-up question about the speaker's claim. This fixture uses silent audio so browser media controls can be tested without shipping copyrighted material.</qti-prompt><object data="${silentWavDataUri}" type="audio/wav">Silent town-hall audio excerpt</object></${qtiName}>`;
  }
  if (interactionType === "slider") {
    return `<${qtiName} response-identifier="RESPONSE" lower-bound="2010" upper-bound="2030" step="1"><qti-prompt>A community archive asks students to place the opening year of the restored rail-trail on a timeline. The project opened in 2024 after fourteen years of planning. Select the opening year.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "extendedText") {
    return `<${qtiName} response-identifier="RESPONSE" expected-lines="6"><qti-prompt>Write a short recommendation for the school garden committee. Use evidence from the scenario: two beds with mulch retained more moisture during a hot week, while the uncovered bed needed watering every afternoon.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "textEntry") {
    return `<p>A river meets the ocean in a partly enclosed area where fresh water and salt water mix. Type the vocabulary word for this coastal feature: <${qtiName} response-identifier="RESPONSE" expected-length="10"/>.</p>`;
  }
  if (interactionType === "order") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>A science class is planning a fair test of how light affects seedling growth. Put the investigation steps in the best order.</qti-prompt><qti-simple-choice identifier="A">Set up identical trays with the same soil, seed type, and water schedule.</qti-simple-choice><qti-simple-choice identifier="B">Place one tray in full light and one tray in reduced light for the same number of days.</qti-simple-choice><qti-simple-choice identifier="C">Measure and compare seedling height at the end of the trial.</qti-simple-choice><qti-simple-choice identifier="D">Use the measurements to write a conclusion about how light affected growth.</qti-simple-choice></${qtiName}>`;
  }
  if (interactionType === "hottext") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Read the paragraph and select the phrase that best states the author's claim.</qti-prompt><p>The city should convert the vacant lot on Pine Street into a pocket park. <qti-hottext identifier="A">A small green space would give nearby residents a shaded place to gather</qti-hottext>, and volunteers have already offered to maintain native plants. <qti-hottext identifier="B">The lot is 0.4 acres</qti-hottext> and sits next to a bus stop. <qti-hottext identifier="C">The planning department posted the proposal last Tuesday</qti-hottext>. <qti-hottext identifier="D">Two benches are stored in a public works warehouse</qti-hottext>.</p></${qtiName}>`;
  }
  if (interactionType === "hotspot") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>The field-study workflow shows how a class monitors water quality. Select the step where students collect water-temperature and dissolved-oxygen readings at the stream.</qti-prompt><object data="${deliveryFlowImage}" type="image/svg+xml" width="480" height="300"/><qti-hotspot-choice identifier="A" shape="rect" coords="184,52,296,124"/><qti-hotspot-choice identifier="B" shape="rect" coords="24,52,136,124"/><qti-hotspot-choice identifier="C" shape="rect" coords="344,52,456,124"/><qti-hotspot-choice identifier="D" shape="rect" coords="184,178,296,250"/></${qtiName}>`;
  }
  if (interactionType === "graphicOrder") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the workflow regions in the order a field team should complete them: plan the sampling route, collect data, analyze the results, then write the recommendation report.</qti-prompt><object data="${unlabeledDeliveryFlowImage}" type="image/svg+xml" width="480" height="300"/><qti-hotspot-choice identifier="A" hotspot-label="Plan sampling route" shape="rect" coords="24,52,136,124"/><qti-hotspot-choice identifier="B" hotspot-label="Collect water data" shape="rect" coords="184,52,296,124"/><qti-hotspot-choice identifier="C" hotspot-label="Report recommendations" shape="rect" coords="184,178,296,250"/><qti-hotspot-choice identifier="D" hotspot-label="Analyze results" shape="rect" coords="344,52,456,124"/></${qtiName}>`;
  }
  if (interactionType === "graphicAssociate") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Connect the two workflow regions that belong together: planning the route should be paired with collecting water data, and analyzing results should be paired with reporting recommendations.</qti-prompt><object data="${unlabeledDeliveryFlowImage}" type="image/svg+xml" width="480" height="300"/><qti-associable-hotspot identifier="A" hotspot-label="Plan sampling route" shape="rect" coords="24,52,136,124" match-max="1"/><qti-associable-hotspot identifier="B" hotspot-label="Collect water data" shape="rect" coords="184,52,296,124" match-max="1"/><qti-associable-hotspot identifier="C" hotspot-label="Analyze results" shape="rect" coords="344,52,456,124" match-max="1"/><qti-associable-hotspot identifier="D" hotspot-label="Report recommendations" shape="rect" coords="184,178,296,250" match-max="1"/><qti-associable-hotspot identifier="E" hotspot-label="Community meeting" shape="circle" coords="420,214,28" match-max="1"/></${qtiName}>`;
  }
  if (interactionType === "selectPoint") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Mark the center of the Collect water data step, where students record the stream measurements.</qti-prompt><object data="${deliveryFlowImage}" type="image/svg+xml" width="480" height="300"/></${qtiName}>`;
  }
  if (interactionType === "positionObject") {
    return `<qti-position-object-stage><object data="${deliveryFlowImage}" type="image/svg+xml" width="480" height="300"/><${qtiName} response-identifier="RESPONSE"><qti-prompt>Drag the field-note marker onto the Collect water data step in the workflow.</qti-prompt><object data="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2048'%3E%3Crect%20x='4'%20y='4'%20width='56'%20height='40'%20rx='8'%20fill='%23fff3bf'%20stroke='%23212529'%20stroke-width='4'/%3E%3Cpath%20d='M32%2044%20L24%2058%20L40%2058%20Z'%20fill='%23fff3bf'%20stroke='%23212529'%20stroke-width='4'/%3E%3C/svg%3E" type="image/svg+xml" width="64" height="48"/></${qtiName}></qti-position-object-stage>`;
  }
  if (interactionType === "upload") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Upload a text file named upload.txt containing your one-page field notes from the water-quality investigation.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "drawing") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Annotate the field-study workflow by circling the step where students collect measurements and adding a note about what data should be recorded.</qti-prompt><object data="${deliveryFlowImage}" type="image/svg+xml" width="480" height="300"/></${qtiName}>`;
  }
  if (interactionType === "portableCustom") {
    return `<${qtiName} response-identifier="RESPONSE" custom-interaction-type-identifier="urn:qti3:fixture:portable-custom" module="fixture-portable-custom"><qti-prompt>Use the custom graphing tool to choose the claim best supported by the sample data. The fixture module returns A for the supported claim.</qti-prompt><qti-interaction-modules primary-configuration="modules/module_resolution.js"><qti-interaction-module id="fixture-portable-custom" primary-path="modules/fixture-portable-custom"/></qti-interaction-modules><qti-interaction-markup><div class="qti3-fixture-pci-markup">Custom graphing widget placeholder for sample data</div></qti-interaction-markup></${qtiName}>`;
  }
  if (interactionType === "custom") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the supported claim after the custom interaction initializes.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "match" || interactionType === "associate") {
    if (interactionType === "match") {
      return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Match each observation from a community garden study with the most reasonable interpretation.</qti-prompt><qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">Mulched beds stayed moist two days longer after watering.</qti-simple-associable-choice><qti-simple-associable-choice identifier="B" match-max="1">Uncovered beds had more weeds by the third week.</qti-simple-associable-choice><qti-simple-associable-choice identifier="C" match-max="1">Beds near the fence received less afternoon sun.</qti-simple-associable-choice><qti-simple-associable-choice identifier="D" match-max="1">The garden sign was repainted on Saturday.</qti-simple-associable-choice></qti-simple-match-set><qti-simple-match-set><qti-simple-associable-choice identifier="G1" match-max="1">Mulch helped reduce water loss from the soil.</qti-simple-associable-choice><qti-simple-associable-choice identifier="G2" match-max="1">Bare soil may need more frequent weeding.</qti-simple-associable-choice><qti-simple-associable-choice identifier="G3" match-max="1">Light exposure was not identical across all beds.</qti-simple-associable-choice><qti-simple-associable-choice identifier="G4" match-max="1">This maintenance detail does not explain plant growth.</qti-simple-associable-choice></qti-simple-match-set></${qtiName}>`;
    }
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Choose the two details that belong together in a source-evaluation note.</qti-prompt><qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">Interview with the park ranger who led the restoration project</qti-simple-associable-choice><qti-simple-associable-choice identifier="B" match-max="1">Firsthand source for project timeline</qti-simple-associable-choice><qti-simple-associable-choice identifier="C" match-max="1">Anonymous comment on a neighborhood forum</qti-simple-associable-choice><qti-simple-associable-choice identifier="D" match-max="1">Decorative map border</qti-simple-associable-choice><qti-simple-associable-choice identifier="E" match-max="1">Weather forecast for next month</qti-simple-associable-choice></qti-simple-match-set></${qtiName}>`;
  }
  if (interactionType === "graphicGapMatch") {
    return `<${qtiName} response-identifier="RESPONSE" max-associations="2"><qti-prompt>Complete the field-study workflow labels.</qti-prompt><object data="${unlabeledDeliveryFlowImage}" type="image/svg+xml" width="480" height="300"/><qti-gap-text identifier="A" match-max="1">Plan route</qti-gap-text><qti-gap-text identifier="B" match-max="1">Collect data</qti-gap-text><qti-gap-text identifier="C" match-max="1">Analyze results</qti-gap-text><qti-gap-text identifier="D" match-max="1">Hold celebration</qti-gap-text><p>The first step is to <qti-gap identifier="G1"/> before the class can <qti-gap identifier="G2"/> at the stream.</p></${qtiName}>`;
  }
  if (interactionType === "gapMatch") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Complete the field-notes sentence using the word bank.</qti-prompt><qti-gap-text identifier="A" match-max="1">evidence</qti-gap-text><qti-gap-text identifier="B" match-max="1">claim</qti-gap-text><qti-gap-text identifier="C" match-max="1">opinion</qti-gap-text><qti-gap-text identifier="D" match-max="1">caption</qti-gap-text><p>The water sample data are the <qti-gap identifier="G1"/> that supports the report's <qti-gap identifier="G2"/> about stream health.</p></${qtiName}>`;
  }
  return `<${qtiName} response-identifier="RESPONSE" max-choices="1"><qti-prompt>A local newspaper reports that the library's weekend tutoring program improved attendance. Which detail would best support that claim?</qti-prompt><qti-simple-choice identifier="A">Attendance records show that average Saturday visits rose from 42 to 68 students after tutoring began.</qti-simple-choice><qti-simple-choice identifier="B">The library repainted the study room in a brighter color during spring break.</qti-simple-choice><qti-simple-choice identifier="C">Several tutors said they enjoyed helping younger students with homework.</qti-simple-choice><qti-simple-choice identifier="D">The tutoring flyers used the same logo as the summer reading program.</qti-simple-choice><qti-simple-choice identifier="E">The library closes one hour earlier on Sundays than it does on Saturdays.</qti-simple-choice></${qtiName}>`;
}

function itemIntro(identifier: string): string {
  const intros: Record<string, string> = {
    "associate-reference":
      "A media-literacy item asks the student to connect a source detail with the reason it is useful.",
    "choice-reference":
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    "drawing-reference":
      "A science item asks the student to annotate a field-study workflow diagram.",
    "endAttempt-reference":
      "An adaptive science item lets the student request a planning hint before answering.",
    "extendedText-reference":
      "A constructed-response item asks for a recommendation based on garden moisture data.",
    "gapMatch-reference":
      "A science vocabulary item asks the student to complete a field-notes sentence from a word bank.",
    "graphicAssociate-reference":
      "A diagram item asks the student to connect related parts of a field-study workflow.",
    "graphicGapMatch-reference":
      "A diagram-labeling item asks the student to complete two workflow labels from a word bank.",
    "graphicOrder-reference":
      "A visual sequencing item asks the student to order field-study workflow regions.",
    "hotspot-reference":
      "A diagram item asks the student to select the workflow step where stream data are collected.",
    "hottext-reference":
      "A reading item asks the student to select the author's claim inside a short paragraph.",
    "match-reference":
      "A garden-data item asks the student to match observations with reasonable interpretations.",
    "media-reference":
      "A listening item renders a town-hall audio excerpt through native browser media controls.",
    "order-reference":
      "A science-planning item asks the student to arrange investigation steps in order.",
    "positionObject-reference":
      "A diagram item asks the student to move a field-note marker onto the data-collection step.",
    "portableCustom-reference":
      "A graphing-item placeholder exercises a custom interaction while presenting sample-data content.",
    "selectPoint-reference":
      "A coordinate item asks the student to mark the center of the data-collection workflow step.",
    "slider-reference":
      "A timeline item asks the student to choose the opening year of a restored rail-trail.",
    "textEntry-reference":
      "A geography vocabulary item asks the student to type the name of a coastal feature.",
    "upload-reference":
      "A constructed-response item asks the student to upload a field-notes text file.",
  };
  return intros[identifier] ?? `${identifier} reference item.`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
