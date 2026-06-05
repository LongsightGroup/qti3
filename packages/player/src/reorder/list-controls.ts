import { movementButton, reorderMovementDirections } from "../movement.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import type { OrderOrientation } from "../interactions/shared-vocabulary.js";
import { orderedItemAccessibleName } from "./a11y.js";

export interface ReorderHandleOptions {
  identifier: string;
  label: string;
  index: number;
  total: number;
  handleClassName: string;
  visibleText: string;
  orientation: OrderOrientation;
  messages: PlayerMessageResolver;
  onMoveBy: (delta: number) => void;
}

export function createReorderHandleControls(options: ReorderHandleOptions): {
  handle: HTMLButtonElement;
  movePrevious: HTMLButtonElement;
  moveNext: HTMLButtonElement;
} {
  const {
    identifier,
    label,
    index,
    total,
    handleClassName,
    visibleText,
    orientation,
    messages,
    onMoveBy,
  } = options;
  const { previous: previousDirection, next: nextDirection } =
    reorderMovementDirections(orientation);

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = handleClassName;
  handle.dataset.choiceIdentifier = identifier;
  handle.setAttribute("aria-label", orderedItemAccessibleName(messages, label, index, total));
  handle.textContent = visibleText;
  // Accept both axis pairs on the handle so keyboard users are not locked to one arrow set.
  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onMoveBy(-1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onMoveBy(1);
    }
  });

  const movePrevious = movementButton(
    previousDirection,
    messages.message("moveChoice", { label, direction: previousDirection }),
    () => onMoveBy(-1),
  );
  movePrevious.disabled = index === 0;

  const moveNext = movementButton(
    nextDirection,
    messages.message("moveChoice", { label, direction: nextDirection }),
    () => onMoveBy(1),
  );
  moveNext.disabled = index === total - 1;

  return { handle, movePrevious, moveNext };
}

export interface OrderDragState {
  draggedIdentifier?: string;
  pointerDraggedIdentifier?: string;
}

export function bindOrderListItemDrag(
  item: HTMLLIElement,
  choiceIdentifier: string,
  index: number,
  dragState: OrderDragState,
  moveChoice: (from: number, to: number) => void,
  findIndex: (identifier: string) => number,
): void {
  item.draggable = true;
  item.dataset.choiceIdentifier = choiceIdentifier;

  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    dragState.pointerDraggedIdentifier = choiceIdentifier;
    try {
      item.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and some browser drag paths do not create a capturable pointer.
    }
  });

  item.addEventListener("pointerup", (event) => {
    if (!dragState.pointerDraggedIdentifier) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".qti3-reorder-item");
    const targetIdentifier = target?.dataset.choiceIdentifier;
    delete dragState.pointerDraggedIdentifier;
    if (!targetIdentifier) return;
    moveChoice(findIndex(choiceIdentifier), findIndex(targetIdentifier));
  });

  item.addEventListener("pointercancel", () => {
    delete dragState.pointerDraggedIdentifier;
  });

  item.addEventListener("dragstart", (event) => {
    dragState.draggedIdentifier = choiceIdentifier;
    event.dataTransfer?.setData("text/plain", choiceIdentifier);
    event.dataTransfer?.setDragImage(item, 12, 12);
  });

  item.addEventListener("dragover", (event) => {
    event.preventDefault();
    item.classList.add("qti3-drop-target");
  });

  item.addEventListener("dragleave", () => item.classList.remove("qti3-drop-target"));

  item.addEventListener("drop", (event) => {
    event.preventDefault();
    item.classList.remove("qti3-drop-target");
    const dragged = event.dataTransfer?.getData("text/plain") || dragState.draggedIdentifier;
    if (!dragged) return;
    moveChoice(findIndex(dragged), index);
  });
}
