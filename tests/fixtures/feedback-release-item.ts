// Host release authorization is distinct from QTI §7.19 completed-review semantics.
// Exact synthetic XML intentionally covers initial hide/show feedback and active scoring.
export function feedbackReleaseItemXml(adaptive: boolean): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="host-release" title="Host release" adaptive="${adaptive}" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"><qti-default-value><qti-value>INITIAL</qti-value></qti-default-value></qti-outcome-declaration>
    <qti-item-body>
      <p>Choose Alpha.</p>
      <qti-choice-interaction response-identifier="RESPONSE" max-choices="1"><qti-simple-choice identifier="A">Alpha</qti-simple-choice><qti-simple-choice identifier="B">Beta</qti-simple-choice></qti-choice-interaction>
      <qti-feedback-block outcome-identifier="FEEDBACK" identifier="RIGHT" show-hide="show"><qti-content-body><p>Block explanation.</p></qti-content-body></qti-feedback-block>
      <qti-feedback-block outcome-identifier="FEEDBACK" identifier="RIGHT" show-hide="hide"><qti-content-body><p>Hidden-condition explanation.</p></qti-content-body></qti-feedback-block>
      <p><qti-feedback-inline outcome-identifier="FEEDBACK" identifier="INITIAL" show-hide="show">Initial inline explanation.</qti-feedback-inline></p>
    </qti-item-body>
    <qti-response-processing>
      <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">2.5</qti-base-value></qti-set-outcome-value>
      <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">RIGHT</qti-base-value></qti-set-outcome-value>
    </qti-response-processing>
    <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="RIGHT" show-hide="show"><qti-content-body><p>Modal explanation. <a href="https://example.org/answer">Answer link</a></p></qti-content-body></qti-modal-feedback>
  </qti-assessment-item>`;
}
