import type { QtiScalarValue, QtiValue } from "./types.js";

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
