import type { QtiContentNode, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  contentElementName,
  copySafeAttributes,
  createContentElement,
  formatPrintedValue,
  unsafeContentElements,
} from "./content-dom.js";

export interface PlayerContentContext {
  interactionAt(index: number): QtiInteraction | undefined;
  renderBlockInteraction(interaction: QtiInteraction): HTMLElement;
  renderEmbeddedInteraction(interaction: QtiInteraction): HTMLElement;
  currentVariableValue(identifier: string): QtiValue;
  mathTemplateValue(node: Extract<QtiContentNode, { kind: "element" }>): string | undefined;
  isFeedbackVisible(node: Extract<QtiContentNode, { kind: "feedback" }>): boolean;
  isTemplateContentVisible(element: HTMLElement): boolean;
}

export function renderContentNodes(nodes: QtiContentNode[], context: PlayerContentContext): Node[] {
  return nodes.flatMap((node) => renderContentNode(node, context));
}

export function renderStaticContentNodes(nodes: QtiContentNode[]): Node[] {
  return renderContentNodes(nodes, staticMarkupContentContext());
}

function staticMarkupContentContext(): PlayerContentContext {
  return {
    interactionAt: () => undefined,
    renderBlockInteraction: () => document.createElement("span"),
    renderEmbeddedInteraction: () => document.createElement("span"),
    currentVariableValue: () => null,
    mathTemplateValue: () => undefined,
    isFeedbackVisible: () => false,
    isTemplateContentVisible: () => false,
  };
}

export function renderContentNode(node: QtiContentNode, context: PlayerContentContext): Node[] {
  if (node.kind === "text") return [document.createTextNode(node.text)];
  if (node.kind === "interaction") {
    const interaction = context.interactionAt(node.interactionIndex);
    if (!interaction) return [];
    if (interaction.type === "inlineChoice" || interaction.type === "textEntry") {
      return [context.renderEmbeddedInteraction(interaction)];
    }
    return [context.renderBlockInteraction(interaction)];
  }
  if (node.kind === "printedVariable") {
    return [renderPrintedVariable(node.identifier, node.format, context)];
  }
  if (node.kind === "feedback") return renderFeedbackContent(node, context);
  if (node.qtiName === "qti-template-block" || node.qtiName === "qti-template-inline") {
    return [renderTemplateContent(node, context)];
  }
  if (node.qtiName === "qti-position-object-stage") {
    return renderContentNodes(
      node.children.filter(
        (child) => !("qtiName" in child) || (child.qtiName !== "object" && child.qtiName !== "img"),
      ),
      context,
    );
  }
  if (node.qtiName === "qti-prompt") {
    const prompt = document.createElement("p");
    copySafeAttributes(prompt, node.attributes);
    prompt.classList.add("qti3-item-prompt");
    prompt.append(...renderContentNodes(node.children, context));
    return [prompt];
  }

  if (unsafeContentElements.has(node.qtiName)) return [];
  const elementName = contentElementName(node.qtiName);
  if (!elementName) return renderContentNodes(node.children, context);
  const element = createContentElement(elementName);
  copySafeAttributes(element, node.attributes);
  const mathTemplateValue = context.mathTemplateValue(node);
  if (mathTemplateValue === undefined) {
    element.append(...renderContentNodes(node.children, context));
  } else {
    element.textContent = mathTemplateValue;
  }
  return [element];
}

function renderTemplateContent(
  node: Extract<QtiContentNode, { kind: "element" }>,
  context: PlayerContentContext,
): HTMLElement {
  const element = document.createElement(node.qtiName === "qti-template-block" ? "div" : "span");
  copySafeAttributes(element, node.attributes);
  element.classList.add(
    node.qtiName === "qti-template-block" ? "qti3-template-block" : "qti3-template-inline",
  );
  element.dataset.templateIdentifier = node.attributes["template-identifier"] ?? "";
  element.dataset.templateValueIdentifier = node.attributes.identifier ?? "";
  element.dataset.showHide = node.attributes["show-hide"] === "hide" ? "hide" : "show";
  element.hidden = !context.isTemplateContentVisible(element);
  element.append(...renderContentNodes(node.children, context));
  return element;
}

function renderPrintedVariable(
  identifier: string,
  format: string | undefined,
  context: PlayerContentContext,
): HTMLElement {
  const output = document.createElement("output");
  output.className = "qti3-printed-variable";
  output.dataset.identifier = identifier;
  if (format) output.dataset.format = format;
  output.value = formatPrintedValue(context.currentVariableValue(identifier), format);
  output.textContent = output.value;
  return output;
}

function renderFeedbackContent(
  node: Extract<QtiContentNode, { kind: "feedback" }>,
  context: PlayerContentContext,
): Node[] {
  const element = document.createElement(node.feedbackType === "block" ? "section" : "span");
  element.className = `qti3-feedback-${node.feedbackType}`;
  element.dataset.feedbackIdentifier = node.identifier;
  element.dataset.outcomeIdentifier = node.outcomeIdentifier;
  element.dataset.showHide = node.showHide;
  element.hidden = !context.isFeedbackVisible(node);
  element.append(...renderContentNodes(node.children, context));
  return [element];
}
