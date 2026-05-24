import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  applyGraphicSurfaceLayout,
  applyPointMarkerPlacement,
  appendGraphicObjectImage,
  objectHeight,
  objectWidth,
  readableType,
  responseGroup,
} from "../interaction-support.js";
import { movementButton, movementLabel } from "../movement.js";
import { maximumAllowedResponses } from "../response-limits.js";
import { parsePointValues, pointToString } from "./point-value.js";

export function renderSelectPointResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
): HTMLElement {
  const group = responseGroup();
  group.role = "group";
  group.setAttribute("aria-label", `${readableType(interaction.type)} coordinate response`);
  const isMultiple = interaction.responseCardinality === "multiple";
  const maxPoints = isMultiple ? maximumAllowedResponses(interaction) : 1;

  const surface = document.createElement("button");
  surface.type = "button";
  applyGraphicSurfaceLayout(
    surface,
    objectWidth(interaction),
    objectHeight(interaction),
    "qti3-point-surface",
  );
  surface.setAttribute("aria-label", `${readableType(interaction.type)} coordinate area`);

  const object = interaction.object;
  if (object) {
    appendGraphicObjectImage(surface, object, "");
  }

  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  let points = parsePointValues(currentValue);
  let activeIndex = points.length > 0 ? points.length - 1 : -1;
  const coordinate = document.createElement("output");
  coordinate.className = "qti3-coordinate-output";
  const initialPoint = () => ({
    x: Math.round(width / 2),
    y: Math.round(height / 2),
  });
  const emitValue = (): QtiValue => {
    const values = points.map(pointToString);
    if (isMultiple) return values;
    return values[0] ?? "";
  };
  const commit = () => {
    update(emitValue());
  };
  const syncMarker = () => {
    surface.querySelectorAll(".qti3-point-marker").forEach((marker) => marker.remove());
    if (points.length === 0) {
      coordinate.value = "";
      coordinate.textContent = "No point selected";
      surface.setAttribute("aria-label", `${readableType(interaction.type)} coordinate area`);
      return;
    }
    points.forEach((point, index) => {
      const marker = document.createElement("span");
      marker.className = "qti3-point-marker";
      marker.setAttribute("aria-hidden", "true");
      applyPointMarkerPlacement(
        marker,
        `${(point.x / width) * 100}%`,
        `${(point.y / height) * 100}%`,
      );
      if (index === activeIndex) marker.dataset.active = "true";
      surface.append(marker);
    });
    const text = points.map(pointToString).join("; ");
    coordinate.value = isMultiple
      ? points.map(pointToString).join(" | ")
      : pointToString(points[0]);
    coordinate.textContent = isMultiple
      ? `${points.length} selected point${points.length === 1 ? "" : "s"}: ${text}`
      : `Selected point ${pointToString(points[0])}`;
    surface.setAttribute(
      "aria-label",
      `${readableType(interaction.type)} coordinate area, selected ${text}`,
    );
  };
  const clampPoint = (point: { x: number; y: number }) => {
    point.x = Math.max(0, Math.min(width, point.x));
    point.y = Math.max(0, Math.min(height, point.y));
  };
  const setActivePoint = (point: { x: number; y: number }) => {
    clampPoint(point);
    if (!isMultiple) {
      points = [point];
      activeIndex = 0;
      return;
    }
    if (maxPoints !== undefined && points.length >= maxPoints) {
      points[points.length - 1] = point;
      activeIndex = points.length - 1;
      return;
    }
    points.push(point);
    activeIndex = points.length - 1;
  };
  const mutableActivePoint = () => {
    if (points.length === 0) setActivePoint(initialPoint());
    if (activeIndex < 0 || activeIndex >= points.length) activeIndex = points.length - 1;
    const point = points[activeIndex];
    if (point) return point;
    const fallback = initialPoint();
    points = [fallback];
    activeIndex = 0;
    return fallback;
  };

  surface.addEventListener("click", (event) => {
    if (event.detail === 0) return;
    const rect = surface.getBoundingClientRect();
    setActivePoint({
      x: Math.round(((event.clientX - rect.left) / rect.width) * width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * height),
    });
    syncMarker();
    commit();
  });
  surface.addEventListener("keydown", (event) => {
    const point = mutableActivePoint();
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") point.x -= step;
    else if (event.key === "ArrowRight") point.x += step;
    else if (event.key === "ArrowUp") point.y -= step;
    else if (event.key === "ArrowDown") point.y += step;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit();
      return;
    } else return;

    event.preventDefault();
    clampPoint(point);
    syncMarker();
  });

  syncMarker();
  const controls = document.createElement("div");
  controls.className = "qti3-point-controls";
  for (const [direction, dx, dy] of [
    ["up", 0, -1],
    ["left", -1, 0],
    ["right", 1, 0],
    ["down", 0, 1],
  ] as const) {
    controls.append(
      movementButton(direction, movementLabel("point", direction), () => {
        const point = mutableActivePoint();
        point.x += dx;
        point.y += dy;
        clampPoint(point);
        syncMarker();
        commit();
      }),
    );
  }
  if (isMultiple) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear points";
    clear.addEventListener("click", () => {
      points = [];
      activeIndex = -1;
      syncMarker();
      commit();
    });
    controls.append(clear);
  }
  group.append(surface, coordinate, controls);
  return group;
}
