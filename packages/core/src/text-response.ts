import type { QtiInteraction, QtiRecordValue, QtiValue } from "./types.js";

/** Capture text using the interaction's declared response type and authored radix. */
export function captureQtiTextResponse(interaction: QtiInteraction, text: string): QtiValue {
  if (interaction.responseCardinality === "record") return numericRecord(text, radix(interaction));
  if (interaction.responseBaseType === "string") return text;
  if (text.trim() === "") return null;
  const record = numericRecord(text, radix(interaction));
  return interaction.responseBaseType === "integer"
    ? (record.integerValue ?? null)
    : (record.floatValue ?? null);
}

/** Recover editable text, including the original lexical form in a numeric record. */
export function qtiTextResponseString(value: QtiValue): string {
  if (value !== null && typeof value === "object") {
    return !Array.isArray(value) && typeof value.stringValue === "string" ? value.stringValue : "";
  }
  return value === null ? "" : String(value);
}

function radix(interaction: QtiInteraction): number {
  return Number(interaction.attributes.base ?? 10);
}

function numericRecord(text: string, base: number): QtiRecordValue {
  const empty: QtiRecordValue = {
    stringValue: text,
    floatValue: null,
    integerValue: null,
    leftDigits: null,
    rightDigits: null,
    ndp: null,
    nsf: null,
    exponent: null,
  };
  if (!Number.isInteger(base) || base < 2 || base > 36) return empty;
  const normalized = text.trim();
  const match = (
    base === 10
      ? /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
      : /^([+-]?)([0-9a-z]*)(?:\.([0-9a-z]*))?$/i
  ).exec(normalized);
  if (!match) return empty;
  const left = match[2] ?? "";
  const right = match[3] ?? "";
  const digits = left + right;
  if (!digits || digits.split("").some((digit) => Number.parseInt(digit, 36) >= base)) return empty;
  const exponent = match[4] === undefined ? null : Number(match[4]);
  const magnitude =
    (Number.parseInt(left || "0", base) +
      right
        .split("")
        .reduce(
          (sum, digit, index) => sum + Number.parseInt(digit, base) / base ** (index + 1),
          0,
        )) *
    base ** (exponent ?? 0);
  const value = base === 10 ? Number(normalized) : match[1] === "-" ? -magnitude : magnitude;
  if (!Number.isFinite(value)) return empty;
  const integer =
    match[3] === undefined && exponent === null && Number.isSafeInteger(value) ? value : null;
  return {
    stringValue: text,
    floatValue: value,
    integerValue: integer,
    leftDigits: left.length,
    rightDigits: right.length,
    ndp: Math.max(0, right.length - (exponent ?? 0)),
    nsf: digits.replace(/^0+/, "").length || 1,
    exponent,
  };
}

export function isQtiTextResponseRecord(value: QtiValue): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const integerFields = new Set([
    "integerValue",
    "leftDigits",
    "rightDigits",
    "ndp",
    "nsf",
    "exponent",
  ]);
  return Object.entries(value).every(([field, entry]) => {
    if (field === "stringValue") return typeof entry === "string" || entry === null;
    if (field === "floatValue")
      return entry === null || (typeof entry === "number" && Number.isFinite(entry));
    return (
      integerFields.has(field) &&
      (entry === null || (typeof entry === "number" && Number.isSafeInteger(entry)))
    );
  });
}
