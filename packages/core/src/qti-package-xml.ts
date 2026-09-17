import { isResolvableAssetUrl } from "./asset-url.js";
import { parseQtiPackageXmlTree, type QtiPackageXmlNode } from "./package-xml.js";
import { normalizePackagePath, pushPackageDiagnostic } from "./qti-package-paths.js";
import { decodeUtf8, type QtiPackageEntry } from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

/** Parsed package XML file with lightweight tree and source text. */
export interface PackageXmlFile {
  readonly path: string;
  readonly xml: string;
  readonly root?: QtiPackageXmlNode | undefined;
  readonly errors: readonly string[];
}

export function parseXmlFiles(
  entriesByPath: ReadonlyMap<string, QtiPackageEntry>,
): Map<string, PackageXmlFile> {
  const xmlFiles = new Map<string, PackageXmlFile>();
  for (const entry of entriesByPath.values()) {
    if (!entry.path.toLowerCase().endsWith(".xml")) continue;
    xmlFiles.set(entry.path, parsePackageXml(entry));
  }
  return xmlFiles;
}

export function parsePackageXml(entry: QtiPackageEntry): PackageXmlFile {
  const xml = decodeUtf8(entry.bytes);
  const parsed = parseQtiPackageXmlTree(xml);
  return {
    path: entry.path,
    xml,
    root: parsed.root,
    errors: parsed.errors,
  };
}

export function pushXmlDiagnostics(xmlFile: PackageXmlFile, diagnostics: QtiDiagnostic[]): void {
  for (const message of xmlFile.errors) {
    pushPackageDiagnostic(diagnostics, "xml.parse", "error", message, xmlFile.path);
  }
}

/** Return direct package-XML children, optionally restricted by local name and namespace. */
export function childPackageElements(
  node: QtiPackageXmlNode,
  localName?: string,
  namespaceUri?: string,
): QtiPackageXmlNode[] {
  return node.children.filter(
    (child) =>
      (!localName || child.localName === localName) &&
      (namespaceUri === undefined || child.uri === namespaceUri),
  );
}

/** Return package-XML descendants, optionally restricted by local name and namespace. */
export function packageDescendants(
  node: QtiPackageXmlNode | undefined,
  localName?: string,
  namespaceUri?: string,
): QtiPackageXmlNode[] {
  if (!node) return [];
  const found: QtiPackageXmlNode[] = [];
  for (const child of node.children) {
    if (
      (!localName || child.localName === localName) &&
      (namespaceUri === undefined || child.uri === namespaceUri)
    ) {
      found.push(child);
    }
    found.push(...packageDescendants(child, localName, namespaceUri));
  }
  return found;
}

export function resolvePackageHref(
  from: string,
  href: string,
  diagnostics: QtiDiagnostic[],
): string | undefined {
  const strippedHref = stripHrefSuffix(href);
  // Diagnose absolute package references before adding the containing directory.
  if (!isResolvableAssetUrl(strippedHref)) {
    return normalizePackagePath(strippedHref, "package reference", diagnostics);
  }
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizePackagePath(`${base}${strippedHref}`, "package reference", diagnostics);
}

export function stripHrefSuffix(href: string): string {
  return href.split(/[?#]/, 1)[0] ?? "";
}

export function joinPackagePath(packagePath: string, localPath: string): string {
  return localPath.startsWith("/") ? `${packagePath}${localPath}` : `${packagePath}/${localPath}`;
}

export function scopeDiagnosticToPackagePath(
  packagePath: string,
  diagnostic: QtiDiagnostic,
): QtiDiagnostic {
  const localPath = diagnostic.path ?? diagnostic.source?.path;
  const path =
    !localPath || localPath === packagePath ? packagePath : joinPackagePath(packagePath, localPath);
  return {
    ...diagnostic,
    path,
    source: diagnostic.source ? { ...diagnostic.source, path } : diagnostic.source,
  };
}
