import type { QtiAssessmentItem, QtiDiagnostic } from "./types.js";

// QTI 3.0.1 AssessmentItemDType sequence:
// https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_itemv3p0p1_v1p0.xsd
const itemChildOrder: readonly string[] = [
  "qti-context-declaration",
  "qti-response-declaration",
  "qti-outcome-declaration",
  "qti-template-declaration",
  "qti-template-processing",
  "qti-assessment-stimulus-ref",
  "qti-companion-materials-info",
  "qti-stylesheet",
  "qti-item-body",
  "qti-catalog-info",
  "qti-response-processing",
  "qti-modal-feedback",
];

/** Validate the authored direct-child sequence retained by the XML parser. */
export function validateAssessmentItemChildren(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  let lastOrder = -1;
  for (const child of item.sourceChildren ?? []) {
    const order = itemChildOrder.indexOf(child.qtiName);
    if (order < 0) {
      diagnostics.push({
        code: "assessmentItem.child.unsupported",
        severity: "error",
        message: `qti-assessment-item does not allow ${child.qtiName} as a direct child.`,
        path: child.source?.path,
        source: child.source,
      });
    } else if (order < lastOrder) {
      diagnostics.push({
        code: "assessmentItem.child.order",
        severity: "error",
        message: `${child.qtiName} appears out of QTI 3 qti-assessment-item child order.`,
        path: child.source?.path,
        source: child.source,
      });
    } else {
      lastOrder = order;
    }
  }
}
