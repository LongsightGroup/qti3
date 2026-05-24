import type { QtiValue } from "@longsightgroup/qti3-core";
import { formatPrintedValue } from "../content/content-dom.js";
import { isTemplateContentVisible } from "./content-state.js";

export interface DynamicBodyContext {
  variableValue(identifier: string): QtiValue;
  templateValue(identifier: string): QtiValue;
}

export function syncDynamicBodyState(root: ParentNode, context: DynamicBodyContext): void {
  for (const output of root.querySelectorAll<HTMLOutputElement>(".qti3-printed-variable")) {
    const identifier = output.dataset.identifier;
    if (!identifier) continue;
    output.value = formatPrintedValue(context.variableValue(identifier), output.dataset.format);
    output.textContent = output.value;
  }

  for (const element of root.querySelectorAll<HTMLElement>(
    ".qti3-feedback-block, .qti3-feedback-inline",
  )) {
    const identifier = element.dataset.feedbackIdentifier;
    const outcomeIdentifier = element.dataset.outcomeIdentifier;
    if (!identifier || !outcomeIdentifier) continue;
    const value = context.variableValue(outcomeIdentifier);
    const hasIdentifier = Array.isArray(value)
      ? value.map(String).includes(identifier)
      : String(value ?? "") === identifier;
    element.hidden = element.dataset.showHide === "hide" ? hasIdentifier : !hasIdentifier;
  }

  for (const element of root.querySelectorAll<HTMLElement>(
    ".qti3-template-block, .qti3-template-inline",
  )) {
    const templateIdentifier = element.dataset.templateIdentifier;
    element.hidden = !isTemplateContentVisible(
      element,
      templateIdentifier ? context.templateValue(templateIdentifier) : null,
    );
  }
}
