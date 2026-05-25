import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { extractMessagePlaceholders } from "./player-message-catalog.js";
import {
  PLAYER_MESSAGE_MANIFEST,
  type PlayerMessageKey,
  type PlayerMessageManifestEntry,
} from "./player-message-manifest.js";
import type { QtiPlayerMovementDirection } from "./player-messages.js";

export type PlayerMessageCatalogDiagnosticCode =
  | "invalid-catalog-root"
  | "invalid-catalog-field"
  | "invalid-strings-field"
  | "invalid-string-value"
  | "invalid-interaction-types-field"
  | "invalid-interaction-type-value"
  | "invalid-directions-field"
  | "invalid-direction-value"
  | "unknown-string-key"
  | "missing-message-key"
  | "missing-plural-form"
  | "unknown-placeholder"
  | "missing-placeholder"
  | "empty-template"
  | "invalid-direction-key";

export interface PlayerMessageCatalogDiagnostic {
  code: PlayerMessageCatalogDiagnosticCode;
  message: string;
  key: string;
  severity: "error" | "warning";
}

export interface ValidatePlayerMessageCatalogOptions {
  /** When true, every manifest message id must be present in `catalog.strings` (or plural forms). */
  requireAllKeys?: boolean;
}

export interface PlayerMessageCatalogValidationResult {
  valid: boolean;
  diagnostics: PlayerMessageCatalogDiagnostic[];
}

const MANIFEST_KEYS = new Set(PLAYER_MESSAGE_MANIFEST.map((entry) => entry.key));
const MANIFEST_BY_KEY = new Map(PLAYER_MESSAGE_MANIFEST.map((entry) => [entry.key, entry]));

const AUXILIARY_STRING_KEYS = new Set([
  "characterUnit.one",
  "characterUnit.other",
  "wordUnit.one",
  "wordUnit.other",
]);

const VALID_DIRECTION_KEYS = new Set<QtiPlayerMovementDirection>(["up", "down", "left", "right"]);

type NormalizedCatalog = {
  strings: Record<string, string>;
  locale?: string;
  interactionTypes: Record<string, string>;
  directions: Partial<Record<QtiPlayerMovementDirection, string>>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string";
}

function pushDiagnostic(
  diagnostics: PlayerMessageCatalogDiagnostic[],
  diagnostic: PlayerMessageCatalogDiagnostic,
): void {
  diagnostics.push(diagnostic);
}

function isManifestStringKey(key: string): boolean {
  if (MANIFEST_KEYS.has(key as PlayerMessageKey)) return true;
  if (AUXILIARY_STRING_KEYS.has(key)) return true;
  const pluralMatch = /^(.+)\.(one|other)$/.exec(key);
  if (pluralMatch && MANIFEST_KEYS.has(pluralMatch[1] as PlayerMessageKey)) {
    return MANIFEST_BY_KEY.get(pluralMatch[1] as PlayerMessageKey)?.resolver === "plural";
  }
  return false;
}

/** Placeholders a host may use for a manifest entry (superset of manifest params). */
export function allowedCatalogPlaceholders(entry: PlayerMessageManifestEntry): readonly string[] {
  switch (entry.resolver) {
    case "plain":
    case "typeLabel":
      return [];
    case "template":
    case "plural":
    case "directionTemplate":
      return entry.params ?? [];
    case "typeTemplate":
      return [...(entry.params?.filter((name) => name !== "type") ?? []), "typeName"];
    case "extendedTextCounter":
      return ["characters", "words", "characterUnit", "wordUnit"];
    default:
      return [];
  }
}

/**
 * Placeholders a host template must include for a catalog string key.
 * Uses the English default for that key when present; otherwise no placeholders are required.
 * Manifest `params` bound required fields for resolvers that inject extra values at runtime
 * (e.g. `extendedTextCounter` supplies `{characterUnit}` / `{wordUnit}` even when omitted).
 */
export function requiredCatalogPlaceholders(
  catalogKey: string,
  entry?: PlayerMessageManifestEntry,
): readonly string[] {
  const manifestEntry = entry ?? manifestEntryForStringKey(catalogKey);
  if (!manifestEntry) {
    return [];
  }

  const allowed = new Set(allowedCatalogPlaceholders(manifestEntry));
  const defaultTemplate = defaultPlayerMessageCatalog.strings[catalogKey];
  const fromDefault = defaultTemplate
    ? extractMessagePlaceholders(defaultTemplate).filter((name) => allowed.has(name))
    : [];

  if (manifestEntry.resolver === "extendedTextCounter") {
    return (manifestEntry.params ?? []).filter((name) => allowed.has(name));
  }

  if (fromDefault.length > 0) {
    return fromDefault;
  }

  return [];
}

function validateTemplate(
  key: string,
  template: string,
  entry: PlayerMessageManifestEntry,
  diagnostics: PlayerMessageCatalogDiagnostic[],
): void {
  if (!template.trim()) {
    pushDiagnostic(diagnostics, {
      code: "empty-template",
      key,
      severity: "error",
      message: `Message "${key}" is empty.`,
    });
    return;
  }

  const allowed = new Set(allowedCatalogPlaceholders(entry));
  const actual = extractMessagePlaceholders(template);
  const required = requiredCatalogPlaceholders(key, entry);

  for (const placeholder of actual) {
    if (!allowed.has(placeholder)) {
      pushDiagnostic(diagnostics, {
        code: "unknown-placeholder",
        key,
        severity: "error",
        message: `Message "${key}" uses unknown placeholder "{${placeholder}}". Allowed: ${[...allowed].join(", ") || "(none)"}.`,
      });
    }
  }

  for (const placeholder of required) {
    if (!actual.includes(placeholder)) {
      pushDiagnostic(diagnostics, {
        code: "missing-placeholder",
        key,
        severity: "error",
        message: `Message "${key}" is missing required placeholder "{${placeholder}}" (required by English default for this key).`,
      });
    }
  }
}

function manifestEntryForStringKey(key: string): PlayerMessageManifestEntry | undefined {
  const pluralMatch = /^(.+)\.(one|other)$/.exec(key);
  const baseKey = (pluralMatch?.[1] ?? key) as PlayerMessageKey;
  return MANIFEST_BY_KEY.get(baseKey);
}

function normalizeCatalogInput(
  input: unknown,
  diagnostics: PlayerMessageCatalogDiagnostic[],
): NormalizedCatalog | null {
  if (!isPlainObject(input)) {
    pushDiagnostic(diagnostics, {
      code: "invalid-catalog-root",
      key: "(root)",
      severity: "error",
      message: "Player message catalog must be a JSON object.",
    });
    return null;
  }

  const normalized: NormalizedCatalog = {
    strings: {},
    interactionTypes: {},
    directions: {},
  };

  if ("locale" in input) {
    if (input.locale === undefined) {
      // omit
    } else if (!isNonEmptyString(input.locale)) {
      pushDiagnostic(diagnostics, {
        code: "invalid-catalog-field",
        key: "locale",
        severity: "error",
        message: "Catalog locale must be a string when provided.",
      });
    } else {
      normalized.locale = input.locale;
    }
  }

  if (!("strings" in input) || input.strings === undefined) {
    pushDiagnostic(diagnostics, {
      code: "invalid-strings-field",
      key: "strings",
      severity: "error",
      message: 'Catalog must include a "strings" object.',
    });
  } else if (!isPlainObject(input.strings)) {
    pushDiagnostic(diagnostics, {
      code: "invalid-strings-field",
      key: "strings",
      severity: "error",
      message: 'Catalog "strings" must be an object mapping message ids to template strings.',
    });
  } else {
    for (const [key, value] of Object.entries(input.strings)) {
      if (!isNonEmptyString(value)) {
        pushDiagnostic(diagnostics, {
          code: "invalid-string-value",
          key,
          severity: "error",
          message: `Catalog strings["${key}"] must be a string.`,
        });
        continue;
      }
      normalized.strings[key] = value;
    }
  }

  if ("interactionTypes" in input && input.interactionTypes !== undefined) {
    if (!isPlainObject(input.interactionTypes)) {
      pushDiagnostic(diagnostics, {
        code: "invalid-interaction-types-field",
        key: "interactionTypes",
        severity: "error",
        message:
          'Catalog "interactionTypes" must be an object mapping interaction type ids to labels.',
      });
    } else {
      for (const [typeId, label] of Object.entries(input.interactionTypes)) {
        if (!isNonEmptyString(label)) {
          pushDiagnostic(diagnostics, {
            code: "invalid-interaction-type-value",
            key: typeId,
            severity: "error",
            message: `Catalog interactionTypes["${typeId}"] must be a string.`,
          });
          continue;
        }
        normalized.interactionTypes[typeId] = label;
      }
    }
  }

  if ("directions" in input && input.directions !== undefined) {
    if (!isPlainObject(input.directions)) {
      pushDiagnostic(diagnostics, {
        code: "invalid-directions-field",
        key: "directions",
        severity: "error",
        message: 'Catalog "directions" must be an object mapping direction ids to labels.',
      });
    } else {
      for (const [direction, label] of Object.entries(input.directions)) {
        if (!VALID_DIRECTION_KEYS.has(direction as QtiPlayerMovementDirection)) {
          pushDiagnostic(diagnostics, {
            code: "invalid-direction-key",
            key: direction,
            severity: "error",
            message: `Unknown direction key "${direction}". Use up, down, left, or right.`,
          });
          continue;
        }
        if (!isNonEmptyString(label)) {
          pushDiagnostic(diagnostics, {
            code: "invalid-direction-value",
            key: direction,
            severity: "error",
            message: `Catalog directions["${direction}"] must be a string.`,
          });
          continue;
        }
        normalized.directions[direction as QtiPlayerMovementDirection] = label;
      }
    }
  }

  for (const field of Object.keys(input)) {
    if (
      field === "locale" ||
      field === "strings" ||
      field === "interactionTypes" ||
      field === "directions"
    ) {
      continue;
    }
    pushDiagnostic(diagnostics, {
      code: "invalid-catalog-field",
      key: field,
      severity: "error",
      message: `Unknown catalog field "${field}".`,
    });
  }

  return normalized;
}

function validateNormalizedCatalog(
  catalog: NormalizedCatalog,
  options: ValidatePlayerMessageCatalogOptions,
  diagnostics: PlayerMessageCatalogDiagnostic[],
): void {
  const strings = catalog.strings;

  for (const key of Object.keys(strings)) {
    if (!isManifestStringKey(key)) {
      pushDiagnostic(diagnostics, {
        code: "unknown-string-key",
        key,
        severity: "error",
        message: `Unknown catalog string key "${key}". See PLAYER_MESSAGE_KEYS.`,
      });
      continue;
    }

    const entry = manifestEntryForStringKey(key);
    const template = strings[key];
    if (!entry || template === undefined) continue;

    validateTemplate(key, template, entry, diagnostics);
  }

  if (options.requireAllKeys) {
    for (const entry of PLAYER_MESSAGE_MANIFEST) {
      const hasBase = strings[entry.key] !== undefined;
      const hasPlural =
        entry.resolver === "plural" &&
        (strings[`${entry.key}.one`] !== undefined || strings[`${entry.key}.other`] !== undefined);
      if (entry.resolver === "typeLabel") {
        continue;
      }
      if (entry.resolver === "plural") {
        if (!hasBase && !hasPlural) {
          pushDiagnostic(diagnostics, {
            code: "missing-message-key",
            key: entry.key,
            severity: "error",
            message: `Missing message "${entry.key}" (or "${entry.key}.one" / "${entry.key}.other").`,
          });
        }
        if (
          !strings[`${entry.key}.one`] &&
          defaultPlayerMessageCatalog.strings[`${entry.key}.one`]
        ) {
          pushDiagnostic(diagnostics, {
            code: "missing-plural-form",
            key: `${entry.key}.one`,
            severity: "warning",
            message: `Missing plural form "${entry.key}.one". English fallback will be used.`,
          });
        }
        if (
          !strings[`${entry.key}.other`] &&
          defaultPlayerMessageCatalog.strings[`${entry.key}.other`]
        ) {
          pushDiagnostic(diagnostics, {
            code: "missing-plural-form",
            key: `${entry.key}.other`,
            severity: "warning",
            message: `Missing plural form "${entry.key}.other". English fallback will be used.`,
          });
        }
      } else if (!hasBase) {
        pushDiagnostic(diagnostics, {
          code: "missing-message-key",
          key: entry.key,
          severity: "error",
          message: `Missing message "${entry.key}".`,
        });
      }
    }
  }
}

/**
 * Validates host player chrome JSON against {@link PLAYER_MESSAGE_MANIFEST}.
 * Accepts raw `JSON.parse` output (`unknown`); returns structured diagnostics instead of throwing.
 */
export function validatePlayerMessageCatalog(
  catalog: unknown,
  options: ValidatePlayerMessageCatalogOptions = {},
): PlayerMessageCatalogValidationResult {
  const diagnostics: PlayerMessageCatalogDiagnostic[] = [];
  const normalized = normalizeCatalogInput(catalog, diagnostics);
  if (!normalized) {
    return { valid: false, diagnostics };
  }

  validateNormalizedCatalog(normalized, options, diagnostics);

  const errors = diagnostics.filter((item) => item.severity === "error");
  return { valid: errors.length === 0, diagnostics };
}
