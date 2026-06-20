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
  idref: string;
  catalog?: QtiCatalog | undefined;
  matches: QtiResolvedCatalogSupport[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiResolvedCatalogSupport {
  catalogId: string;
  support: string;
  default: boolean;
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

interface Candidate {
  card: QtiCatalogCard;
  default: boolean;
  fileHrefs: QtiCatalogFileHref[];
  attributes: Record<string, string>;
  language?: string | undefined;
  htmlContent?: QtiCatalogHtmlContent | undefined;
  source?: QtiSourceLocation | undefined;
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
        idref: reference.idref,
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
    return defaults.length > 0 ? defaults : candidates;
  }

  const languageMatches = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      rank: languageMatchRank(candidate.language, languages),
    }))
    .filter((entry): entry is { candidate: Candidate; index: number; rank: number } =>
      Number.isInteger(entry.rank),
    )
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index);
  if (languageMatches.length > 0) return languageMatches.map((entry) => entry.candidate);
  if (options.includeDefaultFallback === false) return [];
  const defaults = candidates.filter((candidate) => candidate.default);
  return defaults.length > 0 ? defaults : candidates.filter((candidate) => !candidate.language);
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

function languageMatchRank(
  language: string | undefined,
  requestedLanguages: string[],
): number | undefined {
  if (!language) return undefined;
  const normalizedLanguage = language.toLowerCase();
  const primaryLanguage = normalizedLanguage.split("-")[0] ?? normalizedLanguage;
  for (const [index, requestedLanguage] of requestedLanguages.entries()) {
    if (normalizedLanguage === requestedLanguage) return index * 2;
    const requestedPrimary = requestedLanguage.split("-")[0] ?? requestedLanguage;
    if (primaryLanguage === requestedPrimary) return index * 2 + 1;
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
