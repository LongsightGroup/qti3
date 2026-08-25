import type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiCatalogSupportResolutionOptions,
  QtiDiagnostic,
  QtiInteraction,
  QtiItemSessionOptions,
  QtiPortableCustomDefinition,
  QtiPortableCustomStateValue,
  QtiScoreResult,
  QtiSourceLocation,
  QtiStylesheet,
  QtiValue,
} from "@longsightgroup/qti3-core";
import type { QtiCatalogDeliveryReference } from "./catalog-delivery.js";

/** Host policy that makes selected catalog supports candidate-requestable. */
export type QtiCatalogRequestPolicy = QtiCatalogSupportResolutionOptions & {
  readonly supports: string | readonly string[];
};

export interface QtiPlayerSessionControl {
  validateResponses?: boolean | undefined;
  showFeedback?: boolean | undefined;
}

export interface QtiScoreAttemptOptions {
  validateResponses?: boolean | undefined;
}

export type QtiPlayerFetchXml = (url: string) => Promise<string>;
export type QtiPlayerResolveAsset = (url: string) => string;

export interface QtiResolvedStylesheet {
  href: string;
  type?: string | undefined;
  media?: string | undefined;
  title?: string | undefined;
}

export type QtiPlayerResolveStylesheet = (
  stylesheet: QtiStylesheet,
) => QtiResolvedStylesheet | undefined;

export interface QtiPlayerLoadOptions {
  state?: QtiAttemptStateV1 | undefined;
  status?: QtiAttemptStatus | undefined;
  sessionControl?: QtiPlayerSessionControl | undefined;
  /**
   * Host-owned core session capabilities retained by reference across reset and restore.
   * These capabilities are not serialized into `QtiAttemptStateV1`; the host must provide them
   * again when loading a saved attempt in a new player instance.
   */
  sessionOptions?: QtiItemSessionOptions | undefined;
  fetchXml?: QtiPlayerFetchXml | undefined;
  resolveAsset?: QtiPlayerResolveAsset | undefined;
  resolveStylesheet?: QtiPlayerResolveStylesheet | undefined;
}

/** How a catalog request reached the player event boundary. */
export type QtiCatalogRequestActivation = "keyboard" | "pointer" | "programmatic";

/** Stable relationship between an authored catalog reference and its current rendered element. */
export interface QtiRenderedCatalogReference {
  readonly referenceId: string;
  readonly catalogId: string;
  readonly qtiName: string;
  readonly element: Element;
  readonly source?: QtiSourceLocation | undefined;
}

/** Candidate catalog request emitted for host-owned presentation. */
export interface QtiCatalogRequestEventDetail {
  readonly reference: QtiRenderedCatalogReference;
  readonly delivery: QtiCatalogDeliveryReference;
  readonly activation: QtiCatalogRequestActivation;
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
  "qti-catalogrequest": QtiCatalogRequestEventDetail;
}

export type QtiAssessmentItemPlayerEventName = keyof QtiAssessmentItemPlayerEventDetailMap;

export type QtiAssessmentItemPlayerEvent<
  T extends QtiAssessmentItemPlayerEventName = QtiAssessmentItemPlayerEventName,
> = CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;

export type QtiAssessmentItemPlayerCustomEventMap = {
  [T in QtiAssessmentItemPlayerEventName]: CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;
};
