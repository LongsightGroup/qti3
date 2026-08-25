import { playerDevWarningsEnabled, warnPlayerMessageOnce } from "./player-dev.js";
import type { QtiPlayerMovementDirection } from "./player-messages.js";

export { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";

/** JSON-serializable chrome strings for host and LMS locale files. */
export interface PlayerMessageCatalog {
  /** BCP 47 tag (metadata only). */
  locale?: string;
  /** Message templates; use `{name}` placeholders. Plural forms: `key.one` / `key.other`. */
  strings: Record<string, string>;
  /** QTI interaction type id → short label inserted as `{typeName}`. */
  interactionTypes?: Record<string, string>;
  /** Labels for moveChoice / movePoint / moveObject (`{direction}`). */
  directions?: Partial<Record<QtiPlayerMovementDirection, string>>;
}

export function mergePlayerMessageCatalogs(
  base: PlayerMessageCatalog,
  partial: Partial<PlayerMessageCatalog>,
): PlayerMessageCatalog {
  const merged: PlayerMessageCatalog = {
    strings: { ...base.strings, ...partial.strings },
  };
  const interactionTypes = { ...base.interactionTypes, ...partial.interactionTypes };
  if (Object.keys(interactionTypes).length > 0) {
    merged.interactionTypes = interactionTypes;
  }
  const directions = { ...base.directions, ...partial.directions };
  if (Object.keys(directions).length > 0) {
    merged.directions = directions;
  }
  const locale = partial.locale ?? base.locale;
  if (locale !== undefined) {
    merged.locale = locale;
  }
  return merged;
}

export function extractMessagePlaceholders(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    names.add(match[1] ?? "");
  }
  return [...names].filter(Boolean);
}

export function formatPlayerMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  const placeholders = extractMessagePlaceholders(template);
  const missing = placeholders.filter((name) => values[name] === undefined);
  if (missing.length > 0 && playerDevWarningsEnabled()) {
    warnPlayerMessageOnce(
      `missing-placeholder-values:${missing.join(",")}`,
      `Player message template is missing values for: ${missing.map((name) => `{${name}}`).join(", ")}.`,
    );
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}
