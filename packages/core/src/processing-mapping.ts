import type { QtiDocument, QtiResponseDeclaration, QtiValue } from "./types.js";
import { parseQtiPair, parseXmlBoolean } from "./parser-values.js";
import { qtiScalarToString, qtiValueToStringList } from "./value-format.js";
import { isRecordValue, numericValue, valuesEqual } from "./processing-values.js";

export function lookupOutcomeValue(
  document: QtiDocument,
  identifier: string,
  value: QtiValue,
): QtiValue {
  const declaration = document.item.outcomeDeclarations.find(
    (outcome) => outcome.identifier === identifier,
  );
  const lookupTable = declaration?.lookupTable;
  if (!lookupTable) return null;
  if (value === null) return lookupTable.defaultValue;
  const numeric = numericValue(value);
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

export function mapOrMatchResponse(
  declaration: QtiResponseDeclaration,
  response: QtiValue,
  correctResponse: QtiValue,
): number {
  if (declaration.areaMapping) return scoreAreaMapping(response, declaration.areaMapping);
  if (declaration.mapping) return scoreMapping(response, declaration.mapping, declaration.baseType);
  return valuesEqual(
    response,
    correctResponse,
    declaration.cardinality === "ordered",
    declaration.baseType,
  )
    ? 1
    : 0;
}

export function scoreAreaMapping(
  response: QtiValue,
  areaMapping: NonNullable<QtiResponseDeclaration["areaMapping"]>,
): number {
  const points = Array.isArray(response)
    ? response.map(qtiScalarToString)
    : response === null
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
      if (!pointInsideArea(parsed, entry)) continue;
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
): boolean {
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

  if (entry.shape === "poly") {
    return pointInsidePolygon(point, entry.coords);
  }

  return false;
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

function scoreMapping(
  response: QtiValue,
  mapping: NonNullable<QtiResponseDeclaration["mapping"]>,
  baseType: QtiResponseDeclaration["baseType"],
): number {
  const mappedValue = (value: string): number => {
    const key = mappingKey(value, baseType);
    const entry = mapping.entries.find((candidate) => {
      if (candidate.mapKey === undefined) return false;
      const candidateKey = mappingKey(candidate.mapKey, baseType);
      const caseSensitive = parseXmlBoolean(candidate.attributes["case-sensitive"]) ?? false;
      return baseType === "string" && !caseSensitive
        ? candidateKey.toLowerCase() === key.toLowerCase()
        : candidateKey === key;
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
  const score = response === null || isRecordValue(response) ? 0 : mappedValue(String(response));
  return clampMappedScore(score, mapping.attributes);
}

function mappingKey(value: string, baseType: QtiResponseDeclaration["baseType"]): string {
  return baseType === "pair" || baseType === "directedPair"
    ? (parseQtiPair(value, baseType) ?? value)
    : value;
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
