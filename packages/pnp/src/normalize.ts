import { coerceValue, isRecord, normalizeName, toCamelName } from "./helpers.js";
import { validateQti3Pnp } from "./validate.js";
import { elementChildren } from "./xml.js";
import type {
  NormalizedQti3PnpProfile,
  Qti3PnpElementLike,
  Qti3PnpMode,
  Qti3PnpNormalizeResult,
  Qti3PnpParseResult,
  Qti3PnpPreference,
  Qti3PnpPreferenceLike,
  Qti3PnpRecord,
  Qti3PnpRecordLike,
} from "./types.js";

export function normalizeQti3Pnp(
  input: Qti3PnpParseResult | Qti3PnpRecordLike,
): Qti3PnpNormalizeResult {
  const parseResult = isParseResult(input)
    ? input
    : { ok: true, records: [input], diagnostics: [] };
  const diagnostics = [...parseResult.diagnostics];
  const records = parseResult.records.map((record, index) => normalizeRecord(record, index));
  const preferences = records.flatMap((record) => record.preferences);
  const profile: NormalizedQti3PnpProfile = { preferences, records, diagnostics };
  const validation = validateQti3Pnp(profile);
  diagnostics.push(...validation.diagnostics);
  profile.diagnostics = diagnostics;
  return { ok: parseResult.ok && validation.ok, profile, diagnostics };
}

function normalizeRecord(record: Qti3PnpRecordLike, index: number): Qti3PnpRecord {
  const preferences = [
    ...(record.preferences ?? []).map((preference) => normalizePreferenceLike(preference, index)),
    ...(record.elements ?? []).flatMap((element) => normalizeElement(element, "required", index)),
  ];
  return { index, identifier: record.identifier, preferences };
}

function normalizePreferenceLike(
  preference: Qti3PnpPreferenceLike,
  recordIndex: number,
): Qti3PnpPreference {
  return {
    support: preference.support,
    mode: preference.mode ?? "required",
    params: preference.params ?? {},
    source: { recordIndex },
  };
}

function normalizeElement(
  element: Qti3PnpElementLike,
  mode: Qti3PnpMode,
  recordIndex: number,
): Qti3PnpPreference[] {
  const name = normalizeName(element.name);
  if (name === "activate-at-initialization-set") {
    return elementChildren(element).flatMap((child) =>
      normalizeElement(child, "activate-at-initialization", recordIndex),
    );
  }
  if (name === "activate-as-option-set") {
    return elementChildren(element).flatMap((child) =>
      normalizeElement(child, "activate-as-option", recordIndex),
    );
  }
  if (name === "prohibit-set") {
    return elementChildren(element).flatMap((child) =>
      normalizeElement(child, "prohibited", recordIndex),
    );
  }
  if (
    name === "record" ||
    name === "personal-needs-and-preferences" ||
    name === "access-for-all-pnp"
  ) {
    return elementChildren(element).flatMap((child) => normalizeElement(child, mode, recordIndex));
  }
  if (name.startsWith("access-for-all")) return [];

  return [
    {
      support: name,
      mode,
      params: elementParams(element),
      source: { recordIndex, elementName: element.name },
    },
  ];
}

function elementParams(element: Qti3PnpElementLike): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(element.attributes ?? {})) {
    if (name.startsWith("xmlns")) continue;
    params[toCamelName(normalizeName(name))] = coerceValue(value);
  }
  for (const child of elementChildren(element)) {
    const name = toCamelName(normalizeName(child.name));
    const childElements = elementChildren(child);
    params[name] =
      childElements.length > 0 ? elementParams(child) : coerceValue((child.text ?? "").trim());
  }
  const text = (element.text ?? "").trim();
  if (text && Object.keys(params).length === 0) params.value = coerceValue(text);
  return params;
}

function isParseResult(input: unknown): input is Qti3PnpParseResult {
  return isRecord(input) && Array.isArray(input.records) && Array.isArray(input.diagnostics);
}
