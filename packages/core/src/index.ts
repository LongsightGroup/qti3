export { parseQtiXml } from "./parser.js";
export {
  createItemSession,
  visibleModalFeedback,
  type QtiItemSession,
  type QtiItemSessionOptions,
} from "./session.js";
export {
  deprecatedInteractionSupport,
  elementSupport,
  getInteractionSupport,
  interactionNameToType,
  interactionSupport,
  processingSupport,
} from "./support.js";
export { validateAssessmentItem } from "./validation.js";
export type {
  QtiAssessmentItem,
  QtiAttemptStatus,
  QtiAttemptStateV1,
  QtiChoice,
  QtiChoiceRole,
  QtiDiagnostic,
  QtiDocument,
  QtiElementSupport,
  QtiInteractionElementSupport,
  QtiInteraction,
  QtiInteractionType,
  QtiModalFeedback,
  QtiParseResult,
  QtiProcessingElementSupport,
  QtiResponseBranch,
  QtiScoreResult,
  QtiSupportStatus,
  QtiTemplateDeclaration,
  QtiTemplateBranch,
  QtiTemplateProcessing,
  QtiTemplateRule,
  QtiValidationResult,
  QtiValue,
} from "./types.js";
