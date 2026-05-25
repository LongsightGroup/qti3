import type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiDiagnostic,
  QtiInteraction,
  QtiPortableCustomDefinition,
  QtiPortableCustomStateValue,
  QtiScoreResult,
  QtiValue,
} from "@longsightgroup/qti3-core";
export interface QtiPlayerSessionControl {
  validateResponses?: boolean | undefined;
  showFeedback?: boolean | undefined;
}

export interface QtiScoreAttemptOptions {
  validateResponses?: boolean | undefined;
}

export type QtiPlayerFetchXml = (url: string) => Promise<string>;
export type QtiPlayerResolveAsset = (url: string) => string;

export interface QtiPlayerLoadOptions {
  state?: QtiAttemptStateV1 | undefined;
  status?: QtiAttemptStatus | undefined;
  sessionControl?: QtiPlayerSessionControl | undefined;
  fetchXml?: QtiPlayerFetchXml | undefined;
  resolveAsset?: QtiPlayerResolveAsset | undefined;
}

export interface QtiReadyEventDetail {
  item: QtiAssessmentItem;
}

export interface QtiStateChangeEventDetail {
  /**
   * Attempt snapshot. `state.validationMessages` combines load-time authoring diagnostics
   * (unsupported interactions, missing choices, illegal embeds) with response validation
   * messages. After `restore()`, response messages are reapplied separately from authoring
   * diagnostics captured at `loadXml`.
   */
  state: QtiAttemptStateV1;
}

export interface QtiResponseChangeEventDetail {
  responseIdentifier: string;
  value: QtiValue;
}

export interface QtiPortableCustomMountEventDetail {
  responseIdentifier: string;
  interaction: QtiInteraction;
  definition: QtiPortableCustomDefinition;
  host: HTMLElement;
  value: QtiValue;
  state?: QtiPortableCustomStateValue | undefined;
}

export type QtiScoreEventDetail = QtiScoreResult;

export interface QtiValidationEventDetail {
  /** Authoring and response validation messages currently visible to the candidate. */
  validationMessages: QtiDiagnostic[];
  state: QtiAttemptStateV1;
}

export interface QtiSuspendEventDetail {
  state: QtiAttemptStateV1;
}

export interface QtiEndAttemptEventDetail {
  state: QtiAttemptStateV1;
}

export interface QtiDiagnosticsEventDetail {
  diagnostics: QtiDiagnostic[];
}

export interface QtiResetEventDetail {
  state?: QtiAttemptStateV1 | undefined;
}

export interface QtiRestoreEventDetail {
  state?: QtiAttemptStateV1 | undefined;
}

export interface QtiAssessmentItemPlayerEventDetailMap {
  "qti-ready": QtiReadyEventDetail;
  "qti-statechange": QtiStateChangeEventDetail;
  "qti-responsechange": QtiResponseChangeEventDetail;
  "qti-portable-custom-mount": QtiPortableCustomMountEventDetail;
  "qti-score": QtiScoreEventDetail;
  "qti-validation": QtiValidationEventDetail;
  "qti-suspend": QtiSuspendEventDetail;
  "qti-endattempt": QtiEndAttemptEventDetail;
  "qti-diagnostics": QtiDiagnosticsEventDetail;
  "qti-reset": QtiResetEventDetail;
  "qti-restore": QtiRestoreEventDetail;
}

export type QtiAssessmentItemPlayerEventName = keyof QtiAssessmentItemPlayerEventDetailMap;

export type QtiAssessmentItemPlayerEvent<
  T extends QtiAssessmentItemPlayerEventName = QtiAssessmentItemPlayerEventName,
> = CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;

export type QtiAssessmentItemPlayerCustomEventMap = {
  [T in QtiAssessmentItemPlayerEventName]: CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;
};
