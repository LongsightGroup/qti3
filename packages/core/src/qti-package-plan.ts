import type { QtiPackageXmlNode } from "./package-xml.js";
import { collectPackageAssets } from "./qti-package-assets.js";
import { QTI_PACKAGE_MANIFEST_PATH } from "./qti-package-manifest.js";
import {
  packageTitle,
  parseStandardAlignments,
  primaryTimingFromScan,
  uniqueStandards,
} from "./qti-package-metadata.js";
import { pushPackageDiagnostic } from "./qti-package-paths.js";
import {
  detectPackageShape,
  diagnoseManifestDependencyReferences,
  diagnosePrimaryResourceHrefs,
  indexManifestResources,
  isQtiAssessmentTestResource,
  isQtiItemResource,
  parseManifestResources,
} from "./qti-package-manifest.js";
import { pushXmlDiagnostics, type PackageXmlFile } from "./qti-package-xml.js";
import type {
  QtiAssessmentTestPackageModel,
  QtiManifestResource,
  QtiPackageItem,
  QtiPackageParseResult,
  QtiPackageShape,
  QtiStandardAlignment,
  QtiTimingMetadata,
} from "./qti-package-types.js";
import { QTI_PACKAGE_MANIFEST_NAMESPACE } from "./qti-namespaces.js";
import type { QtiDiagnostic } from "./types.js";

/** Package metadata without extracted bodies or retained item models. */
export type QtiPackageSummary = Omit<QtiPackageParseResult, "items" | "entries" | "xmlFiles"> & {
  readonly itemCount: number;
};

/** Inspect manifest semantics against an entry inventory without reading item bodies. */
export function inspectPackageManifest(
  entriesByPath: { has(path: string): boolean },
  manifestXml: PackageXmlFile | undefined,
  diagnostics: QtiDiagnostic[],
) {
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

  const manifestRoot =
    manifestXml?.root?.localName === "manifest" &&
    manifestXml.root.uri === QTI_PACKAGE_MANIFEST_NAMESPACE
      ? manifestXml.root
      : undefined;
  if (manifestXml?.root && !manifestRoot) {
    pushPackageDiagnostic(
      diagnostics,
      "package.manifest.root",
      "error",
      manifestXml.root.localName === "manifest"
        ? `Expected imsmanifest.xml manifest in namespace ${QTI_PACKAGE_MANIFEST_NAMESPACE}, found ${manifestXml.root.uri ?? "(none)"}.`
        : `Expected imsmanifest.xml root manifest, found ${manifestXml.root.localName}.`,
      QTI_PACKAGE_MANIFEST_PATH,
    );
  }

  const manifestResources = manifestRoot
    ? parseManifestResources(manifestRoot, entriesByPath, diagnostics)
    : [];
  const resourcesByIdentifier = indexManifestResources(manifestResources, diagnostics);
  diagnoseManifestDependencyReferences(manifestResources, resourcesByIdentifier, diagnostics);

  const itemResources = manifestResources.filter((resource) => isQtiItemResource(resource.type));
  const assessmentTestResources = manifestResources.filter((resource) =>
    isQtiAssessmentTestResource(resource.type),
  );
  diagnosePrimaryResourceHrefs([...itemResources, ...assessmentTestResources], diagnostics);

  const packageShape = detectPackageShape(itemResources, assessmentTestResources, diagnostics);
  return {
    manifestRoot,
    manifestResources,
    resourcesByIdentifier,
    itemResources,
    assessmentTestResources,
    packageShape,
  };
}

export interface BuildPackageSummaryInput {
  readonly manifestRoot: QtiPackageXmlNode | undefined;
  readonly manifestResources: readonly QtiManifestResource[];
  readonly resourcesByIdentifier: ReadonlyMap<string, QtiManifestResource>;
  readonly packageShape: QtiPackageShape;
  readonly assessmentTest: QtiAssessmentTestPackageModel | undefined;
  readonly assetItems: readonly Pick<
    QtiPackageItem,
    "href" | "manifestResourceIdentifier" | "assetHrefs"
  >[];
  readonly titleItems: readonly Pick<QtiPackageItem, "title">[];
  readonly timedItemCount: number;
  readonly soleItemTiming: QtiTimingMetadata | undefined;
  readonly itemStandards: readonly QtiStandardAlignment[];
  readonly entriesByPath: { has(path: string): boolean };
  readonly diagnostics: QtiDiagnostic[];
  readonly itemCount: number;
}

/** Build canonical package metadata shared by sync and incremental parsers. */
export function buildPackageSummary(input: BuildPackageSummaryInput): QtiPackageSummary {
  const assets = collectPackageAssets(
    input.resourcesByIdentifier,
    input.assessmentTest,
    input.assetItems,
    input.entriesByPath,
    input.diagnostics,
  );
  return {
    ok: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    title: packageTitle(input.manifestRoot, input.assessmentTest, input.titleItems),
    packageShape: input.packageShape,
    manifestResources: input.manifestResources,
    assessmentTest: input.assessmentTest,
    assets,
    standards: uniqueStandards([
      ...(input.manifestRoot
        ? parseStandardAlignments(input.manifestRoot, QTI_PACKAGE_MANIFEST_PATH)
        : []),
      ...(input.assessmentTest?.standards ?? []),
      ...input.itemStandards,
    ]),
    timing: primaryTimingFromScan(input.assessmentTest, input.timedItemCount, input.soleItemTiming),
    diagnostics: input.diagnostics,
    itemCount: input.itemCount,
  };
}

export function failedPackageSummary(diagnostics: QtiDiagnostic[]): QtiPackageSummary {
  return {
    ok: false,
    title: "",
    packageShape: "unknown",
    manifestResources: [],
    assessmentTest: undefined,
    assets: [],
    standards: [],
    timing: undefined,
    itemCount: 0,
    diagnostics,
  };
}

export function enforceDiagnosticLimit(diagnostics: QtiDiagnostic[], maxDiagnostics: number): void {
  if (diagnostics.length < maxDiagnostics) return;
  diagnostics.length = maxDiagnostics;
  pushPackageDiagnostic(
    diagnostics,
    "package.diagnostics.limit",
    "error",
    "Package processing stopped at the diagnostic limit.",
  );
}
