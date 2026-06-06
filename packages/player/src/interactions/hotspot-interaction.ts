import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  createHotspotSvgElement,
  hotspotSelectionAccessibleLabel,
  interactionChoices,
  invalidHotspotGeometryMessage,
  missingChoicesMessage,
  objectHeight,
  objectWidth,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import { bindActivateOnEnterOrSpace } from "../dom/keyboard-activation.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function renderHotspotResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
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
      object.text || messages.message("interactionImageAlt", { type: interaction.type }),
    );
  }

  const selected = new Set(valueToStrings(currentValue));
  const multiple = interaction.responseCardinality === "multiple";
  const selectedSummary = document.createElement("p");
  selectedSummary.className = "qti3-selection-summary";
  selectedSummary.setAttribute("aria-live", "polite");
  selectedSummary.textContent = messages.message("noRegionSelected");

  const overlay = document.createElementNS(SVG_NAMESPACE, "svg");
  overlay.classList.add("qti3-hotspot-overlay");
  overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
  overlay.setAttribute("focusable", "false");

  const syncSelected = () => {
    for (const shape of overlay.querySelectorAll<SVGElement>(".qti3-hotspot-button")) {
      const isSelected = selected.has(shape.dataset.choiceIdentifier ?? "");
      shape.setAttribute("aria-pressed", isSelected ? "true" : "false");
      shape.dataset.selected = isSelected ? "true" : "false";
    }
    selectedSummary.textContent =
      selected.size > 0
        ? messages.message("hotspotSelectionSummary", {
            selection: [...selected].join(", "),
            count: selected.size,
          })
        : messages.message("noRegionSelected");
  };

  const choose = (choice: (typeof choices)[number]) => {
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
  };

  const geometryErrors: HTMLElement[] = [];
  for (const [index, choice] of choices.entries()) {
    const shape = createHotspotSvgElement(choice);
    if (!shape) {
      geometryErrors.push(invalidHotspotGeometryMessage(choice));
      continue;
    }
    shape.classList.add("qti3-hotspot-button");
    shape.dataset.choiceIdentifier = choice.identifier;
    shape.dataset.shape = choice.attributes.shape ?? "";
    shape.setAttribute("role", "button");
    shape.setAttribute("tabindex", "0");
    shape.setAttribute("aria-pressed", "false");
    shape.setAttribute("aria-label", hotspotSelectionAccessibleLabel(choice, index));
    if (choice.text) shape.setAttribute("title", choice.text);
    shape.addEventListener("click", () => choose(choice));
    bindActivateOnEnterOrSpace(shape, () => choose(choice));
    overlay.append(shape);
  }

  surface.append(overlay);
  syncSelected();
  group.append(surface, selectedSummary);
  for (const error of geometryErrors) {
    group.append(error);
  }
  return group;
}
