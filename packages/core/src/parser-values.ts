import type {
  QtiCardinality,
  QtiRecordValue,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiValue,
} from "./types.js";

export function coerceValue(value: string, baseType: string | undefined): QtiScalarValue {
  if (baseType === "integer") return Number.parseInt(value, 10);
  if (baseType === "float") return Number.parseFloat(value);
  if (baseType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
}

export function parseCardinality(value: string | undefined): QtiCardinality {
  if (value === "multiple" || value === "ordered" || value === "record") return value;
  return "single";
}

export function parseXmlBoolean(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export function normalizeValueForCardinality(
  value: QtiValue,
  cardinality: QtiCardinality,
): QtiValue {
  if (
    (cardinality === "multiple" || cardinality === "ordered") &&
    value !== null &&
    !Array.isArray(value) &&
    !isRecordValue(value)
  ) {
    return [value];
  }
  return value;
}

export function parseShape(
  shape: string | undefined,
): NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number]["shape"] {
  if (shape === "circle" || shape === "rect" || shape === "poly") return shape;
  return "default";
}

export function parseCoords(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
}

function isRecordValue(value: QtiValue): value is QtiRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
