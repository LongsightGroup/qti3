import type { QtiPlayerMessages } from "./player-messages.js";
import type { QtiPlayerMessageOverrides } from "./player-types.js";

const defaultEnglishPlayerMessages: QtiPlayerMessages = {
  remove: () => "Remove",
  removePair: ({ label }) => `Remove ${label}`,
};

const playerMessages = {
  defaultEnglish: defaultEnglishPlayerMessages,
  spanish: playerMessageCatalog("Quitar", ({ label }) => `Quitar ${label}`),
  swedish: playerMessageCatalog("Ta bort", ({ label }) => `Ta bort ${label}`),
  german: playerMessageCatalog("Entfernen", ({ label }) => `${label} entfernen`),
  portuguese: playerMessageCatalog("Remover", ({ label }) => `Remover ${label}`),
  french: playerMessageCatalog("Supprimer", ({ label }) => `Supprimer ${label}`),
};

const builtInPlayerMessageCatalogs: ReadonlyMap<string, QtiPlayerMessages> = new Map([
  ["en", playerMessages.defaultEnglish],
  ["es", playerMessages.spanish],
  ["es-es", playerMessages.spanish],
  ["es-mx", playerMessages.spanish],
  ["sv", playerMessages.swedish],
  ["sv-se", playerMessages.swedish],
  ["de", playerMessages.german],
  ["de-de", playerMessages.german],
  ["pt", playerMessages.portuguese],
  ["pt-br", playerMessages.portuguese],
  ["pt-pt", playerMessages.portuguese],
  ["fr", playerMessages.french],
  ["fr-ca", playerMessages.french],
  ["fr-fr", playerMessages.french],
]);

function playerMessageCatalog(
  remove: string,
  removePair: QtiPlayerMessages["removePair"],
): QtiPlayerMessages {
  return {
    remove: () => remove,
    removePair,
  };
}

export function resolvePlayerMessages(
  locale: string,
  overrides: QtiPlayerMessageOverrides,
): QtiPlayerMessages {
  const catalog = builtInPlayerMessageCatalog(locale);
  return {
    remove: overrides.remove ?? catalog?.remove ?? defaultEnglishPlayerMessages.remove,
    removePair:
      overrides.removePair ?? catalog?.removePair ?? defaultEnglishPlayerMessages.removePair,
  };
}

function builtInPlayerMessageCatalog(locale: string): QtiPlayerMessages | undefined {
  for (const candidate of localeFallbacks(locale)) {
    const catalog = builtInPlayerMessageCatalogs.get(candidate);
    if (catalog) return catalog;
  }
  return undefined;
}

function localeFallbacks(locale: string): string[] {
  const normalized = normalizedLocale(locale)?.toLowerCase();
  if (!normalized) return ["en"];
  const parts = normalized.split("-");
  const fallbacks: string[] = [];
  for (let length = parts.length; length > 0; length -= 1) {
    fallbacks.push(parts.slice(0, length).join("-"));
  }
  return fallbacks.includes("en") ? fallbacks : [...fallbacks, "en"];
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

