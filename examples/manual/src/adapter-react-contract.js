import { QtiAssessmentItemPlayer as PlayerElement } from "@longsightgroup/qti3-player";
import { QtiAssessmentItemPlayer } from "@longsightgroup/qti3-player-react";
import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { installAdapterContractHarness } from "./adapter-contract-harness.js";

const rootElement = document.querySelector("#root");
if (!rootElement) throw new Error("Missing #root mount point.");

const root = createRoot(rootElement);

installAdapterContractHarness({
  PlayerElement,
  createComponent: (props, ref) => createElement(QtiAssessmentItemPlayer, { ...props, ref }),
  createRef,
  renderComponent: (component) => flushSync(() => root.render(component)),
  rootElement,
});
