import { diagnostic } from "./diagnostics.js";
import { migrationPathIdentifier } from "./identifiers.js";
import { finalizeItemResult, finalizeItemResults } from "./item-finalize.js";
import { migrateItemXml } from "./migrate-items.js";
import { migrationPackageAssets } from "./assets.js";
import { resolveOptions } from "./options.js";
import { migrationResultToPackage } from "./package-result.js";
import { migrateQtiResourceToQti3 } from "./resource-migration.js";
import {
  detectMigrationSource,
  detectQtiMigrationSource,
  parseLegacyManifest,
  readMigrationSource,
  type MigrationSource,
} from "./source.js";
import type {
  QtiMigrationDetectionResult,
  QtiMigrationDiagnostic,
  QtiMigrationItemResult,
  QtiMigrationOptions,
  QtiMigrationPart,
  QtiMigrationResult,
  QtiMigrationSourceInput,
  QtiPackageMigrationResult,
} from "./types.js";

export { detectQtiMigrationSource, migrateQtiResourceToQti3 };
export type {
  QtiMigrationAsset,
  QtiMigrationDetectionResult,
  QtiMigrationDiagnostic,
  QtiMigrationDiagnosticSeverity,
  QtiMigrationItemResult,
  QtiMigrationOptions,
  QtiPackageMigrationResult,
  QtiMigrationPart,
  QtiMigrationResourceEntry,
  QtiMigrationResourceInput,
  QtiMigrationRepairPolicy,
  QtiMigrationResult,
  QtiMigrationSourceFormat,
  QtiMigrationSourceInput,
  QtiMigrationUnsupportedPolicy,
  QtiResourceMigrationResult,
  QtiResourceMigrationStatus,
} from "./types.js";

export async function migrateQtiToQti3(
  input: QtiMigrationSourceInput,
  options: QtiMigrationOptions = {},
): Promise<QtiMigrationResult> {
  const resolvedOptions = resolveOptions(options);
  const source = readMigrationSource(input);
  const detection = detectMigrationSource(source);
  if (!detection.supported || !detection.sourceFormat) {
    return {
      title: input.filename ?? "Imported QTI",
      sourceFormat: detection.sourceFormat,
      parts: [],
      items: [],
      assets: [],
      diagnostics: [
        diagnostic(
          "source_unsupported",
          "error",
          `Unsupported QTI migration source: ${detection.reason}.`,
          {
            sourceFormat: detection.sourceFormat,
          },
        ),
      ],
    };
  }

  const migrated = source.isPackage
    ? migratePackageSource(source, detection, resolvedOptions)
    : migrateItemSource(source, detection, resolvedOptions);
  return Promise.resolve(migrated);
}

export async function migrateQtiToQti3Package(
  input: QtiMigrationSourceInput,
  options: QtiMigrationOptions = {},
): Promise<QtiPackageMigrationResult> {
  const migration = await migrateQtiToQti3(input, options);
  return migrationResultToPackage(migration);
}

export function migrateQtiItemToQti3(
  input: QtiMigrationSourceInput,
  options: QtiMigrationOptions = {},
): QtiMigrationItemResult {
  const resolvedOptions = resolveOptions(options);
  const source = readMigrationSource(input);
  const detection = detectMigrationSource(source);
  if (!detection.sourceFormat || !source.xml) {
    return {
      identifier: "ITEM",
      title: input.filename ?? "Imported Item",
      href: "ITEM.xml",
      diagnostics: [
        diagnostic(
          "item_source_invalid",
          "error",
          "Input is not a supported QTI item XML source.",
          {
            sourceFormat: detection.sourceFormat,
          },
        ),
      ],
    };
  }
  const results = migrateItemXml(
    source.xml,
    input.filename ?? "item.xml",
    detection.sourceFormat,
    resolvedOptions,
  );
  const result = results[0];
  if (!result) {
    return {
      identifier: "ITEM",
      title: input.filename ?? "Imported Item",
      href: "ITEM.xml",
      diagnostics: [
        diagnostic(
          "item_migration_empty",
          "error",
          "Input did not produce a migratable QTI item.",
          {
            sourceFormat: detection.sourceFormat,
          },
        ),
      ],
    };
  }
  return finalizeItemResult(result, input.filename ?? `${result.identifier}.xml`, resolvedOptions);
}

function migratePackageSource(
  source: MigrationSource,
  detection: QtiMigrationDetectionResult,
  options: ReturnType<typeof resolveOptions>,
): QtiMigrationResult {
  const sourceFormat = detection.sourceFormat!;
  const manifestEntry = source.entries.find(
    (entry) => entry.path.toLowerCase() === "imsmanifest.xml",
  );
  const diagnostics: QtiMigrationDiagnostic[] = [];
  if (!manifestEntry?.text) {
    diagnostics.push(
      diagnostic("manifest_missing", "error", "QTI package is missing imsmanifest.xml.", {
        sourceFormat,
        path: "imsmanifest.xml",
      }),
    );
    return {
      title: source.filename ?? "Imported QTI Package",
      sourceFormat,
      parts: [],
      items: [],
      assets: [],
      diagnostics,
    };
  }

  const manifest = parseLegacyManifest(manifestEntry.text);
  diagnostics.push(...manifest.diagnostics.map((entry) => ({ ...entry, sourceFormat })));
  if (manifest.testHrefs.length) {
    diagnostics.push(
      diagnostic(
        "assessment_test_structure_not_migrated",
        "warning",
        "QTI assessment-test structure is not migrated yet; items are returned in a flat review part.",
        { sourceFormat, path: "imsmanifest.xml" },
      ),
    );
  }
  const entriesByPath = new Map(source.entries.map((entry) => [entry.path, entry]));
  const assetHrefsByItemHref = new Map<string, readonly string[]>();
  for (const resource of manifest.resources) {
    if (!resource.href) continue;
    assetHrefsByItemHref.set(
      resource.href,
      resource.files.filter(
        (file) => file !== resource.href && !file.toLowerCase().endsWith(".xml"),
      ),
    );
  }
  const itemHrefs = manifest.itemHrefs.length
    ? manifest.itemHrefs
    : source.entries
        .filter(
          (entry) => entry.path.toLowerCase().endsWith(".xml") && entry.path !== "imsmanifest.xml",
        )
        .map((entry) => entry.path);
  const items: QtiMigrationItemResult[] = [];
  for (const href of itemHrefs) {
    const entry = entriesByPath.get(href) ?? entriesByPath.get(href.replace(/^\.\//, ""));
    if (!entry?.text) {
      items.push({
        identifier: migrationPathIdentifier(href),
        title: href,
        href,
        diagnostics: [
          diagnostic("package_item_missing", "error", `Package item ${href} was not found.`, {
            path: href,
            sourceFormat,
          }),
        ],
      });
      continue;
    }
    const migratedItems = finalizeItemResults(
      migrateItemXml(entry.text, href, sourceFormat, options),
      href,
      options,
    );
    for (const item of migratedItems) {
      items.push({ ...item, assetHrefs: assetHrefsByItemHref.get(href) ?? [] });
    }
  }
  return {
    title: manifest.title,
    sourceFormat,
    parts: [partFromItems("PART_1", manifest.title, items)],
    items,
    assets: migrationPackageAssets(source.entries),
    diagnostics,
  };
}

function migrateItemSource(
  source: MigrationSource,
  detection: QtiMigrationDetectionResult,
  options: ReturnType<typeof resolveOptions>,
): QtiMigrationResult {
  const sourceFormat = detection.sourceFormat!;
  const xml = source.xml ?? "";
  const href = source.filename ?? "item.xml";
  const migratedItems = finalizeItemResults(
    migrateItemXml(xml, href, sourceFormat, options),
    href,
    options,
  );
  return {
    title: migratedItems[0]?.title ?? source.filename ?? "Imported QTI Item",
    sourceFormat,
    parts: [partFromItems("PART_1", "Imported Items", migratedItems)],
    items: migratedItems,
    assets: [],
    diagnostics: [],
  };
}

function partFromItems(
  identifier: string,
  title: string,
  items: readonly QtiMigrationItemResult[],
): QtiMigrationPart {
  return { identifier, title, itemHrefs: items.map((item) => item.href) };
}
