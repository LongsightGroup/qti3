import {
  interactionSupport,
  type QtiAttemptStateV1,
  type QtiDiagnostic,
  type QtiInteractionType,
  type QtiValue,
} from "@qti3/core";

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
  category: "interaction" | "processing" | "adaptive";
  interactionType?: QtiInteractionType | undefined;
  qtiName?: string | undefined;
  title: string;
  xml: string;
  expectedParseDiagnostics: QtiExpectedDiagnostic[];
  expectedValidationDiagnostics: QtiExpectedDiagnostic[];
  attempts: QtiFixtureAttempt[];
}

export const interactionFixtures: QtiFixture[] = interactionSupport.map((support) =>
  createInteractionFixture(support.interactionType, support.qtiName),
);

export const processingFixtures: QtiFixture[] = [
  createMappingProcessingFixture(),
  createGenericMatchProcessingFixture(),
  createTemplateProcessingFixture(),
];

export const adaptiveFixtures: QtiFixture[] = [createAdaptiveFeedbackFixture()];

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
        responses: response.identifier ? { [response.identifier]: response.correct } : {},
        expectedOutcomes: response.identifier ? { SCORE: 1 } : { SCORE: "0" },
        expectedResponses: response.identifier ? { [response.identifier]: response.correct } : {},
        expectedState: {
          schema: "qti3.attempt-state.v1",
          itemIdentifier: id,
          status: response.identifier ? "interacting" : "initialized",
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
    <p>Reference item for ${id}: a QTI 3.0 item-player conformance example using realistic assessment wording.</p>
    <p>In QTI 3.0, an interaction writes a candidate answer to a <${qtiName} response-identifier="RESPONSE_DECLARATION"><qti-inline-choice identifier="A">response declaration</qti-inline-choice><qti-inline-choice identifier="B">template declaration</qti-inline-choice><qti-inline-choice identifier="C">rubric block</qti-inline-choice></${qtiName}>, and response processing writes derived values such as SCORE to an <${qtiName} response-identifier="RESPONSE_OUTCOME"><qti-inline-choice identifier="A">item body</qti-inline-choice><qti-inline-choice identifier="B">outcome declaration</qti-inline-choice><qti-inline-choice identifier="C">choice interaction</qti-inline-choice></${qtiName}>.</p>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
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
    <qti-choice-interaction response-identifier="RESPONSE">
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
    <qti-choice-interaction response-identifier="RESPONSE">
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
        expectedOutcomes: { SCORE: "0", FEEDBACK: "not-matched" },
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
    <qti-choice-interaction response-identifier="RESPONSE">
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
        expectedOutcomes: { SCORE: "0", FEEDBACK: "HINT_FEEDBACK", completionStatus: "unknown" },
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

function assessmentItem(
  identifier: string,
  response: { identifier?: string; cardinality: string; baseType: string; correct: QtiValue },
  interactionXml: string,
): string {
  const areaMappingXml =
    response.baseType === "point"
      ? `
        <qti-area-mapping default-value="0"><qti-area-map-entry shape="circle" coords="10,10,5" mapped-value="1"/></qti-area-mapping>`
      : "";
  const responseDeclaration = response.identifier
    ? `
      <qti-response-declaration identifier="${response.identifier}" cardinality="${response.cardinality}" base-type="${response.baseType}">
        <qti-correct-response>${valuesXml(response.correct)}</qti-correct-response>${areaMappingXml}
      </qti-response-declaration>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false" xml:lang="en">
  ${responseDeclaration}
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Reference item for ${identifier}: a QTI 3.0 item-player conformance example using realistic assessment wording.</p>
    ${interactionXml}
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/${response.baseType === "point" ? "map_response_point.xml" : "match_correct"}"/>
</qti-assessment-item>`;
}

function valuesXml(value: QtiValue): string {
  if (Array.isArray(value))
    return value.map((item) => `<qti-value>${escapeXml(String(item))}</qti-value>`).join("");
  return `<qti-value>${escapeXml(String(value ?? ""))}</qti-value>`;
}

function defaultResponse(interactionType: QtiInteractionType): {
  identifier?: string;
  cardinality: string;
  baseType: string;
  correct: QtiValue;
} {
  if (interactionType === "media") {
    return { cardinality: "single", baseType: "identifier", correct: null };
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
    return { identifier: "RESPONSE", cardinality: "single", baseType: "integer", correct: "50" };
  }
  if (interactionType === "hotspot") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "identifier", correct: "A" };
  }
  if (interactionType === "selectPoint" || interactionType === "positionObject") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "point", correct: "10 10" };
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
      baseType: "string",
      correct: "10 10 90 90",
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
    return `<${qtiName} autostart="false"><object data="media.mp3" type="audio/mpeg"/></${qtiName}>`;
  }
  if (interactionType === "slider") {
    return `<${qtiName} response-identifier="RESPONSE" lower-bound="0" upper-bound="100" step="1"><qti-prompt>Set the approximate percentage of runtime behavior that QTI response processing should own in a portable item player.</qti-prompt></${qtiName}>`;
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
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Order the visual regions from item definition to candidate response to scoring outcome.</qti-prompt><object data="image.png" type="image/png" width="160" height="120"/><qti-hotspot-choice identifier="A" shape="rect" coords="0,0,50,40"/><qti-hotspot-choice identifier="B" shape="rect" coords="55,0,105,40"/><qti-hotspot-choice identifier="C" shape="rect" coords="110,0,158,40"/></${qtiName}>`;
  }
  if (interactionType === "graphicAssociate") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Associate each highlighted delivery-region role with its paired region.</qti-prompt><object data="image.png" type="image/png" width="160" height="120"/><qti-associable-hotspot identifier="A" shape="rect" coords="0,0,50,40" match-max="1"/><qti-associable-hotspot identifier="B" shape="rect" coords="55,0,105,40" match-max="1"/><qti-associable-hotspot identifier="C" shape="rect" coords="0,60,50,110" match-max="1"/><qti-associable-hotspot identifier="D" shape="rect" coords="55,60,105,110" match-max="1"/></${qtiName}>`;
  }
  if (interactionType === "selectPoint") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Select the point where the candidate response enters the player pipeline.</qti-prompt><object data="image.png" type="image/png" width="160" height="120"/></${qtiName}>`;
  }
  if (interactionType === "positionObject") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Position the marker on the response-processing boundary.</qti-prompt><object data="image.png" type="image/png" width="160" height="120"/></${qtiName}>`;
  }
  if (interactionType === "upload") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Upload a short implementation note describing how your item player records response state.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "drawing") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Draw a simple line connecting response capture to scoring.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "portableCustom") {
    return `<${qtiName} response-identifier="RESPONSE" custom-interaction-type-identifier="urn:qti3:fixture:portable-custom" module="fixture-portable-custom"><qti-prompt>Use the portable custom contract to return the fixture response value A.</qti-prompt></${qtiName}>`;
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
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Complete the diagram labels for a QTI item lifecycle.</qti-prompt><object data="image.png" type="image/png" width="160" height="120"/><qti-gap-text identifier="A" match-max="1">response declaration</qti-gap-text><qti-gap-text identifier="B" match-max="1">outcome declaration</qti-gap-text><qti-gap-text identifier="C" match-max="1">template declaration</qti-gap-text><p>The interaction writes to a <qti-gap identifier="G1"/> and scoring writes to an <qti-gap identifier="G2"/>.</p></${qtiName}>`;
  }
  if (interactionType === "gapMatch") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Complete the sentence about QTI runtime state.</qti-prompt><qti-gap-text identifier="A" match-max="1">response declaration</qti-gap-text><qti-gap-text identifier="B" match-max="1">outcome declaration</qti-gap-text><qti-gap-text identifier="C" match-max="1">template declaration</qti-gap-text><p>An interaction records the candidate answer in a <qti-gap identifier="G1"/>, while scoring writes SCORE to an <qti-gap identifier="G2"/>.</p></${qtiName}>`;
  }
  return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Which QTI element declares the variable that stores a candidate response?</qti-prompt><qti-simple-choice identifier="A">qti-response-declaration</qti-simple-choice><qti-simple-choice identifier="B">qti-outcome-declaration</qti-simple-choice><qti-simple-choice identifier="C">qti-template-declaration</qti-simple-choice><qti-simple-choice identifier="D">qti-rubric-block</qti-simple-choice></${qtiName}>`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
