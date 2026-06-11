function extendedTextXhtmlItem(identifier: string, interactionAttributes: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" format="xhtml"${interactionAttributes}/>
  </qti-item-body>
</qti-assessment-item>`;
}

export const XHTML_EXTENDED_TEXT_ITEM = extendedTextXhtmlItem("xhtml-extended-text", "");

export const PLAIN_EXTENDED_TEXT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="plain-extended-text" title="plain-extended-text" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" format="plain"/>
  </qti-item-body>
</qti-assessment-item>`;

export const XHTML_EXTENDED_TEXT_COUNTER_ITEM = extendedTextXhtmlItem(
  "xhtml-counter",
  ' class="qti-counter-up qti-height-lines-15" expected-length="20"',
);
