import type { PlayerMessageCatalog } from "./player-message-catalog.js";
import { applyPlayerMessageOverrides } from "./player-message-overrides.js";
import {
  createPlayerMessageResolver,
  defaultPlayerMessageResolver,
  type PlayerMessageResolver,
} from "./player-message-resolver.js";
import { warnPlayerMessageOnce } from "./player-dev.js";
import type { QtiPlayerMessageOverrides } from "./player-message-resolver.js";

function isEnglishLocale(locale: string): boolean {
  const normalized = normalizedLocale(locale) ?? locale;
  return normalized.toLowerCase().startsWith("en");
}

/**
 * Resolves player chrome messages: catalog (or English defaults) merged with overrides.
 * `locale` does not select built-in catalogs; use `catalog` via `player.messageCatalog`.
 */
export function resolvePlayerMessages(
  locale: string,
  overrides: QtiPlayerMessageOverrides,
  catalog?: PlayerMessageCatalog,
): PlayerMessageResolver {
  if (!catalog && !isEnglishLocale(locale) && Object.keys(overrides).length === 0) {
    warnPlayerMessageOnce(
      `locale-without-catalog:${locale}`,
      `language-of-interface is "${locale}" but no player.messageCatalog was set; chrome stays English. Load a locale file and assign player.messageCatalog.`,
    );
  }
  const base = catalog ? createPlayerMessageResolver(catalog) : defaultPlayerMessageResolver;
  return applyPlayerMessageOverrides(base, overrides);
}

export function normalizedLocale(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function defaultPlayerLocale(host?: Element): string {
  const elementLanguage = normalizedLocale(host?.getAttribute("lang"));
  if (elementLanguage) return elementLanguage;

  const navigatorLanguages = globalThis.navigator?.languages ?? [];
  for (const language of navigatorLanguages) {
    const normalized = normalizedLocale(language);
    if (normalized) return normalized;
  }
  return (
    normalizedLocale(globalThis.navigator?.language) ??
    normalizedLocale(host?.closest("[lang]")?.getAttribute("lang")) ??
    normalizedLocale(host?.ownerDocument?.documentElement.lang) ??
    normalizedLocale(globalThis.document?.documentElement.lang) ??
    "en"
  );
}
