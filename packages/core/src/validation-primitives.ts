import type { QtiBaseType, QtiCardinality, QtiDiagnostic } from "./types.js";

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
  return Number.isFinite(Number(value));
}

export function isInteger(value: string): boolean {
  return /^-?\d+$/.test(value);
}

export function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

export function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined || !isNonNegativeInteger(value)) return undefined;
  return Number(value);
}

export function isBooleanAttribute(value: string): boolean {
  return value === "true" || value === "false" || value === "1" || value === "0";
}

export function isPoint(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every(isFiniteNumber);
}

export function isPair(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => part.length > 0);
}
