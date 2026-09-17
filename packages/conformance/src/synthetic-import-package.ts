import { writeQti3PackageZip } from "@longsightgroup/qti3-writer";

/** MIT-licensed synthetic supplement for a field absent from the pinned official Q20 fixtures. */
export const textConstraintPackagePath = "qti3-synthetic/text-entry-constraints.zip";

/** Build the synthetic probe through the shipped writer; all content is synthetic. */
export function syntheticImportPackage(path: string): Uint8Array | undefined {
  if (path !== textConstraintPackagePath) return undefined;
  return writeQti3PackageZip({
    identifier: "qti3-synthetic-text-constraints",
    items: [
      {
        kind: "xml",
        path: "text-entry-constraints.xml",
        identifier: "text-constraints",
        xml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="text-constraints" title="Synthetic text constraints" time-dependent="false">
<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
<qti-item-body><p>Enter digits: <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="6" pattern-mask="[0-9]{1,6}" data-patternmask-message="Enter one to six digits."/></p></qti-item-body>
</qti-assessment-item>`,
      },
    ],
  });
}
