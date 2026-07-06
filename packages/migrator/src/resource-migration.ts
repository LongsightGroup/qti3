import { decodeUtf8 } from "@longsightgroup/qti3-core";

import { migrationPackageAssets, resourceClosureAssetHrefs } from "./assets.js";
import { aggregateMigrationDiagnostics, diagnostic } from "./diagnostics.js";
import { finalizeItemResults } from "./item-finalize.js";
import { migrateItemXml } from "./migrate-items.js";
import { normalizeMigrationResourcePath } from "./paths.js";
import { migrationResultToPackageEntries } from "./package-result.js";
import { resolveOptions } from "./options.js";
import {
  detectMigrationSource,
  migrationEntriesFromFileMap,
  type MigrationSource,
} from "./source.js";
import type {
  QtiMigrationDiagnostic,
  QtiMigrationOptions,
  QtiMigrationPart,
  QtiMigrationResourceInput,
  QtiMigrationResult,
  QtiMigrationSourceFormat,
  QtiResourceMigrationResult,
} from "./types.js";

interface NormalizedResourceInput {
  readonly sourcePath: string;
  readonly entries: ReturnType<typeof migrationEntriesFromFileMap>["entries"];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

/** Migrate one QTI resource and its local file closure into launchable QTI 3 package entries. */
export async function migrateQtiResourceToQti3(
  input: QtiMigrationResourceInput,
  options: QtiMigrationOptions = {},
): Promise<QtiResourceMigrationResult> {
  const resolvedOptions = resolveOptions(options);
  const normalized = normalizeResourceInput(input);
  if (normalized.diagnostics.length) {
    return failedResourceMigrationResult({
      title: input.title ?? input.sourcePath,
      diagnostics: normalized.diagnostics,
    });
  }

  const sourceEntry = normalized.entries.find((entry) => entry.path === normalized.sourcePath);
  if (!sourceEntry) {
    return failedResourceMigrationResult({
      title: input.title ?? normalized.sourcePath,
      diagnostics: [
        diagnostic(
          "resource_source_missing",
          "error",
          `QTI resource source path ${normalized.sourcePath} was not found in the resource files.`,
          { path: normalized.sourcePath },
        ),
      ],
    });
  }

  const sourceXml = decodeUtf8(sourceEntry.bytes);
  const source: MigrationSource = {
    filename: normalized.sourcePath,
    isPackage: false,
    entries: [],
    xml: sourceXml,
  };
  const detection = detectMigrationSource(source);
  if (!detection.supported || !detection.sourceFormat) {
    return failedResourceMigrationResult({
      title: input.title ?? normalized.sourcePath,
      sourceFormat: detection.sourceFormat,
      diagnostics: [
        diagnostic(
          "source_unsupported",
          "error",
          `Unsupported QTI migration source: ${detection.reason}.`,
          { path: normalized.sourcePath, sourceFormat: detection.sourceFormat },
        ),
      ],
    });
  }

  const assetHrefs = resourceClosureAssetHrefs(normalized.entries);
  const items = finalizeItemResults(
    migrateItemXml(sourceXml, normalized.sourcePath, detection.sourceFormat, resolvedOptions),
    normalized.sourcePath,
    resolvedOptions,
  ).map((item) => ({ ...item, assetHrefs }));

  const migration: QtiMigrationResult = {
    title: input.title ?? items[0]?.title ?? normalized.sourcePath,
    sourceFormat: detection.sourceFormat,
    parts: [partFromItems("PART_1", input.title ?? "Imported Resource", items)],
    items,
    assets: migrationPackageAssets(normalized.entries),
    diagnostics: [],
  };

  const packageEntries = migrationResultToPackageEntries(migration);
  if (!packageEntries.ok) {
    return failedResourceMigrationResult({
      title: migration.title,
      sourceFormat: detection.sourceFormat,
      migration,
      diagnostics: aggregateMigrationDiagnostics(migration, packageEntries.diagnostics),
    });
  }

  const diagnostics = aggregateMigrationDiagnostics(migration, packageEntries.diagnostics);
  const itemHrefs = items.map((item) => item.href);
  const launchHref = itemHrefs[0];
  if (!launchHref) {
    return failedResourceMigrationResult({
      title: migration.title,
      sourceFormat: detection.sourceFormat,
      migration,
      diagnostics: [
        ...diagnostics,
        diagnostic(
          "resource_launch_href_missing",
          "error",
          "Migrated resource did not produce a launchable item path.",
          { path: normalized.sourcePath, sourceFormat: detection.sourceFormat },
        ),
      ],
    });
  }

  return {
    ok: true,
    title: migration.title,
    status: diagnostics.some((entry) => entry.severity === "warning")
      ? "converted_with_warnings"
      : "converted",
    sourceFormat: detection.sourceFormat,
    launchHref,
    itemHrefs,
    entries: packageEntries.entries,
    diagnostics,
  };
}

function normalizeResourceInput(input: QtiMigrationResourceInput): NormalizedResourceInput {
  const diagnostics: QtiMigrationDiagnostic[] = [];
  const sourcePath = normalizeMigrationResourcePath(
    input.sourcePath,
    "resource source path",
    diagnostics,
  );
  const { entries, diagnostics: entryDiagnostics } = migrationEntriesFromFileMap(
    input.files,
    (path) => normalizeMigrationResourcePath(path, "resource file path", diagnostics),
  );
  return {
    sourcePath: sourcePath ?? input.sourcePath.replaceAll("\\", "/"),
    entries,
    diagnostics: [...diagnostics, ...entryDiagnostics],
  };
}

function partFromItems(
  identifier: string,
  title: string,
  items: QtiMigrationResult["items"],
): QtiMigrationPart {
  return { identifier, title, itemHrefs: items.map((item) => item.href) };
}

function failedResourceMigrationResult(options: {
  readonly title: string;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
  readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  readonly migration?: QtiMigrationResult | undefined;
}): QtiResourceMigrationResult {
  const migration =
    options.migration ??
    ({
      title: options.title,
      sourceFormat: options.sourceFormat,
      parts: [],
      items: [],
      assets: [],
      diagnostics: options.diagnostics,
    } satisfies QtiMigrationResult);
  return {
    ok: false,
    title: migration.title,
    status: "failed",
    sourceFormat: options.sourceFormat ?? migration.sourceFormat,
    itemHrefs: migration.items.map((item) => item.href),
    entries: [],
    diagnostics: options.diagnostics.length
      ? options.diagnostics
      : aggregateMigrationDiagnostics(migration),
    migration,
  };
}
