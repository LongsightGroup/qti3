import type {
  QtiCatalogSelectionReason,
  QtiCatalogSupportResolution,
  QtiSourceLocation,
} from "@longsightgroup/qti3-core";
import { isResolvableAssetUrl } from "@longsightgroup/qti3-core";
import { isSafeResolvedAssetUrl } from "./content/content-dom.js";
import type { SafeProjectedContentNode } from "./content/safe-content-projection.js";
import { projectSafeContentNodes } from "./content/safe-content-projection.js";
import type { QtiPlayerResolveAsset } from "./player-types.js";

/** A sanitized catalog content node that hosts can render without parsing an HTML string. */
export type QtiCatalogDeliveryNode = SafeProjectedContentNode;

/** A safe external catalog resource reference with its authored MIME type. */
export interface QtiCatalogDeliveryFile {
  readonly href: string;
  readonly mimeType?: string | undefined;
  readonly source?: QtiSourceLocation | undefined;
}

/** Candidate content selected for one catalog support. */
export interface QtiCatalogDeliverySupport {
  readonly catalogId: string;
  readonly support: string;
  readonly language?: string | undefined;
  readonly default: boolean;
  readonly selectionReason: QtiCatalogSelectionReason;
  readonly html: readonly QtiCatalogDeliveryNode[];
  readonly files: readonly QtiCatalogDeliveryFile[];
  readonly source?: QtiSourceLocation | undefined;
}

/** A catalog reference projected for safe host delivery. */
export interface QtiCatalogDeliveryReference {
  readonly referenceId: string;
  readonly catalogId: string;
  readonly qtiName: string;
  readonly availableSupports: readonly string[];
  readonly matches: readonly QtiCatalogDeliverySupport[];
  readonly source?: QtiSourceLocation | undefined;
}

/** Sanitized and asset-resolved catalog data for an item. */
export interface QtiCatalogDeliveryResolution {
  readonly itemIdentifier: string;
  readonly references: readonly QtiCatalogDeliveryReference[];
}

/** Projects raw catalog resolution into a safe, framework-neutral delivery tree. */
export function createCatalogDeliveryResolution(
  resolution: QtiCatalogSupportResolution,
  resolveAsset?: QtiPlayerResolveAsset,
): QtiCatalogDeliveryResolution {
  return {
    itemIdentifier: resolution.itemIdentifier,
    references: resolution.references.map((reference) => ({
      referenceId: reference.referenceId,
      catalogId: reference.idref,
      qtiName: reference.qtiName,
      availableSupports: reference.catalog?.cards.map((card) => card.support) ?? [],
      matches: reference.matches.map((match) => ({
        catalogId: match.catalogId,
        support: match.support,
        language: match.language,
        default: match.default,
        selectionReason: match.selectionReason,
        html: projectSafeContentNodes(match.htmlContent?.children ?? [], resolveAsset),
        files: match.fileHrefs.flatMap((file) => {
          const href = resolveSafeCatalogUrl(file.href, resolveAsset);
          if (!href) return [];
          return [{ href, mimeType: file.mimeType, source: file.source }];
        }),
        source: match.source,
      })),
      source: reference.source,
    })),
  };
}

function resolveSafeCatalogUrl(
  url: string,
  resolveAsset: QtiPlayerResolveAsset | undefined,
): string | undefined {
  const resolved = resolveAsset && isResolvableAssetUrl(url) ? resolveAsset(url) : url;
  return isSafeResolvedAssetUrl(resolved) ? resolved : undefined;
}
