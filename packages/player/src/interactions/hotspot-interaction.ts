import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  choiceSelector,
  interactionChoices,
  missingChoicesMessage,
  objectHeight,
  objectWidth,
  placeHotspotButton,
  readableType,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";

export function renderHotspotResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
): HTMLElement {
  const group = responseGroup();

  const surface = document.createElement("div");
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  applyGraphicSurfaceLayout(surface, width, height, "qti3-hotspot-surface");

  const choices = interactionChoices(interaction);
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }

  const object = interaction.object;
  if (object) {
    appendGraphicObjectImage(
      surface,
      object,
      object.text || `${readableType(interaction.type)} image`,
    );
  }

  const selected = new Set(valueToStrings(currentValue));
  const multiple = interaction.responseCardinality === "multiple";
  const selectedSummary = document.createElement("p");
  selectedSummary.className = "qti3-selection-summary";
  selectedSummary.setAttribute("aria-live", "polite");
  selectedSummary.textContent = "No region selected";
  const syncSelected = () => {
    for (const button of surface.querySelectorAll<HTMLButtonElement>("button")) {
      const isSelected = selected.has(button.dataset.choiceIdentifier ?? "");
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.dataset.selected = isSelected ? "true" : "false";
    }
    selectedSummary.textContent =
      selected.size > 0 ? `Selected ${[...selected].join(", ")}` : "No region selected";
  };
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button";
    button.dataset.choiceIdentifier = choice.identifier;
    button.textContent = choice.text;
    button.title = choice.text;
    button.setAttribute("aria-pressed", "false");
    placeHotspotButton(button, choice, width, height);
    button.addEventListener("click", () => {
      if (multiple) {
        if (selected.has(choice.identifier)) selected.delete(choice.identifier);
        else selected.add(choice.identifier);
        syncSelected();
        update([...selected]);
      } else {
        selected.clear();
        selected.add(choice.identifier);
        syncSelected();
        update(choice.identifier);
      }
    });
    surface.append(button);
  }

  syncSelected();
  group.append(surface, selectedSummary);
  return group;
}
