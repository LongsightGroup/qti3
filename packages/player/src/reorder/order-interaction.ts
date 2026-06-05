import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  interactionChoices,
  missingChoicesMessage,
  orderChoicesFromValue,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import { appendChoiceVisual, setChoiceAccessibleName } from "../interactions/shared.js";
import {
  orderSharedVocabularyLayout,
  plainOrderOrientation,
  sharedVocabularyLabel,
  type OrderSharedVocabularyLayout,
} from "../interactions/shared-vocabulary.js";
import { announceOrderedItemMove, createSelectionSummary, focusReorderControl } from "./a11y.js";
import {
  bindOrderListItemDrag,
  createReorderHandleControls,
  type OrderDragState,
} from "./list-controls.js";

export function renderOrderedResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup();
  const choices = interactionChoices(interaction).filter((choice) => choice.role !== "gap");
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const sharedVocabularyLayout = orderSharedVocabularyLayout(interaction);
  if (sharedVocabularyLayout !== undefined) {
    return renderSharedVocabularyOrderResponse(
      interaction,
      choices,
      sharedVocabularyLayout,
      update,
      currentValue,
      messages,
    );
  }
  const ordered = orderChoicesFromValue(choices, currentValue);
  // Plain order lists honor orientation with a vertical default when none is authored.
  const orientation = plainOrderOrientation(interaction);
  const list = document.createElement("ol");
  list.className = "qti3-reorder-list";
  list.dataset.qtiOrderOrientation = orientation;
  list.setAttribute(
    "aria-label",
    messages.message("interactionCurrentOrderList", { type: interaction.type }),
  );
  const summary = createSelectionSummary();
  const dragState: OrderDragState = {};

  const commit = () => update(ordered.map((choice) => choice.identifier));
  const findIndex = (identifier: string) =>
    ordered.findIndex((entry) => entry.identifier === identifier);
  const moveChoice = (from: number, to: number) => {
    if (from === to || from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) return;
    const [choice] = ordered.splice(from, 1);
    if (!choice) return;
    ordered.splice(to, 0, choice);
    renderList();
    announceOrderedItemMove(summary, messages, choice.text, to, ordered.length, from, orientation);
    commit();
    focusReorderControl(list, choice.identifier);
  };
  const renderList = () => {
    list.replaceChildren(
      ...ordered.map((choice, index) => {
        const item = document.createElement("li");
        item.className = "qti3-reorder-item";
        bindOrderListItemDrag(item, choice.identifier, index, dragState, moveChoice, findIndex);

        const { handle, movePrevious, moveNext } = createReorderHandleControls({
          identifier: choice.identifier,
          label: choice.text,
          index,
          total: ordered.length,
          handleClassName: "qti3-token qti3-reorder-handle",
          visibleText: choice.text,
          orientation,
          messages,
          onMoveBy: (delta) => moveChoice(index, index + delta),
        });

        item.append(handle, movePrevious, moveNext);
        return item;
      }),
    );
  };
  renderList();
  group.append(list, summary);
  return group;
}

function renderSharedVocabularyOrderResponse(
  interaction: QtiInteraction,
  choices: QtiChoice[],
  layout: OrderSharedVocabularyLayout,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup("qti3-order-sv-group");
  const byIdentifier = new Map(choices.map((choice) => [choice.identifier, choice]));
  const ordered: QtiChoice[] = [];
  const restoredIdentifiers = new Set<string>();
  for (const identifier of valueToStrings(currentValue)) {
    const choice = byIdentifier.get(identifier);
    if (!choice || restoredIdentifiers.has(choice.identifier)) continue;
    restoredIdentifiers.add(choice.identifier);
    ordered.push(choice);
  }
  const orderedIdentifiers = new Set(ordered.map((choice) => choice.identifier));
  const summary = createSelectionSummary();
  const layoutElement = document.createElement("div");
  layoutElement.className = "qti3-order-sv-layout";
  layoutElement.dataset.qtiChoicesPosition = layout.choicesPosition;
  layoutElement.dataset.qtiOrderOrientation = layout.orientation;
  if (layout.choicesContainerWidth !== undefined) {
    layoutElement.style.setProperty(
      "--qti3-order-choices-container-width",
      `${layout.choicesContainerWidth}px`,
    );
  }

  const choicesBank = document.createElement("div");
  choicesBank.className = "qti3-token-region qti3-order-choices-bank";
  if (layout.choicesContainerWidth !== undefined) {
    choicesBank.dataset.qtiChoicesContainerWidth = String(layout.choicesContainerWidth);
  }
  choicesBank.role = "group";
  choicesBank.setAttribute(
    "aria-label",
    messages.message("interactionChoicesBank", { type: interaction.type }),
  );
  const targetList = document.createElement("ol");
  targetList.className = "qti3-order-target-list";
  targetList.setAttribute(
    "aria-label",
    messages.message("interactionSelectedOrderList", { type: interaction.type }),
  );

  let draggedIdentifier: string | undefined;
  const commit = () => update(ordered.map((choice) => choice.identifier));
  const choiceByIdentifier = (identifier: string | undefined) =>
    identifier === undefined ? undefined : byIdentifier.get(identifier);
  const firstEmptyTarget = () => ordered.length;
  // QTI ordered responses are dense identifier arrays, while this UI renders fixed visual slots.
  // Non-adjacent empty-slot drops are ignored because holes cannot survive serialize/restore.
  const placeChoice = (identifier: string | undefined, targetIndex: number) => {
    const choice = choiceByIdentifier(identifier);
    if (!choice) return;
    const from = ordered.findIndex((entry) => entry.identifier === choice.identifier);
    if (targetIndex > ordered.length) return;
    const boundedTarget = Math.max(0, targetIndex);
    if (from >= 0) {
      if (from === boundedTarget) return;
      const adjustedTarget = from < boundedTarget ? boundedTarget - 1 : boundedTarget;
      if (from === adjustedTarget) return;
      ordered.splice(from, 1);
      ordered.splice(adjustedTarget, 0, choice);
    } else if (ordered.length < choices.length) {
      ordered.splice(boundedTarget, 0, choice);
      summary.textContent = messages.message("orderedItemAddedToPosition", {
        label: choice.text,
        position: boundedTarget + 1,
        total: choices.length,
      });
    }
    render();
    commit();
  };
  const removeChoice = (identifier: string) => {
    const index = ordered.findIndex((entry) => entry.identifier === identifier);
    const [choice] = index >= 0 ? ordered.splice(index, 1) : [];
    if (!choice) return;
    render();
    summary.textContent = messages.message("orderedItemRemoved", { label: choice.text });
    commit();
  };
  const moveChoice = (from: number, to: number) => {
    if (from === to || from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) return;
    const [choice] = ordered.splice(from, 1);
    if (!choice) return;
    ordered.splice(to, 0, choice);
    render();
    announceOrderedItemMove(
      summary,
      messages,
      choice.text,
      to,
      ordered.length,
      from,
      layout.orientation,
    );
    commit();
    focusReorderControl(targetList, choice.identifier);
  };
  const render = () => {
    orderedIdentifiers.clear();
    for (const choice of ordered) orderedIdentifiers.add(choice.identifier);
    choicesBank.replaceChildren(
      ...choices
        .filter((choice) => !orderedIdentifiers.has(choice.identifier))
        .map((choice) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "qti3-token qti3-order-choice";
          button.dataset.choiceIdentifier = choice.identifier;
          button.draggable = true;
          setChoiceAccessibleName(button, choice);
          appendChoiceVisual(button, choice);
          button.addEventListener("click", () =>
            placeChoice(choice.identifier, firstEmptyTarget()),
          );
          button.addEventListener("dragstart", (event) => {
            draggedIdentifier = choice.identifier;
            event.dataTransfer?.setData("text/plain", choice.identifier);
          });
          return button;
        }),
    );
    targetList.replaceChildren(
      ...Array.from({ length: choices.length }, (_, index) => renderTargetSlot(index)),
    );
  };
  const renderTargetSlot = (index: number) => {
    const choice = ordered[index];
    const slot = document.createElement("li");
    slot.className = "qti3-order-target-slot";
    slot.dataset.targetIndex = String(index);
    slot.dataset.empty = choice ? "false" : "true";
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("qti3-drop-target");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("qti3-drop-target"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("qti3-drop-target");
      placeChoice(event.dataTransfer?.getData("text/plain") || draggedIdentifier, index);
      draggedIdentifier = undefined;
    });

    const visibleLabel = sharedVocabularyLabel(interaction, index);
    const accessibleLabel =
      visibleLabel || messages.message("orderTargetLabel", { index: index + 1 });
    if (visibleLabel) {
      const label = document.createElement("span");
      label.className = "qti3-order-target-label";
      label.textContent = visibleLabel;
      slot.append(label);
    }

    if (!choice) {
      const empty = document.createElement("span");
      empty.className = "qti3-order-target-empty";
      empty.textContent = messages.message("orderTargetEmpty", { label: accessibleLabel });
      slot.append(empty);
      return slot;
    }

    const item = document.createElement("div");
    item.className = "qti3-reorder-item qti3-order-target-item";
    item.dataset.choiceIdentifier = choice.identifier;
    item.draggable = true;
    item.addEventListener("dragstart", (event) => {
      draggedIdentifier = choice.identifier;
      event.dataTransfer?.setData("text/plain", choice.identifier);
    });
    const { handle, movePrevious, moveNext } = createReorderHandleControls({
      identifier: choice.identifier,
      label: choice.text,
      index,
      total: ordered.length,
      handleClassName: "qti3-token qti3-reorder-handle",
      visibleText: choice.text,
      orientation: layout.orientation,
      messages,
      onMoveBy: (delta) => moveChoice(index, index + delta),
    });
    const remove = removeButton(choice.text, messages, "removeOrderedChoice");
    remove.addEventListener("click", () => removeChoice(choice.identifier));
    item.append(handle, movePrevious, moveNext, remove);
    slot.append(item);
    return slot;
  };

  render();
  if (layout.choicesPosition === "bottom" || layout.choicesPosition === "right") {
    layoutElement.append(targetList, choicesBank);
  } else {
    layoutElement.append(choicesBank, targetList);
  }
  group.append(layoutElement, summary);
  return group;
}
