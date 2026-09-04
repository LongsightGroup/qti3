import { parseQtiPair } from "./parser-values.js";
import type {
  QtiBaseType,
  QtiRecordValue,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiValue,
} from "./types.js";
import { qtiValueToString } from "./value-format.js";

export function isNullResponse(response: QtiValue): boolean {
  return response === null || response === "" || (Array.isArray(response) && response.length === 0);
}

export function valuesEqual(
  actual: QtiValue,
  expected: QtiValue,
  ordered = false,
  baseType?: QtiBaseType,
): boolean {
  if (isRecordValue(actual) || isRecordValue(expected)) {
    if (!isRecordValue(actual) || !isRecordValue(expected)) return false;
    const actualKeys = Object.keys(actual).toSorted();
    const expectedKeys = Object.keys(expected).toSorted();
    return (
      valuesEqual(actualKeys, expectedKeys, true) &&
      actualKeys.every((key) =>
        valuesEqual(actual[key] ?? null, expected[key] ?? null, ordered, baseType),
      )
    );
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    const actualValues = valueContainer(actual);
    const expectedValues = Array.isArray(expected) ? expected : expected === null ? [] : [expected];
    if (actualValues.length !== expectedValues.length) return false;
    if (ordered)
      return actualValues.every((value, index) =>
        scalarValuesEqual(value, expectedValues[index]!, baseType),
      );
    const compareValues = (left: QtiScalarValue, right: QtiScalarValue): number =>
      compareScalarValues(left, right, baseType);
    const sortedExpected = [...expectedValues].toSorted(compareValues);
    return [...actualValues]
      .toSorted(compareValues)
      .every((value, index) => scalarValuesEqual(value, sortedExpected[index]!, baseType));
  }
  return scalarValuesEqual(actual, expected, baseType);
}

export function qtiMatchValues(
  actual: QtiValue,
  expected: QtiValue,
  ordered = false,
  baseType?: QtiBaseType,
): boolean | null {
  if (actual === null || expected === null) return null;
  return valuesEqual(actual, expected, ordered, baseType);
}

function scalarValuesEqual(actual: QtiValue, expected: QtiValue, baseType?: QtiBaseType): boolean {
  if (
    (baseType === "pair" || baseType === "directedPair") &&
    typeof actual === "string" &&
    typeof expected === "string"
  ) {
    const normalizedActual = parseQtiPair(actual, baseType);
    return normalizedActual !== undefined && normalizedActual === parseQtiPair(expected, baseType);
  }
  if (typeof actual === "boolean" && typeof expected === "string") {
    return String(actual) === expected;
  }
  if (typeof actual === "string" && typeof expected === "boolean") {
    return actual === String(expected);
  }
  if (typeof actual === "number" && typeof expected === "string") {
    return String(actual) === expected;
  }
  if (typeof actual === "string" && typeof expected === "number") {
    return actual === String(expected);
  }
  return actual === expected;
}

export function normalizeValueForCardinality(
  value: QtiValue,
  cardinality: QtiResponseDeclaration["cardinality"],
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

export function valueContainer(value: QtiValue): QtiScalarValue[] {
  if (value === null) return [];
  if (isRecordValue(value)) return [];
  return Array.isArray(value) ? value : [value];
}

export function isRecordValue(value: QtiValue): value is QtiRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function containsValues(
  collection: QtiScalarValue[],
  values: QtiScalarValue[],
  baseType?: QtiBaseType,
): boolean {
  const remaining = [...collection];
  for (const value of values) {
    const index = remaining.findIndex((candidate) =>
      valuesEqual(candidate, value, false, baseType),
    );
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}

function compareScalarValues(
  left: QtiScalarValue,
  right: QtiScalarValue,
  baseType?: QtiBaseType,
): number {
  const leftKey =
    (baseType === "pair" || baseType === "directedPair") && typeof left === "string"
      ? (parseQtiPair(left, baseType) ?? left)
      : String(left);
  const rightKey =
    (baseType === "pair" || baseType === "directedPair") && typeof right === "string"
      ? (parseQtiPair(right, baseType) ?? right)
      : String(right);
  return leftKey.localeCompare(rightKey);
}

export function numericValue(value: QtiValue): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return Number(value);
  return 0;
}

export function numericValueOrNull(value: QtiValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function durationSeconds(value: QtiValue): number | null {
  if (value === null || Array.isArray(value) || isRecordValue(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (raw.length === 0) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      raw,
    );
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) ? total : null;
}

export function booleanValue(value: QtiValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0 && value !== "false";
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function booleanValueOrNull(value: QtiValue): boolean | null {
  if (value === null) return null;
  return booleanValue(value);
}

export function stringMatch(
  left: QtiValue,
  right: QtiValue,
  caseSensitive: boolean,
  substring: boolean,
): boolean | null {
  if (left === null || right === null) return null;
  let actual = qtiValueToString(left);
  let expected = qtiValueToString(right);
  if (!caseSensitive) {
    actual = actual.toLocaleLowerCase();
    expected = expected.toLocaleLowerCase();
  }
  return substring ? actual.includes(expected) : actual === expected;
}
