export { parseQtiXml } from "./parser.js";
export { createItemSession, type QtiItemSession, type QtiItemSessionOptions } from "./session.js";
export {
  deprecatedInteractionSupport,
  getInteractionSupport,
  interactionNameToType,
  interactionSupport,
} from "./support.js";
export { validateAssessmentItem } from "./validation.js";
export type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiChoice,
  QtiChoiceRole,
  QtiDiagnostic,
  QtiDocument,
  QtiElementSupport,
  QtiInteraction,
  QtiInteractionType,
  QtiParseResult,
  QtiScoreResult,
  QtiSupportStatus,
  QtiTemplateDeclaration,
  QtiTemplateProcessing,
  QtiTemplateRule,
  QtiValidationResult,
  QtiValue,
} from "./types.js";
