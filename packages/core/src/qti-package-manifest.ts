import type { QtiPackageXmlNode } from "./package-xml.js";
import { normalizePackagePath, pushPackageDiagnostic } from "./qti-package-paths.js";
import { parseStandardAlignments } from "./qti-package-metadata.js";
import type { QtiManifestFile, QtiManifestResource, QtiPackageShape } from "./qti-package-types.js";
import { childPackageElements, packageDescendants, stripHrefSuffix } from "./qti-package-xml.js";
import type { QtiPackageEntry } from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

export const QTI_PACKAGE_MANIFEST_PATH = "imsmanifest.xml";

export const QTI_ITEM_RESOURCE_TYPE = "imsqti_item_xmlv3p0";

export function isQtiItemResource(type: string): boolean {
  return type.toLowerCase().startsWith(QTI_ITEM_RESOURCE_TYPE);
}

export function isQtiAssessmentTestResource(type: string): boolean {
  return type.toLowerCase().startsWith("imsqti_test_xmlv3p0");
}

export function parseManifestResources(
  manifestRoot: QtiPackageXmlNode,
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
  diagnostics: QtiDiagnostic[],
): QtiManifestResource[] {
  const resourceNodes = packageDescendants(manifestRoot, "resources").flatMap((resources) =>
    childPackageElements(resources, "resource"),
  );
  const resources: QtiManifestResource[] = [];

  for (const node of resourceNodes) {
    const identifier = node.attributes.identifier ?? "";
    if (identifier.length === 0) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.resource.identifier.missing",
        "error",
        "Manifest resource is missing an identifier.",
        QTI_PACKAGE_MANIFEST_PATH,
      );
    }

    const files = parseManifestFiles(node, entriesByPath, diagnostics);
    const href =
      node.attributes.href === undefined
        ? firstXmlManifestFileHref(files)
        : normalizePackagePath(
            stripHrefSuffix(node.attributes.href),
            `manifest resource ${identifier || "(missing identifier)"} href`,
            diagnostics,
          );
    const dependencies = parseManifestDependencies(node, diagnostics);

    resources.push({
      identifier,
      type: node.attributes.type ?? "",
      href,
      files,
      dependencies,
      standards: parseStandardAlignments(node, QTI_PACKAGE_MANIFEST_PATH),
      attributes: { ...node.attributes },
    });
  }

  return resources;
}

function parseManifestFiles(
  resourceNode: QtiPackageXmlNode,
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
  diagnostics: QtiDiagnostic[],
): QtiManifestFile[] {
  const files: QtiManifestFile[] = [];
  for (const fileNode of packageDescendants(resourceNode, "file")) {
    const rawHref = fileNode.attributes.href;
    if (!rawHref) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.file.href.missing",
        "error",
        "Manifest file entry is missing href.",
        QTI_PACKAGE_MANIFEST_PATH,
      );
      continue;
    }

    const href = normalizePackagePath(stripHrefSuffix(rawHref), "manifest file href", diagnostics);
    if (!href) continue;
    files.push({ href, attributes: { ...fileNode.attributes } });
    if (!entriesByPath.has(href)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.file.missing",
        "error",
        `Manifest file reference ${href} was not found in the package.`,
        href,
      );
    }
  }
  return files;
}

function parseManifestDependencies(
  resourceNode: QtiPackageXmlNode,
  diagnostics: QtiDiagnostic[],
): string[] {
  const dependencies: string[] = [];
  for (const dependencyNode of packageDescendants(resourceNode, "dependency")) {
    const identifierref = dependencyNode.attributes.identifierref;
    if (!identifierref) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.dependency.identifierref.missing",
        "error",
        "Manifest dependency is missing identifierref.",
        QTI_PACKAGE_MANIFEST_PATH,
      );
      continue;
    }
    dependencies.push(identifierref);
  }
  return [...new Set(dependencies)];
}

function firstXmlManifestFileHref(files: readonly QtiManifestFile[]): string | undefined {
  return files.find((file) => file.href.toLowerCase().endsWith(".xml"))?.href;
}

export function indexManifestResources(
  resources: readonly QtiManifestResource[],
  diagnostics: QtiDiagnostic[],
): Map<string, QtiManifestResource> {
  const byIdentifier = new Map<string, QtiManifestResource>();
  for (const resource of resources) {
    const identifier = resource.identifier;
    if (identifier.length === 0) continue;
    if (byIdentifier.has(identifier)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.resource.identifier.duplicate",
        "error",
        `Manifest contains duplicate resource identifier ${identifier}.`,
        QTI_PACKAGE_MANIFEST_PATH,
      );
      continue;
    }
    byIdentifier.set(identifier, resource);
  }
  return byIdentifier;
}

export function diagnoseManifestDependencyReferences(
  resources: readonly QtiManifestResource[],
  resourcesByIdentifier: ReadonlyMap<string, QtiManifestResource>,
  diagnostics: QtiDiagnostic[],
): void {
  for (const resource of resources) {
    for (const dependency of resource.dependencies) {
      if (resourcesByIdentifier.has(dependency)) continue;
      pushPackageDiagnostic(
        diagnostics,
        "package.manifest.dependency.missing",
        "error",
        `Manifest resource ${resource.identifier} depends on missing resource ${dependency}.`,
        QTI_PACKAGE_MANIFEST_PATH,
      );
    }
  }
}

export function diagnosePrimaryResourceHrefs(
  resources: readonly QtiManifestResource[],
  diagnostics: QtiDiagnostic[],
): void {
  for (const resource of resources) {
    if (resource.href) continue;
    pushPackageDiagnostic(
      diagnostics,
      "package.manifest.resource.href.missing",
      "error",
      `Manifest resource ${resource.identifier || "(missing identifier)"} is missing a primary XML href.`,
      QTI_PACKAGE_MANIFEST_PATH,
    );
  }
}

export function detectPackageShape(
  itemResources: readonly QtiManifestResource[],
  assessmentTestResources: readonly QtiManifestResource[],
  diagnostics: QtiDiagnostic[],
): QtiPackageShape {
  if (assessmentTestResources.length > 0 && itemResources.length > 0) {
    pushPackageDiagnostic(
      diagnostics,
      "package.shape.ambiguous",
      "error",
      "Manifest contains both QTI item resources and QTI assessment-test resources.",
      QTI_PACKAGE_MANIFEST_PATH,
    );
    return "unknown";
  }

  if (assessmentTestResources.length > 0) return "assessment-test-resource";
  if (itemResources.length > 0) return "manifest-item-resources";

  pushPackageDiagnostic(
    diagnostics,
    "package.shape.unsupported",
    "error",
    "Manifest does not contain QTI item or assessment-test resources.",
    QTI_PACKAGE_MANIFEST_PATH,
  );
  return "unknown";
}
