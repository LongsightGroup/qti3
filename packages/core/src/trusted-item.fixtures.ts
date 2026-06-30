export function adaptiveChoiceItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive" adaptive="true" title="adaptive" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-outcome-declaration identifier="TRACE" cardinality="single" base-type="identifier">
        <qti-default-value><qti-value>start</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
        <qti-feedback-block outcome-identifier="TRACE" identifier="wrong-first" show-hide="show">Try again.</qti-feedback-block>
        <qti-feedback-inline outcome-identifier="TRACE" identifier="wrong-first" show-hide="show">Inline retry.</qti-feedback-inline>
        <qti-feedback-block outcome-identifier="TRACE" identifier="start" show-hide="show">Start feedback.</qti-feedback-block>
        <qti-feedback-block outcome-identifier="TRACE" identifier="wrong-first" show-hide="hide">Hidden retry.</qti-feedback-block>
      </qti-item-body>
      <qti-modal-feedback outcome-identifier="TRACE" identifier="wrong-first" show-hide="show">Modal retry.</qti-modal-feedback>
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
            <qti-set-outcome-value identifier="completionStatus">
              <qti-base-value base-type="identifier">completed</qti-base-value>
            </qti-set-outcome-value>
          </qti-response-if>
          <qti-response-else>
            <qti-set-outcome-value identifier="TRACE">
              <qti-base-value base-type="identifier">wrong-first</qti-base-value>
            </qti-set-outcome-value>
          </qti-response-else>
        </qti-response-condition>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}

export function adaptiveTemplateItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive-template" adaptive="true" title="adaptive-template" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
      <qti-item-body><p>Template adaptive item <qti-printed-variable identifier="MISSING_TEMPLATE"/>.</p></qti-item-body>
      <qti-template-processing>
        <qti-set-correct-response identifier="RESPONSE">
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-set-correct-response>
      </qti-template-processing>
    </qti-assessment-item>
  `;
}

export function adaptiveTemplatePresentationItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive-template-presentation" adaptive="true" title="adaptive-template-presentation" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-template-declaration identifier="PROMPT_VALUE" cardinality="single" base-type="integer"/>
      <qti-template-declaration identifier="PATH" cardinality="single" base-type="identifier"/>
      <qti-template-processing>
        <qti-set-template-value identifier="PROMPT_VALUE">
          <qti-base-value base-type="integer">7</qti-base-value>
        </qti-set-template-value>
        <qti-set-template-value identifier="PATH">
          <qti-base-value base-type="identifier">visible</qti-base-value>
        </qti-set-template-value>
        <qti-set-correct-response identifier="RESPONSE">
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-set-correct-response>
      </qti-template-processing>
      <qti-item-body>
        <p>Generated value: <qti-printed-variable identifier="PROMPT_VALUE"/>.</p>
        <p>Initial score: <qti-printed-variable identifier="SCORE"/>.</p>
        <qti-template-block template-identifier="PATH" identifier="visible" show-hide="show">
          <p>Visible template path <qti-printed-variable identifier="PROMPT_VALUE"/>.</p>
        </qti-template-block>
        <qti-template-block template-identifier="PATH" identifier="hidden" show-hide="show">
          <p>Hidden template path.</p>
        </qti-template-block>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
      <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
    </qti-assessment-item>
  `;
}

export function noScoreProcessingItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-score" title="missing-score" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
      <qti-item-body><p>No processing.</p></qti-item-body>
    </qti-assessment-item>
  `;
}
