import type { QtiFixture } from "./index.js";
import { basicCorrectAttempt } from "./fixture-attempts.js";

const circleSvg =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Ccircle cx='60' cy='40' r='28' fill='none' stroke='black' stroke-width='4'/%3E%3Cpath d='M60 12 A28 28 0 0 1 88 40 L60 40 Z' fill='%236aa5ff'/%3E%3C/svg%3E";
const squareSvg =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Crect x='32' y='12' width='56' height='56' fill='none' stroke='black' stroke-width='4'/%3E%3Crect x='32' y='12' width='28' height='28' fill='%236aa5ff'/%3E%3C/svg%3E";
const rectangleSvg =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Crect x='18' y='18' width='84' height='44' fill='none' stroke='black' stroke-width='4'/%3E%3Crect x='18' y='18' width='21' height='44' fill='%236aa5ff'/%3E%3C/svg%3E";

export function createBasicRichInlineChoiceFixture(): QtiFixture {
  const id = "basic-rich-inline-choice";

  return {
    id,
    category: "basic",
    interactionType: "inlineChoice",
    qtiName: "qti-inline-choice-interaction",
    title: "Basic rich inline choice fixture",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RICH_MATH_RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>C</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="RICH_TEXT_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RICH_IMAGE_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Which number sentence <qti-inline-choice-interaction response-identifier="RICH_MATH_RESPONSE" class="baseline">
      <qti-inline-choice identifier="A"><span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="seven times two equals fourteen dollars" display="inline"><semantics><mrow><mn>7</mn><mo>×</mo><mn>2</mn><mo>=</mo><mi>$</mi><mn>14</mn></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span></qti-inline-choice>
      <qti-inline-choice identifier="B"><span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="fourteen minus seven equals seven dollars" display="inline"><semantics><mrow><mn>14</mn><mo>-</mo><mn>7</mn><mo>=</mo><mi>$</mi><mn>7</mn></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span></qti-inline-choice>
      <qti-inline-choice identifier="C"><span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="fourteen divided by two equals seven dollars" display="inline"><semantics><mrow><mn>14</mn><mo>÷</mo><mn>2</mn><mo>=</mo><mi>$</mi><mn>7</mn></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span></qti-inline-choice>
    </qti-inline-choice-interaction> shows the amount each friend receives?</p>
    <p>Select the best answer:</p>
    <div>
      <qti-inline-choice-interaction response-identifier="RICH_TEXT_RESPONSE" class="qti-input-width-40">
        <qti-inline-choice identifier="A">Each part in Figure 1 is <span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="one-third" display="inline"><semantics><mrow><mfrac><mn>1</mn><mn>3</mn></mfrac></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span> of the whole figure.</qti-inline-choice>
        <qti-inline-choice identifier="B">Each part in Figure 1 is <span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="one-sixth" display="inline"><semantics><mrow><mfrac><mn>1</mn><mn>6</mn></mfrac></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span> of the whole figure.</qti-inline-choice>
        <qti-inline-choice identifier="C">Each part in Figure 1 is <span class="math_expression"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="one-eighth" display="inline"><semantics><mrow><mfrac><mn>1</mn><mn>8</mn></mfrac></mrow><annotation encoding="MathType-MTEF"/></semantics></math></span> of the whole figure.</qti-inline-choice>
      </qti-inline-choice-interaction>
    </div>
    <p>Select an image from the list:</p>
    <div>
      <qti-inline-choice-interaction response-identifier="RICH_IMAGE_RESPONSE" class="qti-input-width-25">
        <qti-inline-choice identifier="A"><img alt="circle divided into equal sections with one section shaded" src="${circleSvg}"/></qti-inline-choice>
        <qti-inline-choice identifier="B"><img alt="square divided into equal sections with one section shaded" src="${squareSvg}"/></qti-inline-choice>
        <qti-inline-choice identifier="C"><img alt="rectangle divided into equal sections with one section shaded" src="${rectangleSvg}"/></qti-inline-choice>
      </qti-inline-choice-interaction>
    </div>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RICH_MATH_RESPONSE"/>
          <qti-correct identifier="RICH_MATH_RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [basicCorrectAttempt({ RICH_MATH_RESPONSE: "C" }, { SCORE: 1 }, id)],
  };
}
