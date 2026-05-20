export { parseQtiXml } from "./parser.js";
export { createItemSession, type QtiItemSession } from "./session.js";
export { getInteractionSupport, interactionNameToType, interactionSupport } from "./support.js";
export type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiElementSupport,
  QtiInteraction,
  QtiInteractionType,
  QtiParseResult,
  QtiScoreResult,
  QtiSupportStatus,
  QtiValue,
} from "./types.js";
