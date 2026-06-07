import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import { reportMaximumResponseExceeded } from "../inline-validation.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { maximumAllowedResponses } from "../response-limits.js";
import {
  interactionChoices,
  missingChoicesMessage,
  orderChoicesFromValue,
  responseGroup,
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
import {
  firstEmptyOrderSlot,
  orderSlotChoiceIdentifiers,
  placeChoiceInOrderSlot,
  removeChoiceFromOrderSlot,
  restoreOrderSlotsFromValue,
  serializeOrderSlots,
  swapOrderSlots,
  type OrderSlotState,
} from "./order-slots.js";

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
  const orderedSlots: OrderSlotState = restoreOrderSlotsFromValue(choices, currentValue);
  let orderedIdentifiers = orderSlotChoiceIdentifiers(orderedSlots);
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
  const maximum = maximumAllowedResponses(interaction);
  const commit = () => update(serializeOrderSlots(orderedSlots));
  const choiceByIdentifier = (identifier: string | undefined) =>
    identifier === undefined ? undefined : byIdentifier.get(identifier);
  const placeChoice = (identifier: string | undefined, targetIndex: number) => {
    const choice = choiceByIdentifier(identifier);
    if (!choice) return;
    const alreadyPlaced = orderedIdentifiers.has(choice.identifier);
    const targetOccupied = Boolean(orderedSlots[targetIndex]);
    const nextCount =
      alreadyPlaced || targetOccupied ? orderedIdentifiers.size : orderedIdentifiers.size + 1;
    if (maximum !== undefined && nextCount > maximum) {
      reportMaximumResponseExceeded(group, interaction, maximum);
      return;
    }
    const placement = placeChoiceInOrderSlot(orderedSlots, choice, targetIndex);
    if (placement === "noop") return;
    if (placement === "from-bank") {
      summary.textContent = messages.message("orderedItemAddedToPosition", {
        label: choice.text,
        position: targetIndex + 1,
        total: choices.length,
      });
    }
    render();
    commit();
  };
  const removeChoice = (identifier: string) => {
    const choice = removeChoiceFromOrderSlot(orderedSlots, identifier);
    if (!choice) return;
    render();
    summary.textContent = messages.message("orderedItemRemoved", { label: choice.text });
    commit();
  };
  const moveChoice = (from: number, to: number) => {
    const choice = orderedSlots[from];
    if (!swapOrderSlots(orderedSlots, from, to) || !choice) return;
    render();
    announceOrderedItemMove(
      summary,
      messages,
      choice.text,
      to,
      choices.length,
      from,
      layout.orientation,
    );
    commit();
    focusReorderControl(targetList, choice.identifier);
  };
  const render = () => {
    orderedIdentifiers = orderSlotChoiceIdentifiers(orderedSlots);
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
            placeChoice(choice.identifier, firstEmptyOrderSlot(orderedSlots)),
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
    const choice = orderedSlots[index];
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
    if (visibleLabel) {
      const label = document.createElement("span");
      label.className = "qti3-order-target-label";
      label.textContent = visibleLabel;
      slot.append(label);
    }

    if (!choice) {
      const empty = document.createElement("span");
      empty.className = "qti3-order-target-empty";
      empty.textContent = visibleLabel
        ? messages.message("orderTargetEmptyState")
        : messages.message("orderTargetEmpty", {
            label: messages.message("orderTargetLabel", { index: index + 1 }),
          });
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
      total: choices.length,
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
