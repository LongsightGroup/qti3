import type { Qti3PackageAsset, Qti3PackageItem } from "@longsightgroup/qti3-writer";

import { diagnostic, hasErrors } from "./diagnostics.js";
import { migrationPackageIdentifier } from "./identifiers.js";
import type {
  QtiMigrationAsset,
  QtiMigrationDiagnostic,
  QtiMigrationResult,
  QtiPackageMigrationResult,
} from "./types.js";

export function migrationResultToPackage(result: QtiMigrationResult): QtiPackageMigrationResult {
  const itemDiagnostics = result.items.flatMap((item) => item.diagnostics);
  const assetDiagnostics: QtiMigrationDiagnostic[] = [];
  const assetsByPath = migrationAssetsByPath(result.assets, assetDiagnostics);
  const itemBuildDiagnostics: QtiMigrationDiagnostic[] = [];
  const items = buildPackageItems(result, assetsByPath, itemBuildDiagnostics);
  const diagnostics = [
    ...result.diagnostics,
    ...itemDiagnostics,
    ...assetDiagnostics,
    ...itemBuildDiagnostics,
  ];

  if (hasErrors(diagnostics)) return { ok: false, diagnostics };
  return {
    ok: true,
    package: {
      identifier: migrationPackageIdentifier(result.title),
      title: result.title,
      items,
    },
    diagnostics,
  };
}

function buildPackageItems(
  result: QtiMigrationResult,
  assetsByPath: ReadonlyMap<string, Qti3PackageAsset>,
  diagnostics: QtiMigrationDiagnostic[],
): Qti3PackageItem[] {
  const items: Qti3PackageItem[] = [];
  for (const item of result.items) {
    if (!item.xml) {
      diagnostics.push(
        diagnostic("package_item_xml_missing", "error", "Migrated item has no QTI 3 XML.", {
          path: item.href,
          sourceFormat: result.sourceFormat,
        }),
      );
      continue;
    }

    items.push({
      kind: "xml",
      path: item.href,
      identifier: item.identifier,
      xml: item.xml,
      assets: packageItemAssets(item.assetHrefs ?? [], assetsByPath, diagnostics),
    });
  }
  return items;
}

function migrationAssetsByPath(
  assets: readonly QtiMigrationAsset[],
  diagnostics: QtiMigrationDiagnostic[],
): ReadonlyMap<string, Qti3PackageAsset> {
  const assetsByPath = new Map<string, Qti3PackageAsset>();
  for (const asset of assets) {
    if (!asset.data) {
      diagnostics.push(
        diagnostic("package_asset_data_missing", "error", "Migrated package asset has no data.", {
          path: asset.path,
        }),
      );
      continue;
    }
    assetsByPath.set(asset.path, {
      path: asset.path,
      data: asset.data,
    });
  }
  return assetsByPath;
}

function packageItemAssets(
  hrefs: readonly string[],
  assetsByPath: ReadonlyMap<string, Qti3PackageAsset>,
  diagnostics: QtiMigrationDiagnostic[],
): readonly Qti3PackageAsset[] {
  const assets: Qti3PackageAsset[] = [];
  for (const href of hrefs) {
    const asset = assetsByPath.get(href);
    if (!asset) {
      diagnostics.push(
        diagnostic(
          "package_asset_missing",
          "error",
          "Migrated package item references missing asset.",
          {
            path: href,
          },
        ),
      );
      continue;
    }
    assets.push(asset);
  }
  return assets;
}
