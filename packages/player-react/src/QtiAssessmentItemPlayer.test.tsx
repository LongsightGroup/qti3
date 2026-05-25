// @vitest-environment happy-dom
import {
  describeQtiAssessmentItemPlayerAdapterContract,
  type QtiAssessmentItemPlayerAdapterTestProps,
} from "@longsightgroup/qti3-player-adapter-test-utils";
import { act, createRef, type ReactNode, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, vi } from "vitest";
import { QtiAssessmentItemPlayer, type QtiAssessmentItemPlayerHandle } from "./index.js";

let host: HTMLDivElement | undefined;
let root: Root | undefined;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => root?.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
});

describeQtiAssessmentItemPlayerAdapterContract<
  ReactNode,
  RefObject<QtiAssessmentItemPlayerHandle | null>
>({
  adapterName: "React",
  createComponent: (props, ref) => <QtiAssessmentItemPlayer {...reactProps(props)} ref={ref} />,
  createRef: () => createRef<QtiAssessmentItemPlayerHandle>(),
  currentHandle: (ref) => ref.current,
  render: (component) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(component));
    return host;
  },
  rerender: (component) => {
    act(() => root?.render(component));
  },
  flushLoadFailure: async () => {
    await act(() => Promise.resolve());
  },
});

function reactProps(props: QtiAssessmentItemPlayerAdapterTestProps) {
  return props as Parameters<typeof QtiAssessmentItemPlayer>[0];
}

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
