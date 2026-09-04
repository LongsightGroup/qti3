import type { QtiBaseType, QtiCardinality, QtiDiagnostic, QtiScalarValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import { parseFiniteNumber, parseInteger, parseQtiPair, parseXmlBoolean } from "./parser-values.js";

export function requireIdentifier(
  qtiName: string,
  identifier: string | undefined,
  diagnostics: QtiDiagnostic[],
  source: QtiDiagnostic["source"],
): void {
  if (identifier?.trim()) return;
  diagnostics.push({
    code: "identifier.required",
    severity: "error",
    message: `${qtiName} requires a non-empty identifier.`,
    path: source?.path,
    source,
  });
}

export function isCardinality(value: string): value is QtiCardinality {
  return value === "single" || value === "multiple" || value === "ordered" || value === "record";
}

export function isBaseType(value: string): value is QtiBaseType {
  return (
    value === "identifier" ||
    value === "boolean" ||
    value === "integer" ||
    value === "float" ||
    value === "string" ||
    value === "point" ||
    value === "pair" ||
    value === "directedPair" ||
    value === "duration" ||
    value === "file" ||
    value === "uri"
  );
}

export function isFiniteNumber(value: string): boolean {
  return parseFiniteNumber(value) !== undefined;
}

export function isInteger(value: string): boolean {
  return parseInteger(value) !== undefined;
}

export function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

export function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !isNonNegativeInteger(value)) return undefined;
  return Number(value);
}

export function isBooleanAttribute(value: string): boolean {
  return parseXmlBoolean(value) !== undefined;
}

export function isPoint(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every(isFiniteNumber);
}

export function isPair(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => part.length > 0);
}

/** Parse and normalize a runtime scalar for a QTI base type. */
export function parseQtiScalarForBaseType(
  value: QtiScalarValue,
  baseType: QtiBaseType,
): QtiScalarValue | undefined {
  switch (baseType) {
    case "integer":
      if (typeof value === "number") return Number.isInteger(value) ? value : undefined;
      return typeof value === "string" ? parseInteger(value) : undefined;
    case "float":
      if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
      return typeof value === "string" ? parseFiniteNumber(value) : undefined;
    case "boolean":
      if (typeof value === "boolean") return value;
      return typeof value === "string" ? parseXmlBoolean(value) : undefined;
    case "point":
      return typeof value === "string" && isPoint(value) ? value : undefined;
    case "pair":
    case "directedPair":
      return typeof value === "string" ? parseQtiPair(value, baseType) : undefined;
    case "identifier":
      return typeof value === "string" && value.trim().length > 0 && !/\s/.test(value)
        ? value
        : undefined;
    case "string":
    case "duration":
    case "file":
    case "uri":
      return typeof value === "string" ? value : undefined;
    default:
      return assertNever(baseType);
  }
}

/** Check a runtime scalar against the value representation accepted for a QTI base type. */
export function qtiScalarMatchesBaseType(value: QtiScalarValue, baseType: QtiBaseType): boolean {
  return parseQtiScalarForBaseType(value, baseType) !== undefined;
}
