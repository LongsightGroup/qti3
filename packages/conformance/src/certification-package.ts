import { inflateRawSync } from "node:zlib";
import {
  parseQtiPackage,
  unknownToDisplayString,
  type QtiDiagnostic,
  type QtiManifestResource,
  type QtiPackageItem,
  type QtiPackageParseOptions,
  type QtiPackageParseResult,
} from "@longsightgroup/qti3-core";

export const nodeQtiPackageParseOptions = {
  inflateRaw: (bytes: Uint8Array) => inflateRawSync(bytes),
} satisfies QtiPackageParseOptions;

export function parseOfficialQtiPackage(bytes: Uint8Array): QtiPackageParseResult {
  return parseQtiPackage(bytes, nodeQtiPackageParseOptions);
}

/** Certification alias for assessment packages; behavior matches {@link parseOfficialQtiPackage}. */
export function parseOfficialQtiTestPackage(bytes: Uint8Array): QtiPackageParseResult {
  return parseOfficialQtiPackage(bytes);
}

export function certificationDiagnostic(
  code: string,
  message: string,
  cause?: unknown,
): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message: cause === undefined ? message : `${message} Cause: ${unknownToDisplayString(cause)}`,
  };
}

export function manifestResourceHrefs(
  manifestResources: readonly QtiManifestResource[],
  resourceTypePrefix: string,
): string[] {
  return manifestResources
    .filter((resource) => resource.type.toLowerCase().startsWith(resourceTypePrefix))
    .map((resource) => resource.href ?? firstXmlManifestFileHref(resource))
    .filter((href): href is string => href !== undefined && href.trim().length > 0)
    .toSorted();
}

export function primaryManifestResourceHref(
  manifestResources: readonly QtiManifestResource[],
  resourceTypePrefix: string,
): string | undefined {
  return manifestResourceHrefs(manifestResources, resourceTypePrefix)[0];
}

export function scopePackageDiagnostics(
  diagnostics: readonly QtiDiagnostic[],
  packagePath: string,
): QtiDiagnostic[] {
  return diagnostics
    .filter((item) => item.severity === "error")
    .map((item) => ({
      ...item,
      path: item.path ? `${packagePath}/${item.path}` : packagePath,
      source: item.source
        ? {
            ...item.source,
            path: item.source.path ? `${packagePath}/${item.source.path}` : packagePath,
          }
        : item.source,
    }));
}

export function collectImportableItemHrefs(
  items: readonly QtiPackageItem[],
  itemRefHrefs: readonly string[],
  packagePath: string,
  diagnostics: QtiDiagnostic[],
): ReadonlySet<string> {
  const itemsByHref = new Map(items.map((item) => [item.href, item]));
  const importable = new Set<string>();

  for (const href of itemRefHrefs) {
    const item = itemsByHref.get(href);
    if (!item) {
      diagnostics.push(
        certificationDiagnostic(
          "certification.package.itemRef.fileMissing",
          `${packagePath} item ref ${href} was not found in the zip.`,
        ),
      );
      continue;
    }

    const itemDiagnostics = item.diagnostics.filter((entry) => entry.severity === "error");
    if (!item.document || itemDiagnostics.length > 0) {
      diagnostics.push(
        ...itemDiagnostics.map((entry) => ({
          ...entry,
          path: `${packagePath}/${href}`,
          source: entry.source ? { ...entry.source, path: `${packagePath}/${href}` } : entry.source,
        })),
      );
      continue;
    }

    importable.add(href);
  }

  return importable;
}

function firstXmlManifestFileHref(resource: QtiManifestResource): string | undefined {
  return resource.files.find((file) => file.href.toLowerCase().endsWith(".xml"))?.href;
}
