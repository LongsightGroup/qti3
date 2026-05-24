import {
  qtiValueToString,
  type QtiAttemptStateV1,
  type QtiContentNode,
  type QtiDocument,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { contentNodeText } from "../content/content-dom.js";

export function currentVariableValue(
  state: QtiAttemptStateV1 | undefined,
  identifier: string,
): QtiValue {
  return (
    state?.outcomes[identifier] ??
    state?.templateValues?.[identifier] ??
    state?.responses[identifier] ??
    null
  );
}

export function currentTemplateValue(
  state: QtiAttemptStateV1 | undefined,
  identifier: string,
): QtiValue {
  return state?.templateValues?.[identifier] ?? null;
}

export function isFeedbackVisible(
  node: Extract<QtiContentNode, { kind: "feedback" }>,
  value: QtiValue,
): boolean {
  const hasIdentifier = Array.isArray(value)
    ? value.map(String).includes(node.identifier)
    : qtiValueToString(value) === node.identifier;
  return node.showHide === "show" ? hasIdentifier : !hasIdentifier;
}

export function isTemplateContentVisible(element: HTMLElement, value: QtiValue): boolean {
  const templateIdentifier = element.dataset.templateIdentifier;
  const identifier = element.dataset.templateValueIdentifier;
  if (!templateIdentifier || !identifier) return true;
  const hasIdentifier = Array.isArray(value)
    ? value.map(String).includes(identifier)
    : qtiValueToString(value) === identifier;
  return element.dataset.showHide === "hide" ? !hasIdentifier : hasIdentifier;
}

export function mathTemplateValue(
  node: Extract<QtiContentNode, { kind: "element" }>,
  documentModel: QtiDocument | undefined,
  templateValue: QtiValue,
): string | undefined {
  if (node.qtiName !== "mi" && node.qtiName !== "mo") return undefined;
  const identifier = contentNodeText(node).trim();
  if (!identifier) return undefined;
  const declaration = documentModel?.item.templateDeclarations.find(
    (template) =>
      template.identifier === identifier && template.attributes["math-variable"] === "true",
  );
  if (!declaration) return undefined;
  return qtiValueToString(templateValue);
}
