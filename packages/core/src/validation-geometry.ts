import type { QtiChoice, QtiDiagnostic, QtiInteraction } from "./types.js";
import { assertNever } from "./assert-never.js";
import { numericTuple3, numericTuple4 } from "./parser-values.js";
import { isFiniteNumber } from "./validation-primitives.js";

export function validateHotspotGeometry(choice: QtiChoice, diagnostics: QtiDiagnostic[]): void {
  if (choice.qtiName !== "qti-hotspot-choice" && choice.qtiName !== "qti-associable-hotspot") {
    return;
  }

  const shape = choice.attributes.shape;
  const coords = choice.attributes.coords;
  if (!shape) {
    diagnostics.push({
      code: "choice.shape.required",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires shape.`,
      path: choice.source?.path,
      source: choice.source,
    });
  } else if (!isHotspotShape(shape)) {
    diagnostics.push({
      code: "choice.shape",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} has unsupported shape ${shape}.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }

  if (!coords) {
    diagnostics.push({
      code: "choice.coords.required",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires coords.`,
      path: choice.source?.path,
      source: choice.source,
    });
    return;
  }

  const values = coords.split(",").map((value) => value.trim());
  if (values.length === 0 || values.some((value) => value.length === 0 || !isFiniteNumber(value))) {
    diagnostics.push({
      code: "choice.coords",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires comma-separated numeric coords.`,
      path: choice.source?.path,
      source: choice.source,
    });
    return;
  }

  if (shape && isHotspotShape(shape) && !hasValidShapeCoordinateCount(shape, values.map(Number))) {
    diagnostics.push({
      code: "choice.coords.shape",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} shape ${shape} has invalid coords arity.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }
}

export function validateGraphicHotspotObjectDimensions(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  if (!usesGraphicHotspots(interaction)) return;
  const hotspotChoices = interaction.choices.filter(isHotspotChoice);
  if (hotspotChoices.length === 0) return;

  const width = positiveDimension(interaction.object?.width);
  const height = positiveDimension(interaction.object?.height);
  if (width === undefined || height === undefined) {
    diagnostics.push({
      code: "interaction.graphicObjectDimensions",
      severity: "warning",
      message: `${interaction.qtiName} should declare object width and height so hotspot coords map to the rendered image.`,
      path: interaction.object?.source?.path ?? interaction.source?.path,
      source: interaction.object?.source ?? interaction.source,
    });
    return;
  }

  for (const choice of hotspotChoices) {
    const bounds = hotspotBounds(choice);
    if (!bounds) continue;
    if (bounds.left >= 0 && bounds.top >= 0 && bounds.right <= width && bounds.bottom <= height) {
      continue;
    }
    diagnostics.push({
      code: "choice.coords.bounds",
      severity: "warning",
      message: `${choice.qtiName} ${choice.identifier} coords extend outside the ${width} by ${height} object image.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }
}

function usesGraphicHotspots(interaction: QtiInteraction): boolean {
  return (
    interaction.type === "graphicOrder" ||
    interaction.type === "graphicAssociate" ||
    interaction.type === "graphicGapMatch" ||
    interaction.type === "hotspot"
  );
}

function isHotspotChoice(choice: QtiChoice): boolean {
  return choice.qtiName === "qti-hotspot-choice" || choice.qtiName === "qti-associable-hotspot";
}

function positiveDimension(value: string | undefined): number | undefined {
  if (!value || value.trim().endsWith("%")) return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(?:px)?$/i);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function hotspotBounds(
  choice: QtiChoice,
): { left: number; top: number; right: number; bottom: number } | undefined {
  const shape = choice.attributes.shape;
  const coords = choice.attributes.coords;
  if (!shape || !coords || !isHotspotShape(shape) || !isNumericCsv(coords)) return undefined;
  const values = numericCsv(coords);
  if (!hasValidShapeCoordinateCount(shape, values)) return undefined;

  if (shape === "default") return undefined;
  if (shape === "circle") {
    const tuple = numericTuple3(values);
    if (!tuple) return undefined;
    const [x, y, radius] = tuple;
    return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
  }
  if (shape === "ellipse") {
    const tuple = numericTuple4(values);
    if (!tuple) return undefined;
    const [x, y, radiusX, radiusY] = tuple;
    return { left: x - radiusX, top: y - radiusY, right: x + radiusX, bottom: y + radiusY };
  }
  if (shape === "rect") {
    const tuple = numericTuple4(values);
    if (!tuple) return undefined;
    const [left, top, right, bottom] = tuple;
    return { left, top, right, bottom };
  }

  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

type QtiHotspotShape = "circle" | "default" | "ellipse" | "poly" | "rect";

function isHotspotShape(value: string): value is QtiHotspotShape {
  return (
    value === "circle" ||
    value === "default" ||
    value === "ellipse" ||
    value === "poly" ||
    value === "rect"
  );
}

export function isAreaShape(value: string): boolean {
  return value === "circle" || value === "default" || value === "poly" || value === "rect";
}

export function isNumericCsv(value: string): boolean {
  return value
    .split(",")
    .map((part) => part.trim())
    .every((part) => part.length > 0 && isFiniteNumber(part));
}

export function numericCsv(value: string): number[] {
  return value.split(",").map((part) => Number(part.trim()));
}

export function hasValidShapeCoordinateCount(shape: string, coords: number[]): boolean {
  if (!isHotspotShape(shape)) return false;
  switch (shape) {
    case "circle":
      return coords.length === 3;
    case "ellipse":
    case "rect":
      return coords.length === 4;
    case "poly":
      return coords.length >= 6 && coords.length % 2 === 0;
    case "default":
      return true;
    default:
      return assertNever(shape);
  }
}
