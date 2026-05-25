import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  interactionChoices,
  missingChoicesMessage,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import type { QtiPlayerMessages } from "../player-messages.js";

function choicePresentationLabel(interaction: QtiInteraction, index: number): string {
  const classNames = new Set((interaction.attributes.class ?? "").split(/\s+/).filter(Boolean));
  if (classNames.has("qti-labels-none")) return "";

  const labels = classNames.has("qti-labels-decimal")
    ? Array.from({ length: 26 }, (_, item) => `${item + 1}`)
    : classNames.has("qti-labels-lower-alpha")
      ? "abcdefghijklmnopqrstuvwxyz".split("")
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const suffix = classNames.has("qti-labels-suffix-none")
    ? ""
    : classNames.has("qti-labels-suffix-parenthesis")
      ? ")"
      : ".";
  return `${labels[index] ?? `${index + 1}`}${suffix}`;
}

export function renderChoice(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: QtiPlayerMessages,
): HTMLElement {
  const group = responseGroup("qti3-choice-group");

  const multiple =
    interaction.responseCardinality === "multiple" || interaction.responseCardinality === "ordered";
  const selected = new Set(valueToStrings(currentValue));
  const list = document.createElement("div");
  list.className = "qti3-choice-list";
  list.role = "group";
  list.setAttribute("aria-label", messages.interactionOptionsList({ type: interaction.type }));
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
        if (input.checked) selected.add(choice.identifier);
        else selected.delete(choice.identifier);
        update([...selected]);
      } else {
        selected.clear();
        selected.add(choice.identifier);
        syncSelected();
        update(input.value);
      }
      syncSelected();
    });
    const visibleLabel = choicePresentationLabel(interaction, index);
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
