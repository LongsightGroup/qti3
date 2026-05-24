import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  interactionChoices,
  missingChoicesMessage,
  valueToStrings,
} from "../interaction-support.js";
import type { QtiPlayerMessages } from "../player-messages.js";
import { interactionLabel } from "./interaction-label.js";

function appendOptions(
  select: HTMLSelectElement,
  choices: QtiChoice[],
  messages: QtiPlayerMessages,
): void {
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = messages.inlineChoicePrompt();
  select.append(empty);
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.identifier;
    option.textContent = choice.text;
    select.append(option);
  }
}

export function renderSelect(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: QtiPlayerMessages,
): HTMLElement {
  const choices = interactionChoices(interaction);
  if (choices.length === 0) return missingChoicesMessage(interaction);

  const select = document.createElement("select");
  select.className = "qti3-inline-select";
  if (interaction.responseIdentifier) select.name = interaction.responseIdentifier;
  select.setAttribute("aria-label", interactionLabel(interaction));
  appendOptions(select, choices, messages);
  const [selected] = valueToStrings(currentValue);
  if (selected) select.value = selected;
  select.addEventListener("change", () => update(select.value === "" ? null : select.value));
  return select;
}
