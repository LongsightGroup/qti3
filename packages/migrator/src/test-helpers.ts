import { createStoredZip } from "../../../tests/fixtures/package-zip.js";
export function assessmentPackageZip(
  itemTypes: readonly QtiInteractionType[] = ["choice", "order", "slider"],
  itemXmlOverrides: Readonly<Partial<Record<QtiInteractionType, string>>> = {},
): Uint8Array {
  const files = Object.fromEntries(
    itemTypes.map((interactionType) => [
      `items/${interactionType}.xml`,
      itemXmlOverrides[interactionType] ?? assessmentPackageItemXml(interactionType),
    ]),
  );
  const resources = itemTypes
    .map(
      (
        interactionType,
      ) => `    <resource identifier="${interactionType}" type="imsqti_item_xmlv3p0" href="items/${interactionType}.xml">
      <file href="items/${interactionType}.xml"/>
    </resource>`,
    )
    .join("\n");
  const dependencies = itemTypes
    .map((interactionType) => `      <dependency identifierref="${interactionType}"/>`)
    .join("\n");
  const itemRefs = itemTypes
    .map(
      (interactionType) =>
        `      <qti-assessment-item-ref identifier="${interactionType}-ref" href="../items/${interactionType}.xml"/>`,
    )
    .join("\n");
  const entries = {
    "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="package">
  <resources>
    <resource identifier="assessment" type="imsqti_test_xmlv3p0" href="tests/assessment.xml">
      <file href="tests/assessment.xml"/>
${dependencies}
    </resource>
${resources}
  </resources>
</manifest>`,
    "tests/assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="assessment" title="Round trip">
  <qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="section" title="Section" visible="true">
${itemRefs}
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
    ...files,
  };
  return createStoredZip(entries);
}

function assessmentPackageItemXml(interactionType: QtiInteractionType): string {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(`packages/fixtures/xml/${interactionType}-reference.xml`, "utf8");
}
import { readFileSync } from "node:fs";

import type { QtiInteractionType } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "@longsightgroup/qti3-writer";
