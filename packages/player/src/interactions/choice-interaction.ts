import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  interactionChoices,
  missingChoicesMessage,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import { reportMaximumResponseExceeded } from "../inline-validation.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { maximumAllowedResponses } from "../response-limits.js";
import { choiceLayout } from "./choice-layout.js";
import { sharedVocabularyLabel } from "./shared-vocabulary.js";

export function renderChoice(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup("qti3-choice-group");

  const multiple =
    interaction.responseCardinality === "multiple" || interaction.responseCardinality === "ordered";
  const selected = new Set(valueToStrings(currentValue));
  const maximum = maximumAllowedResponses(interaction);
  const list = document.createElement("div");
  list.className = "qti3-choice-list";
  list.role = "group";
  list.setAttribute(
    "aria-label",
    messages.message("interactionOptionsList", { type: interaction.type }),
  );
  const syncSelected = () => {
    for (const label of list.querySelectorAll<HTMLElement>(".qti3-choice-option")) {
      const identifier = label.dataset.choiceIdentifier ?? "";
      label.dataset.selected = selected.has(identifier) ? "true" : "false";
    }
  };
  const choices = interactionChoices(interaction);
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const layout = choiceLayout(interaction, choices.length);
  list.dataset.qtiOrientation = layout.orientation;
  list.style.setProperty("--qti3-choice-columns", String(layout.columns));
  list.style.setProperty("--qti3-choice-rows", String(layout.rows));
  if (layout.stacking !== undefined) {
    list.dataset.qtiStacking = String(layout.stacking);
  }
  for (const [index, choice] of choices.entries()) {
    const label = document.createElement("label");
    label.className = "qti3-choice-option";
    label.dataset.choiceIdentifier = choice.identifier;
    const input = document.createElement("input");
    input.type = multiple ? "checkbox" : "radio";
    input.name = interaction.responseIdentifier ?? interaction.type;
    input.value = choice.identifier;
    input.checked = selected.has(choice.identifier);
    input.addEventListener("change", () => {
      if (multiple) {
        if (input.checked) {
          if (
            maximum !== undefined &&
            !selected.has(choice.identifier) &&
            selected.size >= maximum
          ) {
            input.checked = false;
            reportMaximumResponseExceeded(group, interaction, maximum);
            syncSelected();
            return;
          }
          selected.add(choice.identifier);
        } else selected.delete(choice.identifier);
        update([...selected]);
      } else {
        selected.clear();
        selected.add(choice.identifier);
        syncSelected();
        update(input.value);
      }
      syncSelected();
    });
    const visibleLabel = sharedVocabularyLabel(interaction, index);
    const optionParts: HTMLElement[] = [input];
    if (visibleLabel) {
      const labelText = document.createElement("span");
      labelText.className = "qti3-choice-label";
      labelText.textContent = visibleLabel;
      optionParts.push(labelText);
    }
    const text = document.createElement("span");
    text.className = "qti3-choice-text";
    text.textContent = choice.text;
    optionParts.push(text);
    label.append(...optionParts);
    list.append(label);
  }
  syncSelected();
  group.append(list);
  return group;
}
