import { pushPackageDiagnostic } from "./qti-package-paths.js";
import type {
  QtiAssessmentTestPackageModel,
  QtiManifestResource,
  QtiPackageAsset,
  QtiPackageAssetSource,
  QtiPackageItem,
} from "./qti-package-types.js";
import {
  isPackageRelativeHref,
  packageDescendants,
  resolvePackageHref,
  type PackageXmlFile,
} from "./qti-package-xml.js";
import type { QtiPackageEntry } from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

interface PendingAssetReference {
  readonly href: string;
  readonly source: QtiPackageAssetSource;
  readonly referencedBy: string;
}

type PackageAssetRefSpec =
  | { readonly kind: "attribute"; readonly localName: string; readonly attribute: string }
  | { readonly kind: "text"; readonly localName: string };

const PACKAGE_ASSET_REF_SPECS: readonly PackageAssetRefSpec[] = [
  { kind: "attribute", localName: "qti-stylesheet", attribute: "href" },
  { kind: "attribute", localName: "qti-assessment-stimulus-ref", attribute: "href" },
  { kind: "attribute", localName: "img", attribute: "src" },
  { kind: "attribute", localName: "object", attribute: "data" },
  { kind: "attribute", localName: "audio", attribute: "src" },
  { kind: "attribute", localName: "video", attribute: "src" },
  { kind: "attribute", localName: "source", attribute: "src" },
  { kind: "attribute", localName: "track", attribute: "src" },
  { kind: "text", localName: "qti-file-href" },
  { kind: "text", localName: "qti-resource-icon" },
];

export function discoverContentAssetHrefs(
  xmlFile: PackageXmlFile,
  diagnostics: QtiDiagnostic[],
): string[] {
  if (!xmlFile.root) return [];

  const refs: string[] = [];
  for (const spec of PACKAGE_ASSET_REF_SPECS) {
    if (spec.kind === "attribute") {
      collectPackageRelativeAttributeRefs(
        refs,
        xmlFile,
        spec.localName,
        spec.attribute,
        diagnostics,
      );
    } else {
      collectPackageRelativeTextRefs(refs, xmlFile, spec.localName, diagnostics);
    }
  }
  return [...new Set(refs)];
}

export function collectPackageAssets(
  resourcesByIdentifier: ReadonlyMap<string, QtiManifestResource>,
  assessmentTest: QtiAssessmentTestPackageModel | undefined,
  items: readonly QtiPackageItem[],
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
  diagnostics: QtiDiagnostic[],
): QtiPackageAsset[] {
  const pending: PendingAssetReference[] = [];
  const selectedResourceIds = new Set<string>();
  if (assessmentTest?.manifestResourceIdentifier !== undefined) {
    selectedResourceIds.add(assessmentTest.manifestResourceIdentifier);
  }
  for (const item of items) {
    if (item.manifestResourceIdentifier !== undefined) {
      selectedResourceIds.add(item.manifestResourceIdentifier);
    }
  }

  for (const resourceId of selectedResourceIds) {
    for (const resource of resourceClosure(resourceId, resourcesByIdentifier)) {
      for (const file of resource.files) {
        if (isPrimaryPackageXml(file.href, assessmentTest, items)) continue;
        pending.push({
          href: file.href,
          source: "manifest-resource",
          referencedBy: resource.identifier,
        });
      }
    }
  }

  if (assessmentTest) {
    for (const itemRef of assessmentTest.itemRefs) {
      if (!entriesByPath.has(itemRef.href)) {
        pushPackageDiagnostic(
          diagnostics,
          "package.reference.missing",
          "error",
          `Assessment test item reference ${itemRef.href} was not found in the package.`,
          itemRef.href,
        );
      }
    }
    for (const href of assessmentTest.assetHrefs) {
      pending.push({ href, source: "assessment-test-content", referencedBy: assessmentTest.href });
      if (!entriesByPath.has(href)) {
        pushPackageDiagnostic(
          diagnostics,
          "package.asset.missing",
          "error",
          `Package asset ${href} referenced from ${assessmentTest.href} was not found.`,
          href,
        );
      }
    }
  }

  for (const item of items) {
    for (const href of item.assetHrefs) {
      pending.push({ href, source: "item-content", referencedBy: item.href });
      if (!entriesByPath.has(href)) {
        pushPackageDiagnostic(
          diagnostics,
          "package.asset.missing",
          "error",
          `Package asset ${href} referenced from ${item.href} was not found.`,
          href,
        );
      }
    }
  }

  return materializeAssets(pending, entriesByPath);
}

function resourceClosure(
  rootIdentifier: string,
  resourcesByIdentifier: ReadonlyMap<string, QtiManifestResource>,
): QtiManifestResource[] {
  const closed: QtiManifestResource[] = [];
  const visited = new Set<string>();
  const pending = [rootIdentifier];

  for (let index = 0; index < pending.length; index += 1) {
    const identifier = pending[index];
    if (!identifier || visited.has(identifier)) continue;
    visited.add(identifier);
    const resource = resourcesByIdentifier.get(identifier);
    if (!resource) continue;
    closed.push(resource);
    pending.push(...resource.dependencies);
  }

  return closed;
}

function isPrimaryPackageXml(
  href: string,
  assessmentTest: QtiAssessmentTestPackageModel | undefined,
  items: readonly { readonly href: string }[],
): boolean {
  if (assessmentTest?.href === href) return true;
  return items.some((item) => item.href === href);
}

function collectPackageRelativeAttributeRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
  attribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.attributes[attribute];
    if (!isPackageRelativeHref(href)) continue;
    const resolved = resolvePackageHref(xmlFile.path, href.trim(), diagnostics);
    if (resolved) refs.push(resolved);
  }
}

function collectPackageRelativeTextRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
  diagnostics: QtiDiagnostic[],
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.text.trim();
    if (!isPackageRelativeHref(href)) continue;
    const resolved = resolvePackageHref(xmlFile.path, href, diagnostics);
    if (resolved) refs.push(resolved);
  }
}

function materializeAssets(
  pending: readonly PendingAssetReference[],
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
): QtiPackageAsset[] {
  const assetsByHref = new Map<string, PendingAssetReference[]>();
  for (const reference of pending) {
    if (!entriesByPath.has(reference.href)) continue;
    const references = assetsByHref.get(reference.href) ?? [];
    references.push(reference);
    assetsByHref.set(reference.href, references);
  }

  return [...assetsByHref.entries()]
    .map(([href, references]): QtiPackageAsset => {
      const firstReference = references[0];
      return {
        href,
        mediaType: detectPackageMediaType(href),
        source: firstReference?.source ?? "item-content",
        referencedBy: [...new Set(references.map((reference) => reference.referencedBy))],
      };
    })
    .toSorted((left, right) => left.href.localeCompare(right.href));
}

export function detectPackageMediaType(href: string): string | undefined {
  const extension = href.slice(href.lastIndexOf(".") + 1).toLowerCase();
  switch (extension) {
    case "css":
      return "text/css";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "mp3":
      return "audio/mpeg";
    case "mp4":
      return "video/mp4";
    case "ogg":
      return "audio/ogg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "vtt":
      return "text/vtt";
    case "wav":
      return "audio/wav";
    case "webm":
      return "video/webm";
    case "webp":
      return "image/webp";
    case "xml":
      return "application/xml";
    default:
      return undefined;
  }
}
