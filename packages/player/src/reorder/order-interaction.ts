import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { QtiPlayerMessages } from "../player-messages.js";
import {
  interactionChoices,
  missingChoicesMessage,
  orderChoicesFromValue,
  responseGroup,
} from "../interaction-support.js";
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
  messages: QtiPlayerMessages,
): HTMLElement {
  const group = responseGroup();
  const choices = interactionChoices(interaction).filter((choice) => choice.role !== "gap");
  if (choices.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const ordered = orderChoicesFromValue(choices, currentValue);
  const list = document.createElement("ol");
  list.className = "qti3-reorder-list";
  list.setAttribute(
    "aria-label",
    messages.interactionCurrentOrderList({ type: interaction.type }),
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
    announceOrderedItemMove(summary, messages, choice.text, to, ordered.length, from);
    commit();
    focusReorderControl(list, choice.identifier);
  };
  const renderList = () => {
    list.replaceChildren(
      ...ordered.map((choice, index) => {
        const item = document.createElement("li");
        item.className = "qti3-reorder-item";
        bindOrderListItemDrag(item, choice.identifier, index, dragState, moveChoice, findIndex);

        const { handle, up, down } = createReorderHandleControls({
          identifier: choice.identifier,
          label: choice.text,
          index,
          total: ordered.length,
          handleClassName: "qti3-token qti3-reorder-handle",
          visibleText: choice.text,
          messages,
          onMoveBy: (delta) => moveChoice(index, index + delta),
        });

        item.append(handle, up, down);
        return item;
      }),
    );
  };
  renderList();
  group.append(list, summary);
  return group;
}
