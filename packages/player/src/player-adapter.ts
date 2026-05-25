import type {
  QtiAttemptStateV1,
  QtiCatalogSupportResolution,
  QtiCatalogSupportResolutionOptions,
  QtiScoreResult,
  QtiTextToSpeechTraversal,
} from "@longsightgroup/qti3-core";
import type { PlayerMessageCatalog } from "./player-message-catalog.js";
import type { QtiAssessmentItemPlayer } from "./player-element.js";
import type { QtiPlayerMessageOverrides } from "./player-message-resolver.js";
import type {
  QtiAssessmentItemPlayerEventDetailMap,
  QtiAssessmentItemPlayerEventName,
  QtiPlayerFetchXml,
  QtiPlayerLoadOptions,
  QtiPlayerResolveAsset,
  QtiScoreAttemptOptions,
} from "./player-types.js";

export type QtiAssessmentItemPlayerAdapterEventPropName =
  | "onReady"
  | "onResponseChange"
  | "onStateChange"
  | "onScore"
  | "onValidation"
  | "onSuspend"
  | "onEndAttempt"
  | "onPortableCustomMount"
  | "onDiagnostics"
  | "onReset"
  | "onRestore";

export type QtiAssessmentItemPlayerAdapterPropName =
  | "xml"
  | "loadOptions"
  | "languageOfInterface"
  | "messageCatalog"
  | "messages"
  | "onLoadError"
  | QtiAssessmentItemPlayerAdapterEventPropName;

export type QtiAssessmentItemPlayerAdapterEventCallback<
  T extends QtiAssessmentItemPlayerEventName,
> = (detail: QtiAssessmentItemPlayerEventDetailMap[T]) => void;

export type QtiAssessmentItemPlayerAdapterEventHandlerProps = {
  [K in (typeof qtiAssessmentItemPlayerAdapterEventEntries)[number] as K[1]]?: QtiAssessmentItemPlayerAdapterEventCallback<
    K[0]
  >;
};

export interface QtiAssessmentItemPlayerAdapterProps extends QtiAssessmentItemPlayerAdapterEventHandlerProps {
  /** Already-prepared candidate-safe XML for delivery, or authoring/preview XML in preview tools. */
  xml?: string | undefined;
  loadOptions?: QtiPlayerLoadOptions | undefined;
  languageOfInterface?: string | undefined;
  messageCatalog?: PlayerMessageCatalog | undefined;
  messages?: QtiPlayerMessageOverrides | undefined;
  onLoadError?: ((error: Error) => void) | undefined;
}

export interface QtiAssessmentItemPlayerHandle {
  readonly element: QtiAssessmentItemPlayer;
  loadXml(xml: string, options?: QtiPlayerLoadOptions): Promise<void>;
  loadUrl(url: string, options?: QtiPlayerLoadOptions): Promise<void>;
  scoreAttempt(options?: QtiScoreAttemptOptions): QtiScoreResult | undefined;
  restore(state: QtiAttemptStateV1): void;
  suspend(): void;
  endAttempt(options?: QtiScoreAttemptOptions): void;
  reset(): void;
  clearItem(): void;
  serialize(): QtiAttemptStateV1 | undefined;
  getTextToSpeechTraversal(): QtiTextToSpeechTraversal | undefined;
  getCatalogSupportResolution(
    options?: QtiCatalogSupportResolutionOptions,
  ): QtiCatalogSupportResolution | undefined;
}

export const qtiAssessmentItemPlayerAdapterEventEntries = [
  ["qti-ready", "onReady"],
  ["qti-responsechange", "onResponseChange"],
  ["qti-statechange", "onStateChange"],
  ["qti-score", "onScore"],
  ["qti-validation", "onValidation"],
  ["qti-suspend", "onSuspend"],
  ["qti-endattempt", "onEndAttempt"],
  ["qti-portable-custom-mount", "onPortableCustomMount"],
  ["qti-diagnostics", "onDiagnostics"],
  ["qti-reset", "onReset"],
  ["qti-restore", "onRestore"],
] as const satisfies readonly (readonly [
  QtiAssessmentItemPlayerEventName,
  QtiAssessmentItemPlayerAdapterEventPropName,
])[];

export const qtiAssessmentItemPlayerAdapterPropNames = [
  "xml",
  "loadOptions",
  "languageOfInterface",
  "messageCatalog",
  "messages",
  "onLoadError",
  ...qtiAssessmentItemPlayerAdapterEventEntries.map((entry) => entry[1]),
] as const satisfies readonly QtiAssessmentItemPlayerAdapterPropName[];

const qtiAssessmentItemPlayerAdapterPropNameSet = new Set<string>(
  qtiAssessmentItemPlayerAdapterPropNames,
);

export function isQtiAssessmentItemPlayerAdapterPropName(name: string): boolean {
  return qtiAssessmentItemPlayerAdapterPropNameSet.has(name);
}

export type QtiAssessmentItemPlayerLoadDependencies = readonly [
  string | undefined,
  QtiPlayerLoadOptions["status"] | undefined,
  boolean | undefined,
  boolean | undefined,
  QtiPlayerFetchXml | undefined,
  QtiPlayerResolveAsset | undefined,
];

export function qtiAssessmentItemPlayerLoadStateKey(
  state: QtiAttemptStateV1 | undefined,
): string | undefined {
  if (!state) return undefined;
  return JSON.stringify(state);
}

export function qtiAssessmentItemPlayerLoadDependencies(
  loadOptions: QtiPlayerLoadOptions | undefined,
): QtiAssessmentItemPlayerLoadDependencies {
  return [
    qtiAssessmentItemPlayerLoadStateKey(loadOptions?.state),
    loadOptions?.status,
    loadOptions?.sessionControl?.validateResponses,
    loadOptions?.sessionControl?.showFeedback,
    loadOptions?.fetchXml,
    loadOptions?.resolveAsset,
  ];
}

export function bindQtiAssessmentItemPlayerAdapterEvents(
  element: QtiAssessmentItemPlayer,
  getProps: () => QtiAssessmentItemPlayerAdapterProps,
): () => void {
  const removers = qtiAssessmentItemPlayerAdapterEventEntries.map(([eventName, propName]) => {
    const listener = (event: Event) => {
      const callback = getProps()[propName] as
        | QtiAssessmentItemPlayerAdapterEventCallback<typeof eventName>
        | undefined;
      callback?.(
        (event as CustomEvent<QtiAssessmentItemPlayerEventDetailMap[typeof eventName]>).detail,
      );
    };
    element.addEventListener(eventName, listener);
    return () => element.removeEventListener(eventName, listener);
  });
  return () => {
    for (const remove of removers) remove();
  };
}

export function syncQtiAssessmentItemPlayerAdapterMessages(
  element: QtiAssessmentItemPlayer,
  props: Pick<
    QtiAssessmentItemPlayerAdapterProps,
    "languageOfInterface" | "messageCatalog" | "messages"
  >,
): void {
  element.languageOfInterface = props.languageOfInterface;
  element.messageCatalog = props.messageCatalog;
  element.messages = props.messages;
}

export interface QtiAssessmentItemPlayerAdapterLoadSyncInput {
  xml?: string | undefined;
  loadOptions?: QtiPlayerLoadOptions | undefined;
  onLoadError?: ((error: Error) => void) | undefined;
}

export function createQtiAssessmentItemPlayerAdapterLoadSync(): {
  run(
    element: QtiAssessmentItemPlayer,
    input: QtiAssessmentItemPlayerAdapterLoadSyncInput,
  ): () => void;
} {
  let loadSequence = 0;

  return {
    run(element, input) {
      if (input.xml === undefined) {
        loadSequence += 1;
        element.clearItem();
        return () => {};
      }

      let active = true;
      const sequence = (loadSequence += 1);
      void element
        .loadXml(input.xml, input.loadOptions)
        .then(() => {
          if (!active || sequence !== loadSequence) return;
        })
        .catch((error: unknown) => {
          if (!active || sequence !== loadSequence) return;
          input.onLoadError?.(normalizeQtiAssessmentItemPlayerLoadError(error));
        });

      return () => {
        active = false;
      };
    },
  };
}

export function createQtiAssessmentItemPlayerHandle(
  getElement: () => QtiAssessmentItemPlayer | null,
): QtiAssessmentItemPlayerHandle {
  return {
    get element() {
      return requiredElement(getElement);
    },
    loadXml: (xml, options) => requiredElement(getElement).loadXml(xml, options),
    loadUrl: (url, options) => requiredElement(getElement).loadUrl(url, options),
    scoreAttempt: (options) => requiredElement(getElement).scoreAttempt(options),
    restore: (state) => requiredElement(getElement).restore(state),
    suspend: () => requiredElement(getElement).suspend(),
    endAttempt: (options) => requiredElement(getElement).endAttempt(options),
    reset: () => requiredElement(getElement).reset(),
    clearItem: () => requiredElement(getElement).clearItem(),
    serialize: () => requiredElement(getElement).serialize(),
    getTextToSpeechTraversal: () => requiredElement(getElement).getTextToSpeechTraversal(),
    getCatalogSupportResolution: (options) =>
      requiredElement(getElement).getCatalogSupportResolution(options),
  };
}

export function normalizeQtiAssessmentItemPlayerLoadError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function requiredElement(
  getElement: () => QtiAssessmentItemPlayer | null,
): QtiAssessmentItemPlayer {
  const element = getElement();
  if (!element) throw new Error("QTI assessment item player element is not mounted.");
  return element;
}
