import { QtiAssessmentItemPlayer as PlayerElement } from "@longsightgroup/qti3-player";
import { QtiAssessmentItemPlayer } from "@longsightgroup/qti3-player-preact";
import { createElement, createRef, render } from "preact";
import { installAdapterContractHarness } from "./adapter-contract-harness.js";

const rootElement = document.querySelector("#root");
if (!rootElement) throw new Error("Missing #root mount point.");

installAdapterContractHarness({
  PlayerElement,
  createComponent: (props, ref) => createElement(QtiAssessmentItemPlayer, { ...props, ref }),
  createRef,
  renderComponent: (component) => render(component, rootElement),
  rootElement,
});
