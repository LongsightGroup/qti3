import { diagnostic, isExtensionSupport, numberParam, validExtensionSupport } from "./helpers.js";
import { findSupportConflicts } from "./conflicts.js";
import { getQti3PnpSupportDefinition } from "./registry.js";
import type { Qti3PnpSupportRegistryEntry } from "./registry.js";
import type {
  NormalizedQti3PnpProfile,
  Qti3PnpDiagnostic,
  Qti3PnpParamDefinition,
  Qti3PnpPreference,
  Qti3PnpValidationResult,
} from "./types.js";

export function validateQti3Pnp(profile: NormalizedQti3PnpProfile): Qti3PnpValidationResult {
  const diagnostics: Qti3PnpDiagnostic[] = [];
  const singletonSeen = new Map<string, Qti3PnpPreference>();

  for (const preference of profile.preferences) {
    const definition = getQti3PnpSupportDefinition(preference.support);
    if (!definition && !isExtensionSupport(preference.support)) {
      diagnostics.push(
        diagnostic("PNP_UNKNOWN_SUPPORT", "warning", preference, "Unknown PNP support."),
      );
    }
    if (isExtensionSupport(preference.support) && !validExtensionSupport(preference.support)) {
      diagnostics.push(
        diagnostic(
          "PNP_UNSUPPORTED_EXTENSION",
          "warning",
          preference,
          "Invalid custom PNP support name.",
        ),
      );
    }
    if (definition?.cardinality === "zero-or-one") {
      const key = preference.support.toLowerCase();
      if (singletonSeen.has(key)) {
        diagnostics.push(
          diagnostic(
            "PNP_DUPLICATE_SINGLETON",
            "warning",
            preference,
            "Duplicate singleton PNP support.",
          ),
        );
      } else {
        singletonSeen.set(key, preference);
      }
    }
    diagnostics.push(...validateParams(preference, definition));
  }

  for (const conflict of findSupportConflicts(profile.preferences)) {
    diagnostics.push(
      diagnostic(
        "PNP_CONFLICTING_SUPPORT_STATE",
        "error",
        conflict.requested,
        "PNP requests and prohibits the same support.",
      ),
    );
  }

  return { ok: !diagnostics.some((entry) => entry.severity === "error"), diagnostics };
}

function validateParams(
  preference: Qti3PnpPreference,
  definition: Qti3PnpSupportRegistryEntry | undefined,
): Qti3PnpDiagnostic[] {
  if (!definition) return [];
  const diagnostics: Qti3PnpDiagnostic[] = [];
  for (const param of definition.params) {
    const value = preference.params[param.name];
    diagnostics.push(...validateParam(preference, param, value));
  }
  diagnostics.push(...validateXorGroups(preference, definition));
  return diagnostics;
}

function validateXorGroups(
  preference: Qti3PnpPreference,
  definition: Qti3PnpSupportRegistryEntry,
): Qti3PnpDiagnostic[] {
  const diagnostics: Qti3PnpDiagnostic[] = [];
  for (const group of definition.validation?.xorGroups ?? []) {
    const selected = group.params.filter((param) => preference.params[param] !== undefined);
    if (selected.length <= 1) continue;
    diagnostics.push(diagnostic("PNP_INVALID_XOR_SELECTION", "error", preference, group.message));
  }
  return diagnostics;
}

function validateParam(
  preference: Qti3PnpPreference,
  param: Qti3PnpParamDefinition,
  value: unknown,
): Qti3PnpDiagnostic[] {
  if (value === undefined) return [];
  if (param.valueType === "color" && typeof value === "string" && !/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      diagnostic("PNP_INVALID_HEX_COLOR", "error", preference, `Invalid color for ${param.name}.`),
    ];
  }
  if (param.valueType === "number" && numberParam(value) === undefined) {
    return [
      diagnostic("PNP_INVALID_NUMBER", "error", preference, `Invalid number for ${param.name}.`),
    ];
  }
  if (
    param.valueType === "language" &&
    typeof value === "string" &&
    !/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(value)
  ) {
    return [
      diagnostic(
        "PNP_INVALID_LANGUAGE_TAG",
        "error",
        preference,
        `Invalid language tag for ${param.name}.`,
      ),
    ];
  }
  if (
    param.valueType === "enum" &&
    typeof value === "string" &&
    param.values &&
    !param.values.includes(value)
  ) {
    return [
      diagnostic("PNP_INVALID_ENUM", "error", preference, `Invalid value for ${param.name}.`),
    ];
  }
  return [];
}
