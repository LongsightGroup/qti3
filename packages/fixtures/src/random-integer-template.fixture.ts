import type { QtiFixture } from "./index.js";

export const RANDOM_INTEGER_TEMPLATE_REFERENCE_ID = "random-integer-template-reference";
export const RANDOM_INTEGER_TEMPLATE_REFERENCE_SEED = RANDOM_INTEGER_TEMPLATE_REFERENCE_ID;

export const RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES = {
  FACTOR: 4,
  TARGET: 9,
  OFFSET: 4,
  RESULT: 40,
} as const;

export function formatRandomIntegerTemplatePrompt(
  values: Pick<
    typeof RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
    "FACTOR" | "OFFSET" | "RESULT"
  > = RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
): string {
  return `Solve ${values.FACTOR}x + ${values.OFFSET} = ${values.RESULT}.`;
}

export function createRandomIntegerTemplateFixture(): QtiFixture {
  const id = RANDOM_INTEGER_TEMPLATE_REFERENCE_ID;
  const { TARGET } = RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES;
  return {
    id,
    category: "processing",
    title: "Random integer template-processing reference fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-template-declaration identifier="FACTOR" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="TARGET" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="OFFSET" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="RESULT" cardinality="single" base-type="integer"/>
  <qti-template-processing>
    <qti-set-template-value identifier="FACTOR">
      <qti-random-integer min="2" max="10" step="2"/>
    </qti-set-template-value>
    <qti-set-template-value identifier="TARGET">
      <qti-random-integer min="3" max="9"/>
    </qti-set-template-value>
    <qti-set-template-value identifier="OFFSET">
      <qti-random-integer min="1" max="5"/>
    </qti-set-template-value>
    <qti-set-template-value identifier="RESULT">
      <qti-sum>
        <qti-product>
          <qti-variable identifier="FACTOR"/>
          <qti-variable identifier="TARGET"/>
        </qti-product>
        <qti-variable identifier="OFFSET"/>
      </qti-sum>
    </qti-set-template-value>
    <qti-set-correct-response identifier="RESPONSE">
      <qti-variable identifier="TARGET"/>
    </qti-set-correct-response>
  </qti-template-processing>
  <qti-item-body>
    <p>Solve <qti-printed-variable identifier="FACTOR"/>x + <qti-printed-variable identifier="OFFSET"/> = <qti-printed-variable identifier="RESULT"/>.</p>
    <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="12" step="1">
      <qti-prompt>Select the value of x.</qti-prompt>
    </qti-slider-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "generated-correct",
        randomSeed: RANDOM_INTEGER_TEMPLATE_REFERENCE_SEED,
        responses: { RESPONSE: TARGET },
        expectedOutcomes: { SCORE: 1 },
        expectedResponses: { RESPONSE: TARGET },
        expectedState: {
          templateValues: RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
        },
      },
    ],
  };
}
