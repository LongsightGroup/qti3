import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";
import { interactionChoices } from "../interaction-support.js";

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
  button.textContent = choice.text;
  return button;
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

export function pairRegionLabels(interaction: QtiInteraction): { source: string; target: string } {
  if (interaction.type === "associate") return { source: "First concept", target: "Pair with" };
  if (interaction.type === "match") return { source: "Prompt", target: "Match" };
  return { source: "Source", target: "Target" };
}
