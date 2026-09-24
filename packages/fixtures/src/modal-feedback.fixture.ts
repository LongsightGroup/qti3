import type { QtiFixture } from "./index.js";

/** Synthetic, MIT-licensed examples shared by the reference app and conformance runner. */
export const modalFeedbackFixtures: QtiFixture[] = [
  {
    id: "rich-modal-feedback-reference",
    category: "processing",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Rich modal feedback with an explanation title",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0
    https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0p1_v1p0.xsd"
  identifier="rich-modal-feedback-reference" title="Rich modal feedback with an explanation title" time-dependent="false" xml:lang="en-US">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false">
      <qti-prompt>Which object produces its own visible light?</qti-prompt>
      <qti-simple-choice identifier="A">The Sun</qti-simple-choice>
      <qti-simple-choice identifier="B">The Moon</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
  <qti-response-condition><qti-response-if><qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value><qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">RIGHT</qti-base-value></qti-set-outcome-value></qti-response-if><qti-response-else><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value><qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">WRONG</qti-base-value></qti-set-outcome-value></qti-response-else></qti-response-condition>
  </qti-response-processing>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="RIGHT" show-hide="show" title="Why the Sun shines"><qti-content-body><p>The Sun produces <strong>its own light</strong>. The Moon reflects sunlight.</p><p>Your score: <qti-printed-variable identifier="SCORE"/>.</p></qti-content-body></qti-modal-feedback>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="WRONG" show-hide="show" title="Try again">The Moon reflects light. Look for the object that produces light.</qti-modal-feedback>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "correct",
        responses: {
          RESPONSE: "A",
        },
        expectedOutcomes: {
          SCORE: 1,
          FEEDBACK: "RIGHT",
        },
      },
      {
        name: "incorrect",
        responses: {
          RESPONSE: "B",
        },
        expectedOutcomes: {
          SCORE: 0,
          FEEDBACK: "WRONG",
        },
      },
    ],
  },
  {
    id: "multiple-choice-modal-feedback-reference",
    category: "processing",
    interactionType: "choice",
    qtiName: "qti-choice-interaction",
    title: "Multiple-choice feedback for each selected answer",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0
    https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0p1_v1p0.xsd"
  identifier="multiple-choice-modal-feedback-reference" title="Multiple-choice feedback for each selected answer" time-dependent="false" xml:lang="en-US">
  <qti-response-declaration identifier="LIGHT_SOURCES" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
      <qti-value>B</qti-value>
    </qti-correct-response>

  <qti-mapping default-value="0">
    <qti-map-entry map-key="A" mapped-value="1"/>
    <qti-map-entry map-key="B" mapped-value="1"/>
    <qti-map-entry map-key="C" mapped-value="0"/>
  </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="multiple" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="LIGHT_SOURCES" shuffle="false" max-choices="0">
      <qti-prompt>Select the objects that produce their own visible light.</qti-prompt>
      <qti-simple-choice identifier="A">The Sun</qti-simple-choice>
      <qti-simple-choice identifier="B">A lit candle</qti-simple-choice>
      <qti-simple-choice identifier="C">The Moon</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
      <qti-set-outcome-value identifier="SCORE">
        <qti-map-response identifier="LIGHT_SOURCES"/>
      </qti-set-outcome-value>
      <qti-set-outcome-value identifier="FEEDBACK">
        <qti-null/>
      </qti-set-outcome-value>
      <qti-response-condition>
        <qti-response-if>
          <qti-member>
            <qti-base-value base-type="identifier">A</qti-base-value>
            <qti-variable identifier="LIGHT_SOURCES"/>
          </qti-member>
          <qti-set-outcome-value identifier="FEEDBACK">
            <qti-multiple>
              <qti-variable identifier="FEEDBACK"/>
              <qti-base-value base-type="identifier">SUN</qti-base-value>
            </qti-multiple>
          </qti-set-outcome-value>
        </qti-response-if>
      </qti-response-condition>
      <qti-response-condition>
        <qti-response-if>
          <qti-member>
            <qti-base-value base-type="identifier">B</qti-base-value>
            <qti-variable identifier="LIGHT_SOURCES"/>
          </qti-member>
          <qti-set-outcome-value identifier="FEEDBACK">
            <qti-multiple>
              <qti-variable identifier="FEEDBACK"/>
              <qti-base-value base-type="identifier">CANDLE</qti-base-value>
            </qti-multiple>
          </qti-set-outcome-value>
        </qti-response-if>
      </qti-response-condition>
      <qti-response-condition>
        <qti-response-if>
          <qti-member>
            <qti-base-value base-type="identifier">C</qti-base-value>
            <qti-variable identifier="LIGHT_SOURCES"/>
          </qti-member>
          <qti-set-outcome-value identifier="FEEDBACK">
            <qti-multiple>
              <qti-variable identifier="FEEDBACK"/>
              <qti-base-value base-type="identifier">MOON</qti-base-value>
            </qti-multiple>
          </qti-set-outcome-value>
        </qti-response-if>
      </qti-response-condition>
    </qti-response-processing>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="SUN" show-hide="show">The Sun produces light through nuclear fusion.</qti-modal-feedback>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="CANDLE" show-hide="show">A burning candle produces light through combustion.</qti-modal-feedback>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="MOON" show-hide="show">The Moon reflects sunlight; it does not produce its own visible light.</qti-modal-feedback>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [
      {
        name: "both-correct",
        responses: {
          LIGHT_SOURCES: ["A", "B"],
        },
        expectedOutcomes: {
          SCORE: 2,
          FEEDBACK: ["SUN", "CANDLE"],
        },
      },
      {
        name: "mixed",
        responses: {
          LIGHT_SOURCES: ["A", "C"],
        },
        expectedOutcomes: {
          SCORE: 1,
          FEEDBACK: ["SUN", "MOON"],
        },
      },
      {
        name: "incorrect",
        responses: {
          LIGHT_SOURCES: ["C"],
        },
        expectedOutcomes: {
          SCORE: 0,
          FEEDBACK: ["MOON"],
        },
      },
    ],
  },
];
