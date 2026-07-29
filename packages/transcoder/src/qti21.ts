import type { QtiAssessmentItem, QtiInteractionType } from "@longsightgroup/qti3-core";

import type { Qti2InteractionPolicy } from "./profiles.js";
import { type Qti2ResponseProcessingPolicy, writeSemanticQti2Item } from "./qti2-semantic.js";

const REVISION = {
  target: "qti21",
  namespace: "http://www.imsglobal.org/xsd/imsqti_v2p1",
  schemaLocation:
    "http://www.imsglobal.org/xsd/imsqti_v2p1 https://www.imsglobal.org/xsd/imsqti_v2p1p2.xsd",
  attributePolicy: "qti21-equivalent",
} as const;

/** QTI 2.1 owns a distinct wire serializer even where semantic mappers are shared. */
export function writeQti21Item(
  item: QtiAssessmentItem,
  interactionPolicies: Readonly<Record<QtiInteractionType, Qti2InteractionPolicy>>,
  responseProcessing: Qti2ResponseProcessingPolicy,
) {
  return writeSemanticQti2Item(item, REVISION, {
    interactionPolicies,
    responseProcessing,
  });
}
