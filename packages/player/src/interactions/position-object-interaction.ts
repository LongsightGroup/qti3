import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { applyGraphicSurfaceLayout, applyPointMarkerPlacement, applyPositionObjectMarkerPlacement, applyPositionObjectMarkerSize, appendGraphicObjectImage, objectIsImage, percent, readableType, responseGroup } from "../interaction-support.js";
import { movementButton, movementLabel } from "../movement.js";
import {
  objectAssetHeight,
  objectAssetWidth,
  parsePointValue,
  pointToString,
} from "./point-value.js";

export function renderPositionObjectResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
): HTMLElement {
  const group = responseGroup();
  group.role = "group";
  group.setAttribute("aria-label", `${readableType(interaction.type)} object placement response`);

  const stageObject = interaction.positionObjectStage ?? interaction.object;
  const movableObject = interaction.positionObjectStage ? interaction.object : undefined;
  const width = objectAssetWidth(stageObject, 480);
  const height = objectAssetHeight(stageObject, 300);
  const movableWidth = objectAssetWidth(movableObject, Math.max(32, Math.round(width * 0.12)));
  const movableHeight = objectAssetHeight(movableObject, Math.max(32, Math.round(height * 0.12)));
  const parsedPoint = parsePointValue(currentValue);
  let point = parsedPoint ?? { x: 0, y: 0 };
  let isPlaced = Boolean(parsedPoint);

  const stage = document.createElement("div");
  applyGraphicSurfaceLayout(stage, width, height, "qti3-position-object-stage");
  stage.style.setProperty("--qti3-position-object-marker-block-size", `${movableHeight}px`);
  stage.tabIndex = 0;
  stage.role = "group";
  stage.setAttribute("aria-label", `${readableType(interaction.type)} placement stage`);

  if (stageObject?.data && objectIsImage(stageObject)) {
    appendGraphicObjectImage(stage, stageObject, stageObject.text || "");
  }

  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "qti3-position-object-marker";
  marker.setAttribute("aria-label", "Movable object");
  applyPositionObjectMarkerSize(marker, movableWidth, movableHeight);
  marker.draggable = false;

  if (movableObject?.data && objectIsImage(movableObject)) {
    const image = document.createElement("img");
    image.src = movableObject.data;
    image.alt = "";
    marker.append(image);
  } else {
    marker.textContent = "Place";
  }
  stage.append(marker);

  const coordinate = document.createElement("output");
  coordinate.className = "qti3-coordinate-output";
  const clamp = () => {
    point.x = Math.max(0, Math.min(width, point.x));
    point.y = Math.max(0, Math.min(height, point.y));
  };
  const commit = () => {
    if (!isPlaced) return;
    update(pointToString(point));
  };
  const syncMarker = () => {
    if (!isPlaced) {
      marker.dataset.placed = "false";
      marker.style.removeProperty("insetInlineStart");
      marker.style.removeProperty("insetBlockStart");
      marker.style.setProperty(
        "--qti3-position-object-unplaced-inline-start",
        `${Math.round(movableWidth / 2)}px`,
      );
      marker.style.setProperty(
        "--qti3-position-object-unplaced-block-start",
        `calc(100% + ${Math.round(movableHeight / 2 + 8)}px)`,
      );
      coordinate.value = "";
      coordinate.textContent = "Object not placed";
      stage.setAttribute(
        "aria-label",
        `${readableType(interaction.type)} placement stage, object not placed`,
      );
      return;
    }
    clamp();
    marker.dataset.placed = "true";
    marker.style.removeProperty("--qti3-position-object-unplaced-inline-start");
    marker.style.removeProperty("--qti3-position-object-unplaced-block-start");
    applyPositionObjectMarkerPlacement(
      marker,
      `${percent(point.x, width)}%`,
      `${percent(point.y, height)}%`,
    );
    coordinate.value = pointToString(point);
    coordinate.textContent = `Object positioned at ${pointToString(point)}`;
    stage.setAttribute(
      "aria-label",
      `${readableType(interaction.type)} placement stage, object at ${pointToString(point)}`,
    );
  };
  const pointFromPointer = (event: MouseEvent | PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    point = {
      x: Math.round(((event.clientX - rect.left) / rect.width) * width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * height),
    };
    isPlaced = true;
    clamp();
  };
  const ensureKeyboardPoint = () => {
    if (isPlaced) return;
    point = { x: 0, y: 0 };
    isPlaced = true;
  };
  const moveBy = (dx: number, dy: number, emit = true) => {
    ensureKeyboardPoint();
    point.x += dx;
    point.y += dy;
    syncMarker();
    if (emit) commit();
  };
  const handleKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") moveBy(-step, 0, false);
    else if (event.key === "ArrowRight") moveBy(step, 0, false);
    else if (event.key === "ArrowUp") moveBy(0, -step, false);
    else if (event.key === "ArrowDown") moveBy(0, step, false);
    else if (event.key === "Enter" || event.key === " ") {
      ensureKeyboardPoint();
      syncMarker();
      commit();
    } else return;
    event.preventDefault();
  };

  let dragging = false;
  let dragMoved = false;
  marker.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragMoved = false;
    marker.dataset.dragging = "true";
    marker.setPointerCapture(event.pointerId);
    if (isPlaced) {
      pointFromPointer(event);
      syncMarker();
    }
    event.preventDefault();
  });
  marker.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    dragMoved = true;
    pointFromPointer(event);
    syncMarker();
  });
  marker.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    delete marker.dataset.dragging;
    marker.releasePointerCapture(event.pointerId);
    if (dragMoved || isPlaced) {
      pointFromPointer(event);
      syncMarker();
      commit();
    }
  });
  marker.addEventListener("pointercancel", () => {
    dragging = false;
    delete marker.dataset.dragging;
  });
  stage.addEventListener("click", (event) => {
    if (event.target === marker) return;
    pointFromPointer(event);
    syncMarker();
    commit();
  });
  stage.addEventListener("keydown", handleKey);
  marker.addEventListener("keydown", handleKey);

  const controls = document.createElement("div");
  controls.className = "qti3-point-controls";
  for (const [direction, dx, dy] of [
    ["up", 0, -1],
    ["left", -1, 0],
    ["right", 1, 0],
    ["down", 0, 1],
  ] as const) {
    controls.append(
      movementButton(direction, movementLabel("object", direction), () => moveBy(dx, dy)),
    );
  }

  syncMarker();
  group.append(stage, coordinate, controls);
  return group;
}
