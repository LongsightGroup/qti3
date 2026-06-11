import type { QtiValue } from "@longsightgroup/qti3-core";

export function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}
