import type { QtiFixture } from "./index.js";

export const TEMPLATE_PROCESSING_BASE = 2;
export const TEMPLATE_PROCESSING_OFFSET = 3;
export const TEMPLATE_PROCESSING_CORRECT_RESPONSE =
  TEMPLATE_PROCESSING_BASE + TEMPLATE_PROCESSING_OFFSET;

export const TEMPLATE_PROCESSING_RESPONSE_PROMPT = "Type the generated value of ANSWER.";

export function formatTemplateProcessingPrompt(
  base: number = TEMPLATE_PROCESSING_BASE,
  answer: number = TEMPLATE_PROCESSING_CORRECT_RESPONSE,
): string {
  return `Before delivery, template processing computed BASE = ${base} and ANSWER = ${base} + 3 = ${answer}.`;
}

export function createTemplateProcessingItemXml(identifier: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-template-declaration identifier="BASE" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="ANSWER" cardinality="single" base-type="integer"/>
  <qti-template-processing>
    <qti-set-template-value identifier="BASE"><qti-base-value base-type="integer">${TEMPLATE_PROCESSING_BASE}</qti-base-value></qti-set-template-value>
    <qti-set-template-value identifier="ANSWER">
      <qti-sum><qti-variable identifier="BASE"/><qti-base-value base-type="integer">${TEMPLATE_PROCESSING_OFFSET}</qti-base-value></qti-sum>
    </qti-set-template-value>
    <qti-set-correct-response identifier="RESPONSE"><qti-variable identifier="ANSWER"/></qti-set-correct-response>
  </qti-template-processing>
  <qti-item-body>
    <p>Before delivery, template processing computed BASE = <qti-printed-variable identifier="BASE"/> and ANSWER = <qti-printed-variable identifier="BASE"/> + 3 = <qti-printed-variable identifier="ANSWER"/>.</p>
    <p>${TEMPLATE_PROCESSING_RESPONSE_PROMPT} <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="4"/></p>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
}

export function createTemplateProcessingFixture(): QtiFixture {
  const id = "template-processing-reference";
  return {
    id,
    category: "processing",
    title: "Template-processing reference fixture",
    xml: createTemplateProcessingItemXml(id),
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "generated-correct",
        responses: { RESPONSE: String(TEMPLATE_PROCESSING_CORRECT_RESPONSE) },
        expectedOutcomes: { SCORE: 1 },
        expectedResponses: { RESPONSE: String(TEMPLATE_PROCESSING_CORRECT_RESPONSE) },
        expectedState: {
          templateValues: {
            BASE: TEMPLATE_PROCESSING_BASE,
            ANSWER: TEMPLATE_PROCESSING_CORRECT_RESPONSE,
          },
        },
      },
    ],
  };
}

export function createBasicTemplateProcessingFixture(): QtiFixture {
  const id = "basic-template-processing";
  return {
    id,
    category: "basic",
    interactionType: "textEntry",
    qtiName: "qti-text-entry-interaction",
    title: "Basic template processing fixture",
    xml: createTemplateProcessingItemXml(id),
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "generated-correct",
        responses: { RESPONSE: String(TEMPLATE_PROCESSING_CORRECT_RESPONSE) },
        expectedOutcomes: { SCORE: 1 },
        expectedResponses: { RESPONSE: String(TEMPLATE_PROCESSING_CORRECT_RESPONSE) },
        expectedState: {
          templateValues: {
            BASE: TEMPLATE_PROCESSING_BASE,
            ANSWER: TEMPLATE_PROCESSING_CORRECT_RESPONSE,
          },
        },
      },
    ],
  };
}
