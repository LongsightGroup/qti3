import { pushPackageDiagnostic } from "./qti-package-paths.js";
import { collectPackageAssets } from "./qti-package-assets.js";
import {
  detectPackageShape,
  diagnoseManifestDependencyReferences,
  diagnosePrimaryResourceHrefs,
  indexManifestResources,
  isQtiAssessmentTestResource,
  isQtiItemResource,
  parseManifestResources,
  QTI_PACKAGE_MANIFEST_PATH,
} from "./qti-package-manifest.js";
import {
  itemReferencesForPackageShape,
  parseAssessmentTestPackageModel,
  parsePackageItems,
} from "./qti-package-items.js";
import {
  packageTitle,
  parseStandardAlignments,
  primaryTiming,
  uniqueStandards,
} from "./qti-package-metadata.js";
import type {
  QtiManifestResource,
  QtiPackageParseResult,
  QtiPackageShape,
} from "./qti-package-types.js";
import { parseXmlFiles, pushXmlDiagnostics } from "./qti-package-xml.js";
import {
  decodeUtf8,
  readQtiPackageZipEntries,
  type QtiPackageEntry,
  type QtiPackageParseOptions,
} from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

export { decodeUtf8, readQtiPackageZipEntries };
export { normalizePackagePath } from "./qti-package-paths.js";
export type { QtiPackageEntry };

export type {
  QtiAssessmentTestItemRef,
  QtiAssessmentTestPackageModel,
  QtiManifestFile,
  QtiManifestResource,
  QtiPackageAsset,
  QtiPackageAssetSource,
  QtiPackageItem,
  QtiPackageItemSource,
  QtiPackageParseResult,
  QtiPackageShape,
  QtiStandardAlignment,
  QtiTimingMetadata,
} from "./qti-package-types.js";

export type {
  QtiPackageInflateContext,
  QtiPackageInflateRaw,
  QtiPackageParseOptions,
} from "./qti-package-zip.js";

/** Parse a QTI ZIP package into a neutral manifest, item, asset, and diagnostic model. */
export function parseQtiPackage(
  bytes: Uint8Array,
  options: QtiPackageParseOptions = {},
): QtiPackageParseResult {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(bytes, options, diagnostics);
  return parseQtiPackageEntries(entries, options, diagnostics);
}

function parseQtiPackageEntries(
  entries: readonly QtiPackageEntry[],
  options: QtiPackageParseOptions,
  diagnostics: QtiDiagnostic[],
): QtiPackageParseResult {
  const entriesByPath = indexEntries(entries, diagnostics);
  const xmlFilesByPath = parseXmlFiles(entriesByPath);
  const manifestXml = xmlFilesByPath.get(QTI_PACKAGE_MANIFEST_PATH);

  if (!manifestXml) {
    pushPackageDiagnostic(
      diagnostics,
      "package.manifest.missing",
      "error",
      "QTI package does not contain imsmanifest.xml.",
      QTI_PACKAGE_MANIFEST_PATH,
    );
  } else {
    pushXmlDiagnostics(manifestXml, diagnostics);
  }

  const manifestRoot = manifestXml?.root?.localName === "manifest" ? manifestXml.root : undefined;
  if (manifestXml?.root && !manifestRoot) {
    pushPackageDiagnostic(
      diagnostics,
      "package.manifest.root",
      "error",
      `Expected imsmanifest.xml root manifest, found ${manifestXml.root.localName}.`,
      QTI_PACKAGE_MANIFEST_PATH,
    );
  }

  const manifestResourceRecords = manifestRoot
    ? parseManifestResources(manifestRoot, entriesByPath, diagnostics)
    : [];
  const manifestResources = manifestResourceRecords;
  const resourcesByIdentifier = indexManifestResources(manifestResourceRecords, diagnostics);
  diagnoseManifestDependencyReferences(manifestResourceRecords, resourcesByIdentifier, diagnostics);

  const itemResources = manifestResourceRecords.filter((resource) =>
    isQtiItemResource(resource.type),
  );
  const assessmentTestResources = manifestResourceRecords.filter((resource) =>
    isQtiAssessmentTestResource(resource.type),
  );
  diagnosePrimaryResourceHrefs([...itemResources, ...assessmentTestResources], diagnostics);

  const packageShape = resolvePackageShape(
    itemResources,
    assessmentTestResources,
    options,
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
  const assets = collectPackageAssets(
    resourcesByIdentifier,
    assessmentTest,
    items,
    entriesByPath,
    diagnostics,
  );
  const manifestStandards = manifestRoot
    ? parseStandardAlignments(manifestRoot, QTI_PACKAGE_MANIFEST_PATH)
    : [];
  const standards = uniqueStandards([
    ...manifestStandards,
    ...(assessmentTest?.standards ?? []),
    ...items.flatMap((item) => item.standards),
  ]);
  const timing = primaryTiming(assessmentTest, items);
  const title = packageTitle(manifestRoot, assessmentTest, items);

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    title,
    packageShape,
    items,
    assets,
    manifestResources,
    assessmentTest,
    timing,
    standards,
    diagnostics,
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

function resolvePackageShape(
  itemResources: readonly QtiManifestResource[],
  assessmentTestResources: readonly QtiManifestResource[],
  options: QtiPackageParseOptions,
  diagnostics: QtiDiagnostic[],
): QtiPackageShape {
  if (
    options.manifestShapePolicy === "prefer-assessment-test" &&
    assessmentTestResources.length > 0
  ) {
    return "assessment-test-resource";
  }

  return detectPackageShape(itemResources, assessmentTestResources, diagnostics);
}
