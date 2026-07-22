import type { QtiPackageXmlNode } from "./package-xml.js";
import { parseQtiXml } from "./parser.js";
import { parseXmlBoolean } from "./parser-values.js";
import { pushPackageDiagnostic } from "./qti-package-paths.js";
import { discoverContentAssetHrefs } from "./qti-package-assets.js";
import { QTI_PACKAGE_MANIFEST_PATH } from "./qti-package-manifest.js";
import {
  parseItemSessionControl,
  parseStandardAlignments,
  parseTimeLimits,
  parseTimingMetadata,
  uniqueStandards,
} from "./qti-package-metadata.js";
import type {
  QtiAssessmentSectionPackageModel,
  QtiAssessmentTestItemRef,
  QtiAssessmentTestPackageModel,
  QtiManifestResource,
  QtiPackageItem,
  QtiPackageItemSource,
  QtiPackageShape,
  QtiStandardAlignment,
  QtiTestPartNavigationMode,
  QtiTestPartPackageModel,
  QtiTestPartSubmissionMode,
} from "./qti-package-types.js";
import {
  childPackageElements,
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
  readonly standards: readonly QtiStandardAlignment[];
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

  const testParts = root ? parseAssessmentTestParts(root, href, testDiagnostics) : [];
  const itemRefs = testParts.flatMap(flattenTestPartItemRefs);
  const assetHrefs = root ? discoverContentAssetHrefs(xmlFile, testDiagnostics) : [];
  const timeLimits = root
    ? parseTimeLimits(childPackageElements(root, "qti-time-limits")[0], href, testDiagnostics)
    : undefined;
  const timing = root ? parseTimingMetadata(root, href, testDiagnostics, timeLimits) : undefined;
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
    testParts,
    timing,
    timeLimits,
    standards: root ? parseStandardAlignments(root, href) : [],
    assetHrefs,
    diagnostics: scopedDiagnostics,
    attributes: root ? { ...root.attributes } : {},
    xml: xmlFile.xml,
  };
}

function parseAssessmentTestParts(
  root: QtiPackageXmlNode,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiTestPartPackageModel[] {
  return childPackageElements(root, "qti-test-part").map((partNode) => {
    const identifier = partNode.attributes.identifier ?? "";
    return {
      identifier,
      navigationMode: parseNavigationMode(partNode, sourcePath, diagnostics),
      submissionMode: parseSubmissionMode(partNode, sourcePath, diagnostics),
      timeLimits: parseTimeLimits(
        childPackageElements(partNode, "qti-time-limits")[0],
        sourcePath,
        diagnostics,
      ),
      sections: childPackageElements(partNode, "qti-assessment-section").map((sectionNode) =>
        parseAssessmentSection(sectionNode, identifier, undefined, sourcePath, diagnostics),
      ),
      attributes: { ...partNode.attributes },
    };
  });
}

function parseAssessmentSection(
  sectionNode: QtiPackageXmlNode,
  testPartIdentifier: string,
  parentSectionIdentifier: string | undefined,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiAssessmentSectionPackageModel {
  const identifier = sectionNode.attributes.identifier ?? "";
  const visible = parseOptionalXmlBoolean(sectionNode, "visible", sourcePath, diagnostics);
  const itemRefs = childPackageElements(sectionNode, "qti-assessment-item-ref").flatMap(
    (refNode) => {
      const rawHref = refNode.attributes.href;
      if (!rawHref) {
        pushPackageDiagnostic(
          diagnostics,
          "package.assessmentTest.itemRef.href.missing",
          "error",
          "qti-assessment-item-ref is missing href.",
          sourcePath,
        );
        return [];
      }

      const href = resolvePackageHref(sourcePath, rawHref, diagnostics);
      if (!href) return [];
      return [
        {
          identifier: refNode.attributes.identifier,
          href,
          testPartIdentifier,
          sectionIdentifier: identifier,
          timeLimits: parseTimeLimits(
            childPackageElements(refNode, "qti-time-limits")[0],
            sourcePath,
            diagnostics,
          ),
          itemSessionControl: parseItemSessionControl(
            childPackageElements(refNode, "qti-item-session-control")[0],
            sourcePath,
            diagnostics,
          ),
          attributes: { ...refNode.attributes },
        },
      ];
    },
  );

  return {
    identifier,
    title: sectionNode.attributes.title,
    visible,
    testPartIdentifier,
    parentSectionIdentifier,
    timeLimits: parseTimeLimits(
      childPackageElements(sectionNode, "qti-time-limits")[0],
      sourcePath,
      diagnostics,
    ),
    itemRefs,
    sections: childPackageElements(sectionNode, "qti-assessment-section").map((child) =>
      parseAssessmentSection(child, testPartIdentifier, identifier, sourcePath, diagnostics),
    ),
    attributes: { ...sectionNode.attributes },
  };
}

function flattenTestPartItemRefs(part: QtiTestPartPackageModel): QtiAssessmentTestItemRef[] {
  return part.sections.flatMap(flattenSectionItemRefs);
}

function flattenSectionItemRefs(
  section: QtiAssessmentSectionPackageModel,
): QtiAssessmentTestItemRef[] {
  return [...section.itemRefs, ...section.sections.flatMap(flattenSectionItemRefs)];
}

function parseNavigationMode(
  node: QtiPackageXmlNode,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiTestPartNavigationMode | undefined {
  const raw = node.attributes["navigation-mode"];
  if (raw === "linear" || raw === "nonlinear") return raw;
  pushPackageDiagnostic(
    diagnostics,
    "package.testPart.navigationMode.invalid",
    "error",
    `qti-test-part navigation-mode must be linear or nonlinear, found ${raw ?? "(missing)"}.`,
    sourcePath,
  );
  return undefined;
}

function parseSubmissionMode(
  node: QtiPackageXmlNode,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiTestPartSubmissionMode | undefined {
  const raw = node.attributes["submission-mode"];
  if (raw === "individual" || raw === "simultaneous") return raw;
  pushPackageDiagnostic(
    diagnostics,
    "package.testPart.submissionMode.invalid",
    "error",
    `qti-test-part submission-mode must be individual or simultaneous, found ${raw ?? "(missing)"}.`,
    sourcePath,
  );
  return undefined;
}

function parseOptionalXmlBoolean(
  node: QtiPackageXmlNode,
  name: string,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): boolean | undefined {
  const raw = node.attributes[name];
  if (raw === undefined) return undefined;
  const value = parseXmlBoolean(raw);
  if (value !== undefined) return value;
  pushPackageDiagnostic(
    diagnostics,
    `package.attribute.${name}.boolean`,
    "error",
    `${node.localName} ${name} must be an XML boolean, found ${raw}.`,
    sourcePath,
  );
  return undefined;
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
      standards: assessmentTest?.standards ?? [],
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
      standards: resource.standards,
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
    const timeLimits = root
      ? parseTimeLimits(
          childPackageElements(root, "qti-time-limits")[0],
          reference.href,
          diagnostics,
        )
      : undefined;

    items.push({
      href: reference.href,
      source: reference.source,
      manifestResourceIdentifier: reference.manifestResourceIdentifier,
      assessmentItemRefIdentifier: reference.assessmentItemRefIdentifier,
      identifier: item?.identifier,
      title: item?.title,
      document: parsed.document,
      timing: root ? parseTimingMetadata(root, reference.href, diagnostics, timeLimits) : undefined,
      timeLimits,
      standards: uniqueStandards([
        ...reference.standards.filter(
          (standard) =>
            standard.resourcePartIdentifier === undefined ||
            standard.resourcePartIdentifier === item?.identifier,
        ),
        ...(root ? parseStandardAlignments(root, reference.href) : []),
      ]),
      assetHrefs,
      diagnostics: itemDiagnostics,
      xml: xmlFile.xml,
    });
  }

  return items;
}
