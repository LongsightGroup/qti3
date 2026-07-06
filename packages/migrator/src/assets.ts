import { detectPackageMediaType } from "@longsightgroup/qti3-core";

import type { MigrationEntry } from "./source.js";
import type { QtiMigrationAsset } from "./types.js";

export function migrationPackageAssets(entries: readonly MigrationEntry[]): QtiMigrationAsset[] {
  return entries
    .filter((entry) => !entry.path.toLowerCase().endsWith(".xml"))
    .map((entry) => ({
      path: entry.path,
      data: entry.bytes,
      mediaType: detectPackageMediaType(entry.path),
    }));
}

/**
 * Asset hrefs for resource-level migration. Every migrated item receives the full non-XML file
 * closure so host-provided dependencies remain available regardless of which sibling item references
 * them.
 */
export function resourceClosureAssetHrefs(entries: readonly MigrationEntry[]): readonly string[] {
  return migrationPackageAssets(entries).map((asset) => asset.path);
}
