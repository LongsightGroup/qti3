import {
  parsePositiveNumber,
  type QtiChoice,
  type QtiInteraction,
} from "@longsightgroup/qti3-core";
import { renderStaticContentNodes } from "../content/content-renderer.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { interactionChoices } from "../interaction-support.js";
import { parseAuthoredAssetUrl } from "../asset-url-policy.js";

export function tokenRegion(label: string, visibleLabel?: string): HTMLElement {
  const region = document.createElement("div");
  region.className = "qti3-token-region";
  region.role = "group";
  region.setAttribute("aria-label", label);
  if (visibleLabel) {
    const heading = document.createElement("strong");
    heading.className = "qti3-region-label";
    heading.textContent = visibleLabel;
    region.append(heading);
  }
  return region;
}

export function tokenButton(choice: QtiChoice): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-token";
  button.dataset.choiceIdentifier = choice.identifier;
  button.setAttribute("aria-pressed", "false");
  setChoiceAccessibleName(button, choice);
  appendChoiceVisual(button, choice);
  return button;
}

export function setChoiceAccessibleName(element: HTMLElement, choice: QtiChoice): void {
  if (choice.text) element.setAttribute("aria-label", choice.text);
}

export function hasRichChoiceContent(choice: QtiChoice): boolean {
  return choice.content?.some((node) => node.kind !== "text") ?? false;
}

export function choiceVisualNodes(choice: QtiChoice): Node[] {
  if (choice.asset?.data) {
    const src = parseAuthoredAssetUrl(choice.asset.data, "image");
    if (!src) return [document.createTextNode(choice.text)];
    const image = document.createElement("img");
    image.className = "qti3-gap-choice-image";
    image.src = src;
    image.alt = "";
    image.draggable = false;
    const width = parsePositiveNumber(choice.asset.width);
    const height = parsePositiveNumber(choice.asset.height);
    if (width !== undefined) image.width = width;
    if (height !== undefined) image.height = height;
    return [image];
  }

  if (choice.content && choice.content.length > 0) {
    const nodes = renderStaticContentNodes(choice.content);
    markEmbeddedChoiceMediaNonDraggable(nodes);
    return nodes;
  }

  return [document.createTextNode(choice.text)];
}

export function appendChoiceVisual(parent: HTMLElement, choice: QtiChoice): void {
  parent.append(...choiceVisualNodes(choice));
}

function markEmbeddedChoiceMediaNonDraggable(nodes: Node[]): void {
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    for (const element of node.querySelectorAll<HTMLAnchorElement | HTMLImageElement>("a, img")) {
      element.draggable = false;
    }
    if (node instanceof HTMLAnchorElement || node instanceof HTMLImageElement) {
      node.draggable = false;
    }
  }
}

export function sourceChoices(interaction: QtiInteraction): QtiChoice[] {
  const choices = interactionChoices(interaction);
  if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") {
    const gapChoices = choices.filter((choice) => choice.role === "gapChoice");
    return gapChoices.length > 0 ? gapChoices : choices;
  }
  const sourceRoles = new Set(["associableChoice", "matchSource", "gapChoice", "hotspot"]);
  const sources = choices.filter((choice) => sourceRoles.has(choice.role));
  return sources.length > 0 ? sources : choices;
}

export function targetChoices(interaction: QtiInteraction): QtiChoice[] {
  const choices = interactionChoices(interaction);
  if (interaction.type === "associate" || interaction.type === "graphicAssociate") return choices;
  const targetRoles = new Set(["matchTarget", "gap", "hotspot"]);
  const targets = choices.filter((choice) => targetRoles.has(choice.role));
  return targets.length > 0 ? targets : choices;
}

export function pairRegionLabels(
  interaction: QtiInteraction,
  messages: PlayerMessageResolver,
): { source: string; target: string } {
  if (interaction.type === "associate") {
    return {
      source: messages.message("associateFirstConceptRegion"),
      target: messages.message("associatePairWithRegion"),
    };
  }
  if (interaction.type === "match") {
    return {
      source: messages.message("matchPromptRegion"),
      target: messages.message("matchMatchRegion"),
    };
  }
  return {
    source: messages.message("genericSourceRegion"),
    target: messages.message("genericTargetRegion"),
  };
}
