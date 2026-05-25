// @vitest-environment happy-dom
import {
  describeQtiAssessmentItemPlayerAdapterContract,
  type QtiAssessmentItemPlayerAdapterTestProps,
} from "@longsightgroup/qti3-player-adapter-test-utils";
import { createRef, type ComponentChild, type RefObject } from "preact";
import { render } from "preact";
import { afterEach, vi } from "vitest";
import { QtiAssessmentItemPlayer, type QtiAssessmentItemPlayerHandle } from "./index.js";

let host: HTMLDivElement | undefined;

afterEach(() => {
  vi.restoreAllMocks();
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

describeQtiAssessmentItemPlayerAdapterContract<
  ComponentChild,
  RefObject<QtiAssessmentItemPlayerHandle>
>({
  adapterName: "Preact",
  createComponent: (props, ref) =>
    ref ? (
      <QtiAssessmentItemPlayer {...preactProps(props)} ref={ref} />
    ) : (
      <QtiAssessmentItemPlayer {...preactProps(props)} />
    ),
  createRef: () => createRef<QtiAssessmentItemPlayerHandle>(),
  currentHandle: (ref) => ref.current,
  render: (component) => {
    host = document.createElement("div");
    document.body.append(host);
    render(component, host);
    return host;
  },
  rerender: (component) => {
    render(component, host!);
  },
  flushLoadFailure: async () => {
    await Promise.resolve();
  },
});

function preactProps(props: QtiAssessmentItemPlayerAdapterTestProps) {
  return props as Parameters<typeof QtiAssessmentItemPlayer>[0];
}
