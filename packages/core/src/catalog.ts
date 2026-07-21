import type {
  QtiAssessmentItem,
  QtiCatalog,
  QtiCatalogCard,
  QtiCatalogCardEntry,
  QtiCatalogFileHref,
  QtiCatalogHtmlContent,
  QtiDocument,
  QtiSourceLocation,
} from "./types.js";

export interface QtiCatalogSupportResolutionOptions {
  supports?: string | readonly string[] | undefined;
  languages?: string | readonly string[] | undefined;
  includeDefaultFallback?: boolean | undefined;
}

export interface QtiCatalogSupportResolution {
  itemIdentifier: string;
  references: QtiResolvedCatalogReference[];
}

export interface QtiResolvedCatalogReference {
  referenceId: string;
  idref: string;
  qtiName: string;
  catalog?: QtiCatalog | undefined;
  matches: QtiResolvedCatalogSupport[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiResolvedCatalogSupport {
  catalogId: string;
  support: string;
  default: boolean;
  selectionReason: QtiCatalogSelectionReason;
  fileHrefs: QtiCatalogFileHref[];
  attributes: Record<string, string>;
  cardAttributes: Record<string, string>;
  catalogAttributes: Record<string, string>;
  language?: string | undefined;
  htmlContent?: QtiCatalogHtmlContent | undefined;
  source?: QtiSourceLocation | undefined;
  cardSource?: QtiSourceLocation | undefined;
  catalogSource?: QtiSourceLocation | undefined;
}

/** Explains why a catalog card or card entry was returned by language resolution. */
export type QtiCatalogSelectionReason =
  | "available"
  | "default"
  | "exact-language"
  | "primary-language"
  | "unlanguaged";

interface Candidate {
  card: QtiCatalogCard;
  default: boolean;
  fileHrefs: QtiCatalogFileHref[];
  attributes: Record<string, string>;
  language?: string | undefined;
  htmlContent?: QtiCatalogHtmlContent | undefined;
  source?: QtiSourceLocation | undefined;
  selectionReason?: QtiCatalogSelectionReason | undefined;
}

export function createCatalogSupportResolution(
  model: QtiDocument | QtiAssessmentItem,
  options: QtiCatalogSupportResolutionOptions = {},
): QtiCatalogSupportResolution {
  const item = "item" in model ? model.item : model;
  const supportFilter = stringFilter(options.supports);
  const languages = stringList(options.languages).map((language) => language.toLowerCase());
  const catalogById = new Map(
    item.catalogInfo?.catalogs.map((catalog) => [catalog.id, catalog] as const) ?? [],
  );

  return {
    itemIdentifier: item.identifier,
    references: item.catalogReferences.map((reference) => {
      const catalog = catalogById.get(reference.idref);
      const resolved: QtiResolvedCatalogReference = {
        referenceId: reference.referenceId,
        idref: reference.idref,
        qtiName: reference.qtiName,
        matches: catalog ? matchingCatalogSupports(catalog, supportFilter, languages, options) : [],
      };
      if (catalog) resolved.catalog = catalog;
      if (reference.source) resolved.source = reference.source;
      return resolved;
    }),
  };
}

function matchingCatalogSupports(
  catalog: QtiCatalog,
  supportFilter: Set<string> | undefined,
  languages: string[],
  options: QtiCatalogSupportResolutionOptions,
): QtiResolvedCatalogSupport[] {
  return catalog.cards.flatMap((card) => {
    if (supportFilter && !supportFilter.has(card.support.toLowerCase())) return [];
    return selectedCandidates(card, languages, options).map((candidate) =>
      resolvedSupport(catalog, candidate),
    );
  });
}

function selectedCandidates(
  card: QtiCatalogCard,
  languages: string[],
  options: QtiCatalogSupportResolutionOptions,
): Candidate[] {
  const candidates = catalogCandidates(card);
  if (languages.length === 0) {
    const defaults = candidates.filter((candidate) => candidate.default);
    return withSelectionReason(
      defaults.length > 0 ? defaults : candidates,
      defaults.length > 0 ? "default" : "available",
    );
  }

  const languageMatches = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      match: languageMatch(candidate.language, languages),
    }))
    .filter(
      (
        entry,
      ): entry is {
        candidate: Candidate;
        index: number;
        match: LanguageMatch;
      } => entry.match !== undefined,
    )
    .toSorted((a, b) => a.match.rank - b.match.rank || a.index - b.index);
  const bestLanguageRank = languageMatches[0]?.match.rank;
  if (bestLanguageRank !== undefined) {
    return languageMatches
      .filter((entry) => entry.match.rank === bestLanguageRank)
      .map((entry) => ({ ...entry.candidate, selectionReason: entry.match.reason }));
  }
  if (options.includeDefaultFallback === false) return [];
  const defaults = candidates.filter((candidate) => candidate.default);
  if (defaults.length > 0) return withSelectionReason(defaults, "default");
  return withSelectionReason(
    candidates.filter((candidate) => !candidate.language),
    "unlanguaged",
  );
}

function withSelectionReason(
  candidates: Candidate[],
  selectionReason: QtiCatalogSelectionReason,
): Candidate[] {
  return candidates.map((candidate) => ({ ...candidate, selectionReason }));
}

function catalogCandidates(card: QtiCatalogCard): Candidate[] {
  if (card.entries.length > 0) {
    return card.entries.map((entry) => entryCandidate(card, entry));
  }
  return [
    {
      card,
      default: true,
      fileHrefs: card.fileHrefs,
      attributes: card.attributes,
      language: card.language,
      htmlContent: card.htmlContent,
      source: card.source,
    },
  ];
}

function entryCandidate(card: QtiCatalogCard, entry: QtiCatalogCardEntry): Candidate {
  const candidate: Candidate = {
    card,
    default: entry.default,
    fileHrefs: entry.fileHrefs,
    attributes: entry.attributes,
  };
  if (entry.language) candidate.language = entry.language;
  if (entry.htmlContent) candidate.htmlContent = entry.htmlContent;
  if (entry.source) candidate.source = entry.source;
  return candidate;
}

function resolvedSupport(catalog: QtiCatalog, candidate: Candidate): QtiResolvedCatalogSupport {
  const resolved: QtiResolvedCatalogSupport = {
    catalogId: catalog.id,
    support: candidate.card.support,
    default: candidate.default,
    selectionReason: candidate.selectionReason ?? "available",
    fileHrefs: candidate.fileHrefs,
    attributes: candidate.attributes,
    cardAttributes: candidate.card.attributes,
    catalogAttributes: catalog.attributes,
  };
  if (candidate.language) resolved.language = candidate.language;
  if (candidate.htmlContent) resolved.htmlContent = candidate.htmlContent;
  if (candidate.source) resolved.source = candidate.source;
  if (candidate.card.source) resolved.cardSource = candidate.card.source;
  if (catalog.source) resolved.catalogSource = catalog.source;
  return resolved;
}

interface LanguageMatch {
  rank: number;
  reason: Extract<QtiCatalogSelectionReason, "exact-language" | "primary-language">;
}

function languageMatch(
  language: string | undefined,
  requestedLanguages: string[],
): LanguageMatch | undefined {
  if (!language) return undefined;
  const normalizedLanguage = language.toLowerCase();
  const primaryLanguage = normalizedLanguage.split("-")[0] ?? normalizedLanguage;
  for (const [index, requestedLanguage] of requestedLanguages.entries()) {
    if (normalizedLanguage === requestedLanguage) {
      return { rank: index * 3, reason: "exact-language" };
    }
    const requestedPrimary = requestedLanguage.split("-")[0] ?? requestedLanguage;
    if (primaryLanguage === requestedPrimary) {
      return {
        rank: index * 3 + (normalizedLanguage === requestedPrimary ? 1 : 2),
        reason: "primary-language",
      };
    }
  }
  return undefined;
}

function stringFilter(value: string | readonly string[] | undefined): Set<string> | undefined {
  const values = stringList(value).map((entry) => entry.toLowerCase());
  return values.length > 0 ? new Set(values) : undefined;
}

function stringList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
