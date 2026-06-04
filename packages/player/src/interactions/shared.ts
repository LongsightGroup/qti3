import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { interactionChoices } from "../interaction-support.js";

function positivePixelValue(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

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
  if (choice.asset?.data) element.setAttribute("aria-label", choice.text);
}

export function appendChoiceVisual(parent: HTMLElement, choice: QtiChoice): void {
  if (choice.asset?.data) {
    const image = document.createElement("img");
    image.className = "qti3-gap-choice-image";
    image.src = choice.asset.data;
    image.alt = "";
    image.draggable = false;
    const width = positivePixelValue(choice.asset.width);
    const height = positivePixelValue(choice.asset.height);
    if (width !== undefined) image.width = width;
    if (height !== undefined) image.height = height;
    parent.append(image);
    return;
  }

  parent.textContent = choice.text;
}

export function choiceText(choices: QtiChoice[], identifier: string | undefined): string {
  if (!identifier) return "";
  return choices.find((choice) => choice.identifier === identifier)?.text ?? identifier;
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
