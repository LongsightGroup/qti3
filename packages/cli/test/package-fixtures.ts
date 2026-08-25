/** Return the Basic item-player feature identifiers expected in complete package evidence. */
export function basicFeatureIds(): string[] {
  return [
    "Q-2",
    "Q-5",
    "Q-13",
    "Q-20",
    "I-0",
    "I-1",
    "I-2",
    "I-7",
    "I-8",
    "I-9b",
    "I-17",
    "I-18",
    "I-19",
    "A-1",
    "P-4",
  ];
}

/** Build a minimal conforming Basic IMPORT assessment-test package. */
export function basicImportTestPackageEntries(): Record<string, string> {
  return {
    "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="qti3-l1-T1-test-entry">
  <resources>
    <resource identifier="t1-test-entry-item1" type="imsqti_item_xmlv3p0" href="items/choice-single-cardinality.xml"><file href="items/choice-single-cardinality.xml"/></resource>
    <resource identifier="t1-test-entry-item2" type="imsqti_item_xmlv3p0" href="items/choice-multiple-cardinality.xml"><file href="items/choice-multiple-cardinality.xml"/></resource>
    <resource identifier="t1-test-entry-item3" type="imsqti_item_xmlv3p0" href="items/text-entry.xml"><file href="items/text-entry.xml"/></resource>
    <resource identifier="t1-test-entry-item4" type="imsqti_item_xmlv3p0" href="items/extended-text.xml"><file href="items/extended-text.xml"/></resource>
    <resource identifier="t1-test-entry" type="imsqti_test_xmlv3p0" href="assessment.xml"><file href="assessment.xml"/></resource>
  </resources>
</manifest>`,
    "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="t1-test-entry" title="T1 - test entry">
  <qti-test-part identifier="testPart-1" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="assessmentSection-1" title="Section 1" visible="true">
      <qti-assessment-item-ref identifier="t1-test-entry-item1" href="items/choice-single-cardinality.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item2" href="items/choice-multiple-cardinality.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item3" href="items/text-entry.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item4" href="items/extended-text.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
    "items/choice-single-cardinality.xml": basicImportTestItemXml(
      "choice-single",
      "identifier",
      '<qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
    ),
    "items/choice-multiple-cardinality.xml": basicImportTestItemXml(
      "choice-multiple",
      "identifier",
      '<qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="2"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
    ),
    "items/text-entry.xml": basicImportTestItemXml(
      "text-entry",
      "string",
      '<qti-text-entry-interaction response-identifier="RESPONSE"/>',
    ),
    "items/extended-text.xml": basicImportTestItemXml(
      "extended-text",
      "string",
      '<qti-extended-text-interaction response-identifier="RESPONSE"/>',
    ),
  };
}

function basicImportTestItemXml(
  identifier: string,
  baseType: "identifier" | "string",
  interactionXml: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${baseType}"/>
  <qti-item-body>${interactionXml}</qti-item-body>
</qti-assessment-item>`;
}
