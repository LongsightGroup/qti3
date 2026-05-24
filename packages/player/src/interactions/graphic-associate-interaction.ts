import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  interactionChoices,
  missingChoicesMessage,
  hotspotAccessibleLabel,
  hotspotCenter,
  hotspotDisplayLabel,
  objectHeight,
  objectWidth,
  placeHotspotButton,
  readableType,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import type { QtiPlayerMessages } from "../player-messages.js";
import { exceedsHotspotMatchMax, maximumAllowedResponses } from "../response-limits.js";

export function renderGraphicAssociateResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: QtiPlayerMessages,
): HTMLElement {
  const group = responseGroup();

  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  const choices = interactionChoices(interaction).filter((choice) => choice.role === "hotspot");
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const selectedPairs = valueToStrings(currentValue);
  const maximumAssociations =
    interaction.responseCardinality === "single" ? 1 : maximumAllowedResponses(interaction);
  let selectedHotspot: QtiChoice | undefined;
  let draggedHotspot: QtiChoice | undefined;
  let dragPointerId: number | undefined;
  let dragStart: { x: number; y: number } | undefined;
  let dragStarted = false;
  let suppressNextClick = false;
  let previewLine: SVGLineElement | undefined;

  const surface = document.createElement("div");
  applyGraphicSurfaceLayout(surface, width, height, "qti3-graphic-associate-surface");
  surface.role = "group";
  surface.setAttribute("aria-label", `${readableType(interaction.type)} hotspots`);

  const object = interaction.object;
  if (object) {
    appendGraphicObjectImage(
      surface,
      object,
      object.text || `${readableType(interaction.type)} image`,
    );
  }

  const connections = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  connections.classList.add("qti3-graphic-associate-lines");
  connections.setAttribute("viewBox", `0 0 ${width} ${height}`);
  connections.setAttribute("aria-hidden", "true");
  surface.append(connections);

  const summary = document.createElement("p");
  summary.className = "qti3-selection-summary";
  summary.setAttribute("aria-live", "polite");
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute("aria-label", `${readableType(interaction.type)} selected pairs`);

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };
  const removePair = (pair: string) => {
    const index = selectedPairs.indexOf(pair);
    if (index < 0) return;
    selectedPairs.splice(index, 1);
    renderState();
    commit();
  };
  const removePairsForHotspot = (identifier: string) => {
    let removed = false;
    for (let index = selectedPairs.length - 1; index >= 0; index -= 1) {
      const [source, target] = selectedPairs[index]?.split(" ") ?? [];
      if (source === identifier || target === identifier) {
        selectedPairs.splice(index, 1);
        removed = true;
      }
    }
    if (!removed) return;
    renderState();
    commit();
  };
  const addPair = (source: QtiChoice, target: QtiChoice) => {
    if (source.identifier === target.identifier) {
      selectedHotspot = undefined;
      renderState();
      return;
    }
    const pair = `${source.identifier} ${target.identifier}`;
    if (!selectedPairs.includes(pair)) {
      if (interaction.responseCardinality === "single") selectedPairs.splice(0);
      if (
        maximumAssociations !== undefined &&
        selectedPairs.length >= maximumAssociations &&
        interaction.responseCardinality !== "single"
      ) {
        selectedHotspot = undefined;
        renderState();
        return;
      }
      if (
        exceedsHotspotMatchMax(source, selectedPairs) ||
        exceedsHotspotMatchMax(target, selectedPairs)
      ) {
        selectedHotspot = undefined;
        renderState();
        return;
      }
      selectedPairs.push(pair);
    }
    selectedHotspot = undefined;
    renderState();
    commit();
  };
  const authoredPointFromPointer = (event: PointerEvent) => {
    const rect = surface.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width, ((event.clientX - rect.left) / rect.width) * width)),
      y: Math.max(0, Math.min(height, ((event.clientY - rect.top) / rect.height) * height)),
    };
  };
  const removePreviewLine = () => {
    previewLine?.remove();
    previewLine = undefined;
  };
  const suppressFollowingClick = () => {
    suppressNextClick = true;
    setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  };
  const updatePreviewLine = (source: QtiChoice, event: PointerEvent) => {
    const start = hotspotCenter(source, width, height);
    const end = authoredPointFromPointer(event);
    if (!previewLine) {
      previewLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      previewLine.dataset.preview = "true";
      connections.append(previewLine);
    }
    previewLine.setAttribute("x1", String(start.x));
    previewLine.setAttribute("y1", String(start.y));
    previewLine.setAttribute("x2", String(end.x));
    previewLine.setAttribute("y2", String(end.y));
  };
  const hotspotFromPointer = (event: PointerEvent) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const button = element?.closest<HTMLButtonElement>(".qti3-graphic-associate-hotspot");
    const identifier = button?.dataset.choiceIdentifier;
    return choices.find((choice) => choice.identifier === identifier);
  };
  const finishDrag = (event: PointerEvent, source: QtiChoice) => {
    const target = hotspotFromPointer(event);
    removePreviewLine();
    if (target) {
      addPair(source, target);
      return;
    }
    selectedHotspot = undefined;
    renderState();
  };
  const chooseHotspot = (choice: QtiChoice) => {
    if (!selectedHotspot) {
      selectedHotspot = choice;
      renderState();
      return;
    }
    addPair(selectedHotspot, choice);
  };
  const focusRelativeHotspot = (choice: QtiChoice, delta: number) => {
    const index = choices.findIndex((entry) => entry.identifier === choice.identifier);
    const next = choices[(index + delta + choices.length) % choices.length];
    if (!next) return;
    surface
      .querySelector<HTMLButtonElement>(`[data-choice-identifier="${next.identifier}"]`)
      ?.focus();
  };
  const renderState = () => {
    connections.replaceChildren(
      ...selectedPairs.flatMap((pair) => {
        const [sourceIdentifier, targetIdentifier] = pair.split(" ");
        const source = choices.find((choice) => choice.identifier === sourceIdentifier);
        const target = choices.find((choice) => choice.identifier === targetIdentifier);
        if (!source || !target) return [];
        const start = hotspotCenter(source, width, height);
        const end = hotspotCenter(target, width, height);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        return [line];
      }),
    );
    for (const button of surface.querySelectorAll<HTMLButtonElement>(".qti3-hotspot-button")) {
      const identifier = button.dataset.choiceIdentifier ?? "";
      const isActive = identifier === selectedHotspot?.identifier;
      const isPaired = selectedPairs.some((pair) => pair.split(" ").includes(identifier));
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.dataset.selected = isActive || isPaired ? "true" : "false";
    }
    summary.textContent = selectedHotspot
      ? `${hotspotDisplayLabel(selectedHotspot, choices)} selected. Choose another hotspot.`
      : selectedPairs.length > 0
        ? `${selectedPairs.length} ${selectedPairs.length === 1 ? "association" : "associations"} made.`
        : "No associations made";
    pairList.replaceChildren(
      ...selectedPairs.map((pair) => {
        const [source, target] = pair.split(" ");
        const sourceChoice = choices.find((choice) => choice.identifier === source);
        const targetChoice = choices.find((choice) => choice.identifier === target);
        const pairLabel = `${sourceChoice ? hotspotDisplayLabel(sourceChoice, choices) : source} to ${targetChoice ? hotspotDisplayLabel(targetChoice, choices) : target}`;
        const item = document.createElement("li");
        item.className = "qti3-pair-chip";
        const text = document.createElement("span");
        text.textContent = pairLabel;
        const remove = removeButton(pairLabel, messages);
        remove.addEventListener("click", () => removePair(pair));
        item.append(text, remove);
        return item;
      }),
    );
  };

  for (const [index, choice] of choices.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button qti3-graphic-associate-hotspot";
    button.dataset.choiceIdentifier = choice.identifier;
    button.textContent = hotspotDisplayLabel(choice, choices);
    button.title = hotspotAccessibleLabel(choice, index);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", hotspotAccessibleLabel(choice, index));
    placeHotspotButton(button, choice, width, height);
    button.addEventListener("click", (event) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        event.preventDefault();
        return;
      }
      chooseHotspot(choice);
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      draggedHotspot = choice;
      dragPointerId = event.pointerId;
      dragStart = { x: event.clientX, y: event.clientY };
      dragStarted = false;
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      if (dragPointerId !== event.pointerId || !draggedHotspot || !dragStart) return;
      const moved = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
      if (!dragStarted && moved < 4) return;
      if (!dragStarted) {
        dragStarted = true;
        suppressFollowingClick();
        selectedHotspot = draggedHotspot;
        renderState();
      }
      updatePreviewLine(draggedHotspot, event);
      event.preventDefault();
    });
    button.addEventListener("pointerup", (event) => {
      if (dragPointerId !== event.pointerId || !draggedHotspot) return;
      const source = draggedHotspot;
      draggedHotspot = undefined;
      dragPointerId = undefined;
      dragStart = undefined;
      button.releasePointerCapture(event.pointerId);
      if (!dragStarted) return;
      dragStarted = false;
      suppressFollowingClick();
      finishDrag(event, source);
      event.preventDefault();
    });
    button.addEventListener("pointercancel", (event) => {
      if (dragPointerId !== event.pointerId) return;
      draggedHotspot = undefined;
      dragPointerId = undefined;
      dragStart = undefined;
      dragStarted = false;
      removePreviewLine();
      selectedHotspot = undefined;
      renderState();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        focusRelativeHotspot(choice, 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        focusRelativeHotspot(choice, -1);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removePairsForHotspot(choice.identifier);
      }
    });
    surface.append(button);
  }

  renderState();
  group.append(surface, summary, pairList);
  return group;
}
