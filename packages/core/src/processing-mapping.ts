import {
  inferProcessingExpressionType,
  type ProcessingExpressionType,
} from "./processing-expression-type.js";
import { processingVariableType } from "./processing-variables.js";
import type {
  QtiDocument,
  QtiResponseDeclaration,
  QtiValue,
  QtiLookupTable,
  QtiDiagnostic,
  QtiProcessingExpression,
} from "./types.js";
import { coerceValue, parseXmlBoolean, parseFiniteNumber } from "./parser-values.js";
import { qtiScalarToString, qtiValueToStringList } from "./value-format.js";
import { isNullResponse, valuesEqual } from "./processing-values.js";
import { isRecordValue } from "./value-guards.js";

export function lookupOutcomeValue(
  document: QtiDocument,
  identifier: string,
  value: QtiValue,
  expression: QtiProcessingExpression,
  diagnostics: QtiDiagnostic[],
): QtiValue {
  const declaration = document.item.outcomeDeclarations.find(
    (outcome) => outcome.identifier === identifier,
  );
  const lookupTable = declaration?.lookupTable;
  const type = inferProcessingExpressionType(expression, (id) =>
    processingVariableType(document.item, id),
  );
  if (!validateLookupContract(lookupTable, type, expression, diagnostics) || !lookupTable)
    return null;
  if (isNullResponse(value)) return lookupTable.defaultValue;
  const numeric =
    type?.baseType === "duration" && typeof value === "string" ? parseFiniteNumber(value) : value;
  if (
    typeof numeric !== "number" ||
    !Number.isFinite(numeric) ||
    (lookupTable.type === "match" && !Number.isInteger(numeric))
  ) {
    diagnostics.push({
      code: "processing.lookup.type",
      severity: "error",
      message: "Lookup input must be a single numeric value; match tables require integers.",
      source: expression.source,
    });
    return null;
  }
  if (lookupTable.type === "match") {
    return (
      lookupTable.entries.find((entry) => entry.sourceValue === numeric)?.targetValue ??
      lookupTable.defaultValue
    );
  }
  const entry = lookupTable.entries.find(
    (candidate) =>
      numeric > candidate.sourceValue ||
      (candidate.includeBoundary !== false && numeric === candidate.sourceValue),
  );
  return entry?.targetValue ?? lookupTable.defaultValue;
}

export interface ImageBounds {
  width: number;
  height: number;
}

export function scoreAreaMapping(
  response: QtiValue,
  areaMapping: NonNullable<QtiResponseDeclaration["areaMapping"]>,
  imageBounds?: ImageBounds,
): number {
  const points = Array.isArray(response)
    ? response.map(qtiScalarToString)
    : isNullResponse(response)
      ? []
      : qtiValueToStringList(response);
  const matchedAreaIndexes = new Set<number>();
  let score = 0;
  for (const point of points) {
    const parsed = parsePoint(point);
    if (!parsed) {
      score += areaMapping.defaultValue;
      continue;
    }
    let matchedArea = false;
    for (const [index, entry] of areaMapping.entries.entries()) {
      if (!pointInsideArea(parsed, entry, imageBounds)) continue;
      matchedArea = true;
      if (!matchedAreaIndexes.has(index)) {
        matchedAreaIndexes.add(index);
        score += entry.mappedValue;
      }
      // Authored priority applies even when this area was already counted.
      break;
    }
    if (!matchedArea) score += areaMapping.defaultValue;
  }
  return clampMappedScore(score, areaMapping.attributes);
}

export function parsePoint(value: string): { x: number; y: number } | undefined {
  const [x, y] = value
    .trim()
    .split(/[,\s]+/)
    .map((part) => Number(part));
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

export function pointInsideArea(
  point: { x: number; y: number },
  entry: NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number],
  imageBounds?: ImageBounds,
): boolean {
  if (entry.shape === "default") {
    return (
      imageBounds !== undefined &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= imageBounds.width &&
      point.y <= imageBounds.height
    );
  }
  if (entry.shape === "circle") {
    const [cx, cy, radius] = entry.coords;
    if (cx === undefined || cy === undefined || radius === undefined) return false;
    return Math.hypot(point.x - cx, point.y - cy) <= radius;
  }

  if (entry.shape === "rect") {
    const [left, top, right, bottom] = entry.coords;
    if (left === undefined || top === undefined || right === undefined || bottom === undefined) {
      return false;
    }
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  return pointInsidePolygon(point, entry.coords);
}

function pointInsidePolygon(point: { x: number; y: number }, coords: number[]): boolean {
  if (coords.length < 6 || coords.length % 2 !== 0) return false;
  let inside = false;
  for (let index = 0, previous = coords.length - 2; index < coords.length; index += 2) {
    const xi = coords[index]!;
    const yi = coords[index + 1]!;
    const xj = coords[previous]!;
    const yj = coords[previous + 1]!;
    const intersects =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
    previous = index;
  }
  return inside;
}

/** Map distinct response values using the explicitly authored mapping. */
export function scoreMapping(
  response: QtiValue,
  mapping: NonNullable<QtiResponseDeclaration["mapping"]>,
  baseType: QtiResponseDeclaration["baseType"],
): number {
  const mappedValue = (value: string): number => {
    const key = coerceValue(value, baseType);
    const entry = mapping.entries.find((candidate) => {
      if (candidate.mapKey === undefined) return false;
      const candidateKey = coerceValue(candidate.mapKey, baseType);
      const caseSensitive = parseXmlBoolean(candidate.attributes["case-sensitive"]) ?? false;
      return baseType === "string" &&
        !caseSensitive &&
        typeof candidateKey === "string" &&
        typeof key === "string"
        ? candidateKey.toLowerCase() === key.toLowerCase()
        : valuesEqual(candidateKey, key, false, baseType);
    });
    return entry?.mappedValue ?? mapping.defaultValue;
  };
  if (Array.isArray(response)) {
    const distinct = response.filter(
      (value, index) =>
        response.findIndex((candidate) => valuesEqual(candidate, value, false, baseType)) === index,
    );
    const score = distinct.reduce<number>((sum, value) => sum + mappedValue(String(value)), 0);
    return clampMappedScore(score, mapping.attributes);
  }
  const score =
    isNullResponse(response) || isRecordValue(response) ? 0 : mappedValue(String(response));
  return clampMappedScore(score, mapping.attributes);
}

function clampMappedScore(score: number, attributes: Record<string, string>): number {
  const lower = numericBound(attributes["lower-bound"]);
  const upper = numericBound(attributes["upper-bound"]);
  let clamped = score;
  if (lower !== undefined) clamped = Math.max(clamped, lower);
  if (upper !== undefined) clamped = Math.min(clamped, upper);
  return clamped;
}

function numericBound(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

/** Shared static/runtime lookup requirements, using the original outcome table. */
export function validateLookupContract(
  table: QtiLookupTable | undefined,
  type: ProcessingExpressionType | undefined,
  expression: QtiProcessingExpression,
  diagnostics: QtiDiagnostic[],
): boolean {
  const invalidType =
    type &&
    (type.cardinality !== "single" ||
      (type.baseType !== undefined &&
        (table?.type === "match"
          ? type.baseType !== "integer"
          : !["integer", "float", "duration"].includes(type.baseType))));
  if (table && !invalidType) return true;
  diagnostics.push({
    code: table ? "processing.lookup.type" : "processing.lookup.table",
    severity: "error",
    message: table
      ? "Lookup input must be single integer, float or duration; match tables require integers."
      : "Lookup outcome rules require an outcome with a lookup table.",
    source: expression.source,
  });
  return false;
}
