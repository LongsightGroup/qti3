import { isRecord, stringProperty } from "./helpers.js";
import type { Qti3PnpMode, Qti3PnpParseResult, Qti3PnpRecordLike } from "./types.js";

export function parseQti3PnpObject(input: unknown): Qti3PnpParseResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      records: [],
      diagnostics: [
        {
          code: "PNP_UNKNOWN_ELEMENT",
          severity: "error",
          message: "PNP object input must be a record or record set object.",
        },
      ],
    };
  }

  const recordsValue = input.records;
  if (Array.isArray(recordsValue)) {
    return {
      ok: true,
      records: recordsValue.filter(isRecord).map(objectRecord),
      diagnostics: [],
    };
  }

  return { ok: true, records: [objectRecord(input)], diagnostics: [] };
}

function objectRecord(input: Record<string, unknown>): Qti3PnpRecordLike {
  const identifier = stringProperty(input, "identifier") ?? stringProperty(input, "id");
  const preferences = Array.isArray(input.preferences)
    ? input.preferences.filter(isRecord).map((preference) => ({
        support: typeof preference.support === "string" ? preference.support : "",
        mode: isMode(preference.mode) ? preference.mode : undefined,
        params: isRecord(preference.params) ? preference.params : undefined,
      }))
    : undefined;
  return { identifier, preferences };
}

function isMode(input: unknown): input is Qti3PnpMode {
  return (
    input === "required" ||
    input === "activate-at-initialization" ||
    input === "activate-as-option" ||
    input === "prohibited"
  );
}
