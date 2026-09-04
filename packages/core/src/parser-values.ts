import type {
  QtiBaseType,
  QtiCardinality,
  QtiRecordValue,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiValue,
} from "./types.js";

const QTI_BASE_TYPES = new Set<string>([
  "identifier",
  "boolean",
  "integer",
  "float",
  "string",
  "point",
  "pair",
  "directedPair",
  "duration",
  "file",
  "uri",
]);
const QTI_FINITE_FLOAT_PATTERN = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?$/;

export function isQtiBaseType(value: string): value is QtiBaseType {
  return QTI_BASE_TYPES.has(value);
}

export function parseBaseType(value: string | undefined): QtiBaseType | undefined {
  if (value === undefined) return undefined;
  return isQtiBaseType(value) ? value : undefined;
}

export function numericTuple3(values: number[]): [number, number, number] | undefined {
  const [a, b, c] = values;
  if (a === undefined || b === undefined || c === undefined) return undefined;
  return [a, b, c];
}

export function numericTuple4(values: number[]): [number, number, number, number] | undefined {
  const [a, b, c, d] = values;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return undefined;
  return [a, b, c, d];
}

export function coerceValue(value: string, baseType: string | undefined): QtiScalarValue {
  if (baseType === "integer") return parseInteger(value) ?? value;
  if (baseType === "float") return parseFiniteNumber(value) ?? value;
  if (baseType === "pair" || baseType === "directedPair") {
    return parseQtiPair(value, baseType) ?? value;
  }
  if (baseType === "boolean") {
    const parsed = parseXmlBoolean(value);
    if (parsed !== undefined) return parsed;
    // Invalid boolean literals fall through to the raw string; validation rejects them separately.
  }
  return value;
}

/** Parse and canonicalize a QTI pair while preserving directed-pair endpoint order. */
export function parseQtiPair(
  value: string | undefined,
  baseType: "pair" | "directedPair",
): string | undefined {
  if (value === undefined) return undefined;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) return undefined;
  return (baseType === "pair" ? parts.toSorted() : parts).join(" ");
}

/** Parse a complete integer lexical value without accepting a numeric prefix. */
export function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parseCardinality(value: string | undefined): QtiCardinality {
  if (value === "multiple" || value === "ordered" || value === "record") return value;
  return "single";
}

export function parseXmlBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

/** Parse the finite subset of the XML Schema float lexical space used by QTI values. */
export function parseFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!QTI_FINITE_FLOAT_PATTERN.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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
