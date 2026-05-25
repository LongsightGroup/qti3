import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  choiceSelector,
  hotspotAccessibleLabel,
  hotspotCenter,
  hotspotDisplayLabel,
  interactionChoices,
  missingChoicesMessage,
  objectHeight,
  objectWidth,
  placeHotspotButton,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import { movementButton } from "../movement.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  announceOrderedItemMove,
  announceOrderedSelectionCount,
  createSelectionSummary,
  focusReorderControl,
  orderedItemAccessibleName,
} from "./a11y.js";

export function renderGraphicOrderResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup();
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  const choices = interactionChoices(interaction).filter((choice) => choice.role === "hotspot");
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const orderedIdentifiers = valueToStrings(currentValue).filter((identifier) =>
    choices.some((choice) => choice.identifier === identifier),
  );

  const surface = document.createElement("div");
  applyGraphicSurfaceLayout(surface, width, height, "qti3-graphic-order-surface");
  surface.role = "group";
  surface.setAttribute(
    "aria-label",
    messages.message("interactionHotspots", { type: interaction.type }),
  );

  const object = interaction.object;
  if (object) {
    appendGraphicObjectImage(
      surface,
      object,
      object.text || messages.message("interactionImageAlt", { type: interaction.type }),
    );
  }

  const sequenceLines = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sequenceLines.classList.add("qti3-graphic-sequence-lines");
  sequenceLines.setAttribute("viewBox", `0 0 ${width} ${height}`);
  sequenceLines.setAttribute("aria-hidden", "true");
  const markerId = `qti3-graphic-order-marker-${(interaction.responseIdentifier ?? interaction.type).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "5");
  marker.setAttribute("markerHeight", "5");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  defs.append(marker);
  sequenceLines.append(defs);
  surface.append(sequenceLines);

  const summary = createSelectionSummary();
  const list = document.createElement("ol");
  list.className = "qti3-graphic-order-list";
  list.setAttribute(
    "aria-label",
    messages.message("interactionSelectedOrderList", { type: interaction.type }),
  );

  const orderedChoices = () =>
    orderedIdentifiers
      .map((identifier) => choices.find((choice) => choice.identifier === identifier))
      .filter((choice): choice is QtiChoice => Boolean(choice));
  const commit = () => update([...orderedIdentifiers]);
  const updateSelectionCountSummary = () => {
    announceOrderedSelectionCount(summary, messages, orderedIdentifiers.length);
  };
  const focusHotspot = (identifier: string) => {
    surface
      .querySelector<HTMLButtonElement>(`.qti3-hotspot-button${choiceSelector(identifier)}`)
      ?.focus();
  };
  const focusRelativeHotspot = (choice: QtiChoice, delta: number) => {
    const index = choices.findIndex((entry) => entry.identifier === choice.identifier);
    const next = choices[(index + delta + choices.length) % choices.length];
    if (next) focusHotspot(next.identifier);
  };
  const chooseHotspot = (choice: QtiChoice) => {
    const existingIndex = orderedIdentifiers.indexOf(choice.identifier);
    if (existingIndex >= 0) orderedIdentifiers.splice(existingIndex, 1);
    orderedIdentifiers.push(choice.identifier);
    renderState();
    updateSelectionCountSummary();
    commit();
    focusHotspot(choice.identifier);
  };
  const removeHotspot = (identifier: string) => {
    const index = orderedIdentifiers.indexOf(identifier);
    if (index < 0) return;
    orderedIdentifiers.splice(index, 1);
    renderState();
    updateSelectionCountSummary();
    commit();
    focusHotspot(identifier);
  };
  const moveHotspot = (identifier: string, delta: number) => {
    const index = orderedIdentifiers.indexOf(identifier);
    const targetIndex = index + delta;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedIdentifiers.length) return;
    const choice = choices.find((entry) => entry.identifier === identifier);
    const choiceLabel = choice ? hotspotDisplayLabel(choice, choices) : identifier;
    const [entry] = orderedIdentifiers.splice(index, 1);
    if (!entry) return;
    orderedIdentifiers.splice(targetIndex, 0, entry);
    renderState();
    announceOrderedItemMove(
      summary,
      messages,
      choiceLabel,
      targetIndex,
      orderedIdentifiers.length,
      index,
    );
    commit();
    focusReorderControl(list, identifier);
  };
  const renderState = () => {
    for (const line of sequenceLines.querySelectorAll("line")) line.remove();
    const currentChoices = orderedChoices();
    for (let index = 0; index < currentChoices.length - 1; index += 1) {
      const current = currentChoices[index];
      const next = currentChoices[index + 1];
      if (!current || !next) continue;
      const start = hotspotCenter(current, width, height);
      const end = hotspotCenter(next, width, height);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(start.x));
      line.setAttribute("y1", String(start.y));
      line.setAttribute("x2", String(end.x));
      line.setAttribute("y2", String(end.y));
      line.setAttribute("marker-end", `url(#${markerId})`);
      sequenceLines.append(line);
    }

    for (const button of surface.querySelectorAll<HTMLButtonElement>(".qti3-hotspot-button")) {
      const identifier = button.dataset.choiceIdentifier ?? "";
      const index = orderedIdentifiers.indexOf(identifier);
      const isSelected = index >= 0;
      button.dataset.selected = isSelected ? "true" : "false";
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.dataset.order = isSelected ? String(index + 1) : "";
      const badge = button.querySelector<HTMLElement>(".qti3-graphic-order-number");
      if (badge) badge.textContent = isSelected ? String(index + 1) : "";
    }

    list.replaceChildren(
      ...currentChoices.map((choice, index) => {
        const item = document.createElement("li");
        item.className = "qti3-graphic-order-item";
        item.dataset.choiceIdentifier = choice.identifier;
        const choiceLabel = hotspotDisplayLabel(choice, choices);

        const label = document.createElement("button");
        label.type = "button";
        label.className = "qti3-token";
        label.dataset.choiceIdentifier = choice.identifier;
        label.textContent = `${index + 1}. ${choiceLabel}`;
        label.setAttribute(
          "aria-label",
          orderedItemAccessibleName(messages, choiceLabel, index, currentChoices.length),
        );
        label.addEventListener("click", () => focusHotspot(choice.identifier));
        label.addEventListener("keydown", (event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            moveHotspot(choice.identifier, -1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            moveHotspot(choice.identifier, 1);
          } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            removeHotspot(choice.identifier);
          }
        });

        const up = movementButton(
          "up",
          messages.message("moveChoice", { label: choiceLabel, direction: "up" }),
          () => moveHotspot(choice.identifier, -1),
        );
        up.disabled = index === 0;

        const down = movementButton(
          "down",
          messages.message("moveChoice", { label: choiceLabel, direction: "down" }),
          () => moveHotspot(choice.identifier, 1),
        );
        down.disabled = index === currentChoices.length - 1;

        const remove = removeButton(choiceLabel, messages);
        remove.addEventListener("click", () => removeHotspot(choice.identifier));

        item.append(label, up, down, remove);
        return item;
      }),
    );
  };

  for (const [index, choice] of choices.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button qti3-graphic-order-hotspot";
    button.dataset.choiceIdentifier = choice.identifier;
    button.title = hotspotAccessibleLabel(choice, index);
    button.setAttribute("aria-label", hotspotAccessibleLabel(choice, index));
    button.setAttribute("aria-pressed", "false");
    placeHotspotButton(button, choice, width, height);
    const text = document.createElement("span");
    text.className = "qti3-hotspot-label";
    text.textContent = hotspotDisplayLabel(choice, choices);
    const order = document.createElement("span");
    order.className = "qti3-graphic-order-number";
    order.setAttribute("aria-hidden", "true");
    button.append(text, order);
    button.addEventListener("click", () => chooseHotspot(choice));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        focusRelativeHotspot(choice, 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        focusRelativeHotspot(choice, -1);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeHotspot(choice.identifier);
      }
    });
    surface.append(button);
  }

  renderState();
  updateSelectionCountSummary();
  group.append(surface, list, summary);
  return group;
}
