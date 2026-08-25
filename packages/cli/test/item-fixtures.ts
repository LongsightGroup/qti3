import { interactionFixtures } from "@longsightgroup/qti3-fixtures";

/** Return the canonical choice interaction fixture XML used by CLI tests. */
export function choiceFixtureXml(): string {
  const fixture = interactionFixtures.find((entry) => entry.interactionType === "choice");
  if (fixture === undefined) throw new Error("Choice fixture is required for CLI tests.");
  return fixture.xml;
}

/** Build an adaptive item that exercises server-materialized delivery. */
export function adaptiveDeliveryXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive" title="Adaptive" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Visible feedback.</qti-feedback-block>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
}
