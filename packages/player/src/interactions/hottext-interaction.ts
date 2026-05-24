import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  interactionChoices,
  missingChoicesMessage,
  valueToStrings,
} from "../interaction-support.js";
import { appendInlineControl, normalizeInlineSegmentText } from "./inline-controls.js";

export function renderHottextResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "qti3-hottext-group";
  group.role = "group";
  group.setAttribute("aria-label", "Hottext options");

  const selected = new Set(valueToStrings(currentValue));
  const multiple =
    interaction.responseCardinality === "multiple" || interaction.responseCardinality === "ordered";
  const passage = document.createElement("p");
  passage.className = "qti3-hottext-passage";

  const syncSelected = () => {
    for (const button of passage.querySelectorAll<HTMLButtonElement>(".qti3-hottext-token")) {
      const identifier = button.dataset.choiceIdentifier ?? "";
      const isSelected = selected.has(identifier);
      button.dataset.selected = isSelected ? "true" : "false";
      button.setAttribute("aria-pressed", String(isSelected));
    }
  };

  const segments =
    interaction.hottextSegments && interaction.hottextSegments.length > 0
      ? interaction.hottextSegments
      : interactionChoices(interaction).map((choice) => ({
          kind: "hottext" as const,
          identifier: choice.identifier,
          text: choice.text,
          attributes: choice.attributes,
          source: choice.source,
        }));

  if (segments.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }

  const content: Array<Node | string> = [];
  for (const [segmentIndex, segment] of segments.entries()) {
    if (segment.kind === "text") {
      content.push(document.createTextNode(normalizeInlineSegmentText(segment.text)));
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hottext-token";
    button.dataset.choiceIdentifier = segment.identifier;
    button.textContent = segment.text;
    button.addEventListener("click", () => {
      if (multiple) {
        if (selected.has(segment.identifier)) selected.delete(segment.identifier);
        else selected.add(segment.identifier);
        update([...selected]);
      } else {
        selected.clear();
        selected.add(segment.identifier);
        update(segment.identifier);
      }
      syncSelected();
    });
    appendInlineControl(content, button, segments[segmentIndex + 1]);
  }

  passage.append(...content);
  syncSelected();
  group.append(passage);
  return group;
}
