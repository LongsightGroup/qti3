import type { QtiAssessmentItem } from "@longsightgroup/qti3-core";

import { writeSemanticQti2Item } from "./qti2-semantic.js";

const REVISION = {
  target: "qti22",
  namespace: "http://www.imsglobal.org/xsd/imsqti_v2p2",
  schemaLocation:
    "http://www.imsglobal.org/xsd/imsqti_v2p2 https://purl.imsglobal.org/spec/qti/v2p2/schema/xsd/imsqti_v2p2p4.xsd",
  attributePolicy: "qti22-preserve",
} as const;

/** QTI 2.2 owns a distinct wire serializer even where semantic mappers are shared. */
export function writeQti22Item(item: QtiAssessmentItem) {
  return writeSemanticQti2Item(item, REVISION);
}
