import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  choicesOrFallback,
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
  surface.className = "qti3-hotspot-surface";
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  surface.style.position = "relative";
  surface.style.inlineSize = `${width}px`;
  surface.style.aspectRatio = `${width} / ${height}`;
  surface.style.maxInlineSize = "100%";
  surface.style.border = "1px solid CanvasText";
  surface.style.background = "Canvas";
  surface.style.overflow = "hidden";

  const object = interaction.object;
  if (object?.data && object.type?.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = object.text || `${readableType(interaction.type)} image`;
    image.style.inlineSize = "100%";
    image.style.blockSize = "100%";
    image.style.objectFit = "contain";
    surface.append(image);
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
  for (const choice of choicesOrFallback(interaction)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button";
    button.dataset.choiceIdentifier = choice.identifier;
    button.textContent = choice.text;
    button.title = choice.text;
    button.setAttribute("aria-pressed", "false");
    button.style.position = "absolute";
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
