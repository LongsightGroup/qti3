import type { QtiRecordValue, QtiValue } from "./types.js";

/** Narrow an already-typed QTI value to its record variant. */
export function isRecordValue(value: QtiValue): value is QtiRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
