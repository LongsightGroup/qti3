import type { OrderOrientation } from "./interactions/shared-vocabulary.js";
import { inlineIcon } from "./icons.js";

export type MovementDirection = "up" | "down" | "left" | "right";

export function reorderMovementDirections(orientation: OrderOrientation): {
  previous: MovementDirection;
  next: MovementDirection;
} {
  return orientation === "horizontal"
    ? { previous: "left", next: "right" }
    : { previous: "up", next: "down" };
}

export function reorderStepDirection(
  orientation: OrderOrientation,
  from: number,
  to: number,
): MovementDirection {
  const { previous, next } = reorderMovementDirections(orientation);
  return to < from ? previous : next;
}

const movementIconPaths: Record<MovementDirection, string[]> = {
  up: ["M12 5l0 14", "M18 11l-6 -6", "M6 11l6 -6"],
  down: ["M12 5l0 14", "M18 13l-6 6", "M6 13l6 6"],
  left: ["M5 12l14 0", "M5 12l6 6", "M5 12l6 -6"],
  right: ["M5 12l14 0", "M13 18l6 -6", "M13 6l6 6"],
};

function movementIcon(direction: MovementDirection): SVGSVGElement {
  return inlineIcon("qti3-movement-icon", movementIconPaths[direction]);
}

export function movementButton(
  direction: MovementDirection,
  accessibleName: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-icon-button qti3-move-button";
  button.dataset.moveDirection = direction;
  button.setAttribute("aria-label", accessibleName);
  button.append(movementIcon(direction));
  button.addEventListener("click", onClick);
  return button;
}
