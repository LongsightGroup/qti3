import {
  normalizePackagePath,
  parseQtiXml,
  QTI_PACKAGE_MANIFEST_PATH,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";

import { validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import { renderQti3AuthoringItem, validateQti3AuthoringItem } from "./interactions.js";
import type {
  Qti3PackageAuthoringInput,
  Qti3PackageAsset,
  Qti3PackageItem,
} from "./package-types.js";
import type { Qti3WriterDiagnostic } from "./types.js";

export interface NormalizedPackage {
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly items: readonly NormalizedPackageItem[];
}

export interface NormalizedPackageItem {
  readonly path: string;
  readonly identifier: string;
  readonly xml: string;
  readonly assets: readonly NormalizedPackageAsset[];
}

export interface NormalizedPackageAsset {
  readonly path: string;
  readonly data: Uint8Array | string;
}

export interface BuildPackageResult {
  readonly normalized: NormalizedPackage;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
}

export function buildPackage(input: Qti3PackageAuthoringInput): BuildPackageResult {
  const baseDiagnostics = validatePackageBase(input);
  const normalizedResult = normalizePackage(input);
  const graphDiagnostics = validatePackageGraph(normalizedResult.normalized);
  return {
    normalized: normalizedResult.normalized,
    diagnostics: [...baseDiagnostics, ...normalizedResult.diagnostics, ...graphDiagnostics],
  };
}

export function packageFiles(
  input: NormalizedPackage,
): readonly { path: string; data: Uint8Array | string }[] {
  const files: { path: string; data: Uint8Array | string }[] = [];
  for (const item of input.items) {
    files.push({ path: item.path, data: item.xml });
    for (const asset of item.assets) files.push({ path: asset.path, data: asset.data });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

function validatePackageBase(input: Qti3PackageAuthoringInput): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const identifierDiagnostic = validateQtiIdentifier(
    "identifier",
    "Package identifier",
    input.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (input.title !== undefined && !input.title.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_package_title",
        "title",
        "Package title must not be empty when provided.",
      ),
    );
  }
  if (input.items.length === 0) {
    diagnostics.push(
      writerDiagnostic(
        "missing_package_items",
        "items",
        "QTI package must contain at least one item.",
      ),
    );
  }
  return diagnostics;
}

function normalizePackage(input: Qti3PackageAuthoringInput): {
  readonly normalized: NormalizedPackage;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
} {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const items: NormalizedPackageItem[] = [];
  for (const item of input.items) {
    const itemResult = normalizePackageItem(item);
    diagnostics.push(...itemResult.diagnostics);
    items.push(itemResult.item);
  }

  return {
    normalized: {
      identifier: input.identifier.trim(),
      title: input.title?.trim(),
      items,
    },
    diagnostics,
  };
}

function normalizePackageItem(item: Qti3PackageItem): {
  readonly item: NormalizedPackageItem;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
} {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const path = parsePackagePath(item.path, "item path", `items.${item.path}.path`, diagnostics);
  const assets = (item.assets ?? []).flatMap((asset) => {
    const normalized = normalizePackageAsset(asset);
    diagnostics.push(...normalized.diagnostics);
    return [normalized.asset];
  });

  if (item.kind === "authoringItem") {
    const xmlResult = packageItemXml(item);
    diagnostics.push(...xmlResult.diagnostics);
    return {
      item: {
        path,
        identifier: item.item.identifier.trim(),
        xml: xmlResult.xml,
        assets,
      },
      diagnostics,
    };
  }

  return {
    item: {
      path,
      identifier: item.identifier.trim(),
      xml: item.xml,
      assets,
    },
    diagnostics,
  };
}

function normalizePackageAsset(asset: Qti3PackageAsset): {
  readonly asset: NormalizedPackageAsset;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
} {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  return {
    asset: {
      path: parsePackagePath(asset.path, "asset path", `assets.${asset.path}.path`, diagnostics),
      data: asset.data,
    },
    diagnostics,
  };
}

function validatePackageGraph(input: NormalizedPackage): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const seenItemIdentifiers = new Set<string>();
  const seenPaths = new Set<string>([QTI_PACKAGE_MANIFEST_PATH]);

  for (const item of input.items) {
    validateUniquePath(item.path, seenPaths, diagnostics);
    validateItemIdentifier(item, seenItemIdentifiers, diagnostics);
    validateItemXml(item, diagnostics);
    validateItemAssets(item, seenPaths, diagnostics);
  }

  return diagnostics;
}

function packageItemXml(item: Qti3PackageItem): {
  readonly xml: string;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
} {
  if (item.kind === "xml") return { xml: item.xml, diagnostics: [] };

  const itemDiagnostics = validateQti3AuthoringItem(item.item);
  if (itemDiagnostics.length) {
    return {
      xml: "",
      diagnostics: itemDiagnostics.map((diagnostic) =>
        writerDiagnostic(
          diagnostic.code,
          `items.${normalizePackagePathForDiagnostic(item.path)}.${diagnostic.path}`,
          diagnostic.message,
          diagnostic.value,
        ),
      ),
    };
  }
  return { xml: renderQti3AuthoringItem(item.item), diagnostics: [] };
}

function validateItemIdentifier(
  item: NormalizedPackageItem,
  seenItemIdentifiers: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const identifierDiagnostic = validateQtiIdentifier(
    `items.${item.path}.identifier`,
    "Package item identifier",
    item.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (!item.identifier) return;
  if (seenItemIdentifiers.has(item.identifier)) {
    diagnostics.push(
      writerDiagnostic(
        "duplicate_package_item_identifier",
        `items.${item.path}.identifier`,
        `Package item identifier "${item.identifier}" must be unique.`,
        item.identifier,
      ),
    );
    return;
  }
  seenItemIdentifiers.add(item.identifier);
}

function validateItemXml(item: NormalizedPackageItem, diagnostics: Qti3WriterDiagnostic[]): void {
  if (!item.xml) return;
  const parsed = parseQtiXml(item.xml);
  for (const diagnostic of parsed.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push(
      writerDiagnostic(
        `invalid_package_item_xml_${diagnostic.code}`,
        item.path,
        diagnostic.message,
      ),
    );
  }
  const parsedIdentifier = parsed.document?.item.attributes.identifier;
  if (parsed.ok && parsedIdentifier && parsedIdentifier !== item.identifier) {
    diagnostics.push(
      writerDiagnostic(
        "package_item_identifier_mismatch",
        `items.${item.path}.identifier`,
        `Package item identifier "${item.identifier}" must match assessment item identifier "${parsedIdentifier}".`,
        item.identifier,
      ),
    );
  }
}

function validateItemAssets(
  item: NormalizedPackageItem,
  seenPaths: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const asset of item.assets) {
    if (seen.has(asset.path)) {
      diagnostics.push(
        writerDiagnostic(
          "duplicate_package_item_asset",
          `items.${item.path}.assets`,
          `Package item asset "${asset.path}" must be unique for the item.`,
          asset.path,
        ),
      );
      continue;
    }
    seen.add(asset.path);
    validateUniquePath(asset.path, seenPaths, diagnostics);
  }
}

function parsePackagePath(
  path: string,
  context: string,
  diagnosticPath: string,
  diagnostics: Qti3WriterDiagnostic[],
): string {
  if (!path) {
    diagnostics.push(
      writerDiagnostic("missing_package_path", diagnosticPath, "Package path is required."),
    );
    return "";
  }

  const coreDiagnostics: QtiDiagnostic[] = [];
  const slashPath = path.replaceAll("\\", "/");
  const normalized = normalizePackagePath(slashPath, context, coreDiagnostics);
  diagnostics.push(
    ...coreDiagnostics.map((diagnostic) =>
      writerDiagnostic(diagnostic.code, diagnosticPath, diagnostic.message),
    ),
  );
  return normalized ?? slashPath;
}

function normalizePackagePathForDiagnostic(path: string): string {
  return (
    normalizePackagePath(path.replaceAll("\\", "/"), "package item path", []) ??
    path.replaceAll("\\", "/")
  );
}

function validateUniquePath(
  path: string,
  seenPaths: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!path) return;
  if (seenPaths.has(path)) {
    diagnostics.push(
      writerDiagnostic(
        "duplicate_package_path",
        path,
        `Package path "${path}" must be unique.`,
        path,
      ),
    );
    return;
  }
  seenPaths.add(path);
}
