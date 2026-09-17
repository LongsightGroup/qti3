import { normalizePackagePath, pushPackageDiagnostic } from "./qti-package-paths.js";
import { QTI_PACKAGE_MANIFEST_PATH } from "./qti-package-manifest.js";
import {
  buildPackageSummary,
  failedPackageSummary,
  inspectPackageManifest,
} from "./qti-package-plan.js";
import {
  itemReferencesForPackageShape,
  parseAssessmentTestPackageModel,
  parsePackageItems,
} from "./qti-package-items.js";
import type { QtiPackageParseResult } from "./qti-package-types.js";
import { parseXmlFiles } from "./qti-package-xml.js";
import {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  decodeUtf8,
  readQtiPackageZipEntries,
  readQtiPackageZipEntriesAsync,
  resolveResourceLimits,
  type QtiPackageEntry,
  type QtiPackageParseOptions,
} from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

export {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  decodeUtf8,
  readQtiPackageZipEntries,
  readQtiPackageZipEntriesAsync,
};
export { discoverQtiPackageContentAssets } from "./qti-package-assets.js";
export { normalizePackagePath } from "./qti-package-paths.js";
export { scopeDiagnosticToPackagePath } from "./qti-package-xml.js";
export {
  QTI_ITEM_RESOURCE_TYPE,
  QTI_PACKAGE_MANIFEST_PATH,
  isQtiItemResource,
} from "./qti-package-manifest.js";
export type { QtiPackageEntry };

export type {
  QtiAssessmentSectionPackageModel,
  QtiAssessmentTestItemRef,
  QtiAssessmentTestPackageModel,
  QtiManifestFile,
  QtiManifestResource,
  QtiPackageAsset,
  QtiPackageContentAssetDiscovery,
  QtiPackageAssetSource,
  QtiPackageItem,
  QtiPackageItemSource,
  QtiPackageParseResult,
  QtiPackageShape,
  QtiItemSessionControl,
  QtiStandardAlignment,
  QtiTestPartNavigationMode,
  QtiTestPartPackageModel,
  QtiTestPartSubmissionMode,
  QtiTimeLimits,
  QtiTimingMetadata,
} from "./qti-package-types.js";

export type {
  QtiPackageInflateContext,
  QtiPackageInflateRaw,
  QtiPackageInflateRawAsync,
  QtiPackageZipAsyncOptions,
  QtiPackageParseOptions,
  QtiPackageResourceLimits,
} from "./qti-package-zip.js";

/** Parse a QTI ZIP package into a neutral manifest, item, asset, and diagnostic model. */
export function parseQtiPackage(
  bytes: Uint8Array,
  options: QtiPackageParseOptions = {},
): QtiPackageParseResult {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(bytes, options, diagnostics);
  return parseQtiPackageEntries(entries, diagnostics);
}

/**
 * Parse already extracted or restored entries with the same package semantics as ZIP input.
 * Paths must be unique and canonical. Entry count and expanded byte limits apply;
 * compression-ratio limits are irrelevant after extraction. Inspect ok before use.
 */
export function parseQtiPackageFromEntries(
  entries: readonly QtiPackageEntry[],
  options: Pick<QtiPackageParseOptions, "limits"> = {},
): QtiPackageParseResult {
  const diagnostics: QtiDiagnostic[] = [];
  const limits = resolveResourceLimits(options.limits, diagnostics);
  if (limits) {
    if (entries.length > limits.maxEntries) {
      pushPackageDiagnostic(
        diagnostics,
        "package.entries.limit",
        "error",
        "Package contains more entries than allowed.",
      );
    } else {
      let total = 0;
      const paths = new Set<string>();
      for (const entry of entries) {
        const path = normalizePackagePath(entry.path, "entry", diagnostics);
        if (path === undefined) break;
        if (!path || path !== entry.path || path.includes("\\") || path.includes("\0")) {
          pushPackageDiagnostic(
            diagnostics,
            "package.entry.path",
            "error",
            "Package entry paths must be canonical and package-relative.",
            entry.path,
          );
          break;
        }
        if (paths.has(path)) {
          pushPackageDiagnostic(
            diagnostics,
            "package.entry.duplicate",
            "error",
            `QTI package contains duplicate entry ${path}.`,
            path,
          );
          break;
        }
        paths.add(path);
        total += entry.bytes.byteLength;
        if (
          entry.bytes.byteLength > limits.maxEntryUncompressedBytes ||
          !Number.isSafeInteger(total) ||
          total > limits.maxTotalUncompressedBytes
        ) {
          pushPackageDiagnostic(
            diagnostics,
            "package.bytes.limit",
            "error",
            "Package entry or total size exceeds its configured budget.",
            path,
          );
          break;
        }
      }
    }
  }
  if (diagnostics.length) {
    const { itemCount: _itemCount, ...summary } = failedPackageSummary(diagnostics);
    return { ...summary, entries: [], items: [] };
  }
  return parseQtiPackageEntries(entries, diagnostics);
}

function parseQtiPackageEntries(
  entries: readonly QtiPackageEntry[],
  diagnostics: QtiDiagnostic[],
): QtiPackageParseResult {
  const entriesByPath = indexEntries(entries, diagnostics);
  const xmlFilesByPath = parseXmlFiles(entriesByPath);
  const {
    manifestRoot,
    manifestResources,
    resourcesByIdentifier,
    itemResources,
    assessmentTestResources,
    packageShape,
  } = inspectPackageManifest(
    entriesByPath,
    xmlFilesByPath.get(QTI_PACKAGE_MANIFEST_PATH),
    diagnostics,
  );
  const assessmentTest = parseAssessmentTestPackageModel(
    packageShape,
    assessmentTestResources,
    entriesByPath,
    xmlFilesByPath,
    diagnostics,
  );
  const itemReferences = itemReferencesForPackageShape(
    packageShape,
    itemResources,
    assessmentTest,
    diagnostics,
  );
  const items = parsePackageItems(itemReferences, entriesByPath, xmlFilesByPath, diagnostics);
  const timedItems = items.filter((item) => item.timing !== undefined);
  const { itemCount: _itemCount, ...summary } = buildPackageSummary({
    manifestRoot,
    manifestResources,
    resourcesByIdentifier,
    packageShape,
    assessmentTest,
    assetItems: items,
    titleItems: items,
    timedItemCount: timedItems.length,
    soleItemTiming: timedItems.length === 1 ? timedItems[0]?.timing : undefined,
    itemStandards: items.flatMap((item) => item.standards),
    entriesByPath,
    diagnostics,
    itemCount: items.length,
  });

  return {
    ...summary,
    entries,
    items,
  };
}

function indexEntries(
  entries: readonly QtiPackageEntry[],
  diagnostics: QtiDiagnostic[],
): Map<string, QtiPackageEntry> {
  const entriesByPath = new Map<string, QtiPackageEntry>();
  for (const entry of entries) {
    if (entriesByPath.has(entry.path)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.entry.duplicate",
        "error",
        `QTI package contains duplicate entry ${entry.path}.`,
        entry.path,
      );
      continue;
    }
    entriesByPath.set(entry.path, entry);
  }
  return entriesByPath;
}
