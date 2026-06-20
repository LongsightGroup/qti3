import {
  bindQtiAssessmentItemPlayerAdapterEvents,
  createQtiAssessmentItemPlayerAdapterLoadSync,
  createQtiAssessmentItemPlayerHandle,
  defineQtiAssessmentItemPlayer,
  isQtiAssessmentItemPlayerAdapterPropName,
  qtiAssessmentItemPlayerLoadDependencies,
  syncQtiAssessmentItemPlayerAdapterChrome,
  QtiAssessmentItemPlayer as QtiAssessmentItemPlayerElement,
  type QtiAssessmentItemPlayerAdapterPropName,
  type QtiAssessmentItemPlayerAdapterProps,
  type QtiAssessmentItemPlayerHandle,
} from "@longsightgroup/qti3-player";
import {
  createElement,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
} from "react";

type QtiPlayerDomProps = Omit<
  HTMLAttributes<QtiAssessmentItemPlayerElement>,
  QtiAssessmentItemPlayerAdapterPropName | "children"
>;

export interface QtiAssessmentItemPlayerProps
  extends QtiPlayerDomProps, QtiAssessmentItemPlayerAdapterProps {}

export type { QtiAssessmentItemPlayerHandle };

let playerElementDefined = false;

export function ensureQtiAssessmentItemPlayerDefined(): void {
  if (playerElementDefined) return;
  defineQtiAssessmentItemPlayer();
  playerElementDefined = true;
}

export const QtiAssessmentItemPlayer = forwardRef<
  QtiAssessmentItemPlayerHandle,
  QtiAssessmentItemPlayerProps
>(function QtiAssessmentItemPlayer(props, ref) {
  ensureQtiAssessmentItemPlayerDefined();
  const elementRef = useRef<QtiAssessmentItemPlayerElement | null>(null);
  const latestPropsRef = useRef(props);
  const loadSyncRef = useRef(createQtiAssessmentItemPlayerAdapterLoadSync());
  latestPropsRef.current = props;

  useImperativeHandle(ref, () => createQtiAssessmentItemPlayerHandle(() => elementRef.current), []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return bindQtiAssessmentItemPlayerAdapterEvents(element, () => latestPropsRef.current);
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element) {
      syncQtiAssessmentItemPlayerAdapterChrome(element, props);
    }
  }, [
    props.languageOfInterface,
    props.keywordEmphasisEnabled,
    props.messageCatalog,
    props.messages,
  ]);

  const [
    loadStateKey,
    status,
    validateResponses,
    showFeedback,
    fetchXml,
    resolveAsset,
    resolveStylesheet,
  ] = qtiAssessmentItemPlayerLoadDependencies(props.loadOptions);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return loadSyncRef.current.run(element, {
      xml: props.xml,
      loadOptions: props.loadOptions,
      onLoadError: (error) => latestPropsRef.current.onLoadError?.(error),
    });
  }, [
    props.xml,
    loadStateKey,
    status,
    validateResponses,
    showFeedback,
    fetchXml,
    resolveAsset,
    resolveStylesheet,
  ]);

  return createElement("qti-assessment-item-player", {
    ...domPropsFrom(props),
    ref: elementRef,
  });
});

function domPropsFrom(props: QtiAssessmentItemPlayerProps): Record<string, unknown> {
  const domProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isQtiAssessmentItemPlayerAdapterPropName(key) || value === undefined) continue;
    domProps[key] = value;
  }
  return domProps;
}
