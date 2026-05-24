import type { QtiPortableCustomStateValue, QtiScalarValue, QtiValue } from "./types.js";

export function isQtiValue(value: unknown): value is QtiValue {
  return readQtiJsonValue(value) !== undefined;
}

export function readQtiJsonValue(value: unknown): QtiValue | undefined {
  if (value === null || isQtiScalarValue(value)) return value;
  if (Array.isArray(value)) return value.every(isQtiScalarValue) ? value : undefined;
  if (!isPlainRecord(value)) return undefined;

  const record: Record<string, QtiValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const converted = readQtiJsonValue(entry);
    if (converted === undefined) return undefined;
    record[key] = converted;
  }
  return record;
}

export function isQtiPortableCustomStateValue(
  value: unknown,
): value is QtiPortableCustomStateValue {
  return readQtiPortableCustomStateValue(value) !== undefined;
}

export function readQtiPortableCustomStateValue(
  value: unknown,
): QtiPortableCustomStateValue | undefined {
  if (value === null) return value;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const values: QtiPortableCustomStateValue[] = [];
    for (const entry of value) {
      const converted = readQtiPortableCustomStateValue(entry);
      if (converted === undefined) return undefined;
      values.push(converted);
    }
    return values;
  }
  if (!isPlainRecord(value)) return undefined;

  const record: Record<string, QtiPortableCustomStateValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const converted = readQtiPortableCustomStateValue(entry);
    if (converted === undefined) return undefined;
    record[key] = converted;
  }
  return record;
}

export function qtiScalarToString(value: QtiScalarValue): string {
  return String(value);
}

export function qtiValueToString(value: QtiValue): string {
  if (value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return qtiScalarToString(value);
  }
  if (Array.isArray(value)) return value.map(qtiScalarToString).join(" ");
  return JSON.stringify(value);
}

export function qtiValueToStringList(value: QtiValue): string[] {
  if (value === null) return [""];
  if (Array.isArray(value)) return value.map(qtiScalarToString);
  if (typeof value === "object") return [JSON.stringify(value)];
  return [qtiScalarToString(value)];
}

export function qtiValueToIdentifierList(value: QtiValue): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value.map(qtiScalarToString);
  if (typeof value === "object") return [JSON.stringify(value)];
  return [qtiScalarToString(value)];
}

export function unknownToDisplayString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  if (Array.isArray(value)) return value.map(unknownToDisplayString).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return JSON.stringify(value);
}

function isQtiScalarValue(value: unknown): value is QtiScalarValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
