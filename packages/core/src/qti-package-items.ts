import type { QtiPackageXmlNode } from "./package-xml.js";
import { parseQtiXml } from "./parser.js";
import { pushPackageDiagnostic } from "./qti-package-paths.js";
import { discoverContentAssetHrefs } from "./qti-package-assets.js";
import { QTI_PACKAGE_MANIFEST_PATH } from "./qti-package-manifest.js";
import { parseStandardAlignments, parseTimingMetadata } from "./qti-package-metadata.js";
import type {
  QtiAssessmentTestItemRef,
  QtiAssessmentTestPackageModel,
  QtiManifestResource,
  QtiPackageItem,
  QtiPackageItemSource,
  QtiPackageShape,
} from "./qti-package-types.js";
import {
  packageDescendants,
  parsePackageXml,
  pushXmlDiagnostics,
  resolvePackageHref,
  scopeDiagnosticToPackagePath,
  type PackageXmlFile,
} from "./qti-package-xml.js";
import type { QtiPackageEntry } from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

export interface PackageItemReference {
  readonly href: string;
  readonly source: QtiPackageItemSource;
  readonly manifestResourceIdentifier?: string | undefined;
  readonly assessmentItemRefIdentifier?: string | undefined;
}

export function parseAssessmentTestPackageModel(
  packageShape: QtiPackageShape,
  assessmentTestResources: readonly QtiManifestResource[],
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
  xmlFilesByPath: ReadonlyMap<string, PackageXmlFile>,
  diagnostics: QtiDiagnostic[],
): QtiAssessmentTestPackageModel | undefined {
  if (packageShape !== "assessment-test-resource") return undefined;

  const firstResource = assessmentTestResources[0];
  if (!firstResource) return undefined;

  if (assessmentTestResources.length > 1) {
    pushPackageDiagnostic(
      diagnostics,
      "package.assessmentTest.resource.ambiguous",
      "error",
      "Manifest contains multiple QTI assessment-test resources.",
      QTI_PACKAGE_MANIFEST_PATH,
    );
  }

  const href = firstResource.href;
  if (!href) return undefined;
  if (!entriesByPath.has(href)) {
    pushPackageDiagnostic(
      diagnostics,
      "package.assessmentTest.missing",
      "error",
      `Assessment test resource ${href} was not found in the package.`,
      href,
    );
    return undefined;
  }

  const entry = entriesByPath.get(href);
  if (!entry) return undefined;
  const xmlFile = xmlFilesByPath.get(href) ?? parsePackageXml(entry);
  const testDiagnostics: QtiDiagnostic[] = [];
  pushXmlDiagnostics(xmlFile, testDiagnostics);
  const root = xmlFile.root?.localName === "qti-assessment-test" ? xmlFile.root : undefined;
  if (xmlFile.root && !root) {
    pushPackageDiagnostic(
      testDiagnostics,
      "package.assessmentTest.root",
      "error",
      `Expected qti-assessment-test root, found ${xmlFile.root.localName}.`,
      href,
    );
  }

  const itemRefs = root ? parseAssessmentTestItemRefs(root, href, testDiagnostics) : [];
  const assetHrefs = root ? discoverContentAssetHrefs(xmlFile, testDiagnostics) : [];
  const scopedDiagnostics = testDiagnostics.map((diagnostic) =>
    scopeDiagnosticToPackagePath(href, diagnostic),
  );
  diagnostics.push(...scopedDiagnostics);

  return {
    href,
    identifier: root?.attributes.identifier ?? "",
    title: root?.attributes.title,
    manifestResourceIdentifier: firstResource.identifier,
    itemRefs,
    timing: root ? parseTimingMetadata(root, href) : undefined,
    standards: root ? parseStandardAlignments(root, href) : [],
    assetHrefs,
    diagnostics: scopedDiagnostics,
    attributes: root ? { ...root.attributes } : {},
    xml: xmlFile.xml,
  };
}

function parseAssessmentTestItemRefs(
  root: QtiPackageXmlNode,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiAssessmentTestItemRef[] {
  const itemRefs: QtiAssessmentTestItemRef[] = [];
  for (const refNode of packageDescendants(root, "qti-assessment-item-ref")) {
    const rawHref = refNode.attributes.href;
    if (!rawHref) {
      pushPackageDiagnostic(
        diagnostics,
        "package.assessmentTest.itemRef.href.missing",
        "error",
        "qti-assessment-item-ref is missing href.",
        sourcePath,
      );
      continue;
    }

    const href = resolvePackageHref(sourcePath, rawHref, diagnostics);
    if (!href) continue;
    itemRefs.push({
      identifier: refNode.attributes.identifier,
      href,
      attributes: { ...refNode.attributes },
    });
  }
  return itemRefs;
}

export function itemReferencesForPackageShape(
  packageShape: QtiPackageShape,
  itemResources: readonly QtiManifestResource[],
  assessmentTest: QtiAssessmentTestPackageModel | undefined,
  diagnostics: QtiDiagnostic[],
): PackageItemReference[] {
  if (packageShape === "assessment-test-resource") {
    return (assessmentTest?.itemRefs ?? []).map((itemRef) => ({
      href: itemRef.href,
      source: "assessment-test",
      assessmentItemRefIdentifier: itemRef.identifier,
    }));
  }

  if (packageShape !== "manifest-item-resources") return [];

  const references: PackageItemReference[] = [];
  const seen = new Set<string>();
  for (const resource of itemResources) {
    const href = resource.href;
    if (!href) continue;
    if (seen.has(href)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.itemResource.href.duplicate",
        "error",
        `Multiple manifest item resources point to ${href}.`,
        href,
      );
      continue;
    }
    seen.add(href);
    references.push({
      href,
      source: "manifest",
      manifestResourceIdentifier: resource.identifier,
    });
  }
  return references;
}

export function parsePackageItems(
  references: readonly PackageItemReference[],
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
  xmlFilesByPath: ReadonlyMap<string, PackageXmlFile>,
  diagnostics: QtiDiagnostic[],
): QtiPackageItem[] {
  const items: QtiPackageItem[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (seen.has(reference.href)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.item.reference.duplicate",
        "warning",
        `Package item ${reference.href} is referenced more than once.`,
        reference.href,
      );
      continue;
    }
    seen.add(reference.href);

    const entry = entriesByPath.get(reference.href);
    if (!entry) {
      pushPackageDiagnostic(
        diagnostics,
        "package.item.missing",
        "error",
        `Package item reference ${reference.href} was not found.`,
        reference.href,
      );
      continue;
    }

    const xmlFile = xmlFilesByPath.get(reference.href) ?? parsePackageXml(entry);
    // Full QTI parse for document model; lightweight tree above supplies metadata and asset refs.
    const parsed = parseQtiXml(xmlFile.xml);
    const itemDiagnostics = parsed.diagnostics.map((diagnostic) =>
      scopeDiagnosticToPackagePath(reference.href, diagnostic),
    );
    diagnostics.push(...itemDiagnostics);

    const assetHrefs = xmlFile.root ? discoverContentAssetHrefs(xmlFile, diagnostics) : [];
    const root = xmlFile.root?.localName === "qti-assessment-item" ? xmlFile.root : undefined;
    const item = parsed.document?.item;

    items.push({
      href: reference.href,
      source: reference.source,
      manifestResourceIdentifier: reference.manifestResourceIdentifier,
      assessmentItemRefIdentifier: reference.assessmentItemRefIdentifier,
      identifier: item?.identifier,
      title: item?.title,
      document: parsed.document,
      timing: root ? parseTimingMetadata(root, reference.href) : undefined,
      standards: root ? parseStandardAlignments(root, reference.href) : [],
      assetHrefs,
      diagnostics: itemDiagnostics,
      xml: xmlFile.xml,
    });
  }

  return items;
}
