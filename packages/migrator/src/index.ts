import { parseQtiXml, validateAssessmentItem, type QtiDiagnostic } from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3AuthoringItem,
} from "@longsightgroup/qti3-writer";
import { diagnostic, hasErrors } from "./diagnostics.js";
import { resolveOptions } from "./options.js";
import { migrateQti12Xml } from "./qti12-item.js";
import { itemTitleFromXml, migrateQti2ItemXml } from "./qti2-item.js";
import {
  detectMigrationSource,
  detectQtiMigrationSource,
  parseLegacyManifest,
  readMigrationSource,
  type MigrationEntry,
  type MigrationSource,
} from "./source.js";
import type {
  QtiMigrationAsset,
  QtiMigrationDetectionResult,
  QtiMigrationDiagnostic,
  QtiMigrationItemResult,
  QtiMigrationOptions,
  QtiMigrationPart,
  QtiMigrationResult,
  QtiMigrationSourceFormat,
  QtiMigrationSourceInput,
} from "./types.js";

export { detectQtiMigrationSource };
export type {
  QtiMigrationAsset,
  QtiMigrationDetectionResult,
  QtiMigrationDiagnostic,
  QtiMigrationDiagnosticSeverity,
  QtiMigrationItemResult,
  QtiMigrationOptions,
  QtiMigrationPart,
  QtiMigrationRepairPolicy,
  QtiMigrationResult,
  QtiMigrationSourceFormat,
  QtiMigrationSourceInput,
  QtiMigrationUnsupportedPolicy,
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
        identifier: pathIdentifier(href),
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
    const migratedItems = migrateItemXml(entry.text, href, sourceFormat, options);
    for (const item of migratedItems) {
      items.push(finalizeItemResult(item, `${item.identifier}.xml`, options));
    }
  }
  return {
    title: manifest.title,
    sourceFormat,
    parts: [partFromItems("PART_1", manifest.title, items)],
    items,
    assets: packageAssets(source.entries),
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
  const migratedItems = migrateItemXml(
    xml,
    source.filename ?? "item.xml",
    sourceFormat,
    options,
  ).map((item) => finalizeItemResult(item, `${item.identifier}.xml`, options));
  return {
    title: migratedItems[0]?.title ?? source.filename ?? "Imported QTI Item",
    sourceFormat,
    parts: [partFromItems("PART_1", "Imported Items", migratedItems)],
    items: migratedItems,
    assets: [],
    diagnostics: [],
  };
}

function migrateItemXml(
  xml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
  options: ReturnType<typeof resolveOptions>,
): readonly PendingMigrationItem[] {
  if (sourceFormat === "qti12") {
    return migrateQti12Xml(xml, path, options).map((result, index) => ({
      identifier: result.authoringItem?.identifier ?? `ITEM_${index + 1}`,
      title: result.authoringItem?.title ?? itemTitleFromXmlSafe(xml),
      authoringItem: result.authoringItem,
      diagnostics: result.diagnostics,
    }));
  }
  const result = migrateQti2ItemXml(xml, path, sourceFormat, options);
  return [
    {
      identifier: result.authoringItem?.identifier ?? pathIdentifier(path),
      title: result.authoringItem?.title ?? itemTitleFromXmlSafe(xml),
      authoringItem: result.authoringItem,
      diagnostics: result.diagnostics,
    },
  ];
}

interface PendingMigrationItem {
  readonly identifier: string;
  readonly title: string;
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

function finalizeItemResult(
  pending: PendingMigrationItem,
  href: string,
  options: ReturnType<typeof resolveOptions>,
): QtiMigrationItemResult {
  const diagnostics = [...pending.diagnostics];
  if (pending.authoringItem && !hasErrors(diagnostics)) {
    const writer = writeQti3AssessmentItemResult(pending.authoringItem);
    if (writer.ok) {
      diagnostics.push(...validateWrittenXml(writer.xml));
      return {
        identifier: pending.identifier,
        title: pending.title,
        href,
        authoringItem: pending.authoringItem,
        xml: writer.xml,
        diagnostics,
      };
    }
    diagnostics.push({
      code: "writer_diagnostics",
      severity: "error",
      message: "QTI 3 writer rejected migrated authoring item.",
      writerDiagnostics: writer.diagnostics,
    });
  }

  if (options.unsupportedPolicy === "stub") {
    const stub = stubItem(pending.identifier, pending.title);
    const writer = writeQti3AssessmentItemResult(stub);
    return {
      identifier: pending.identifier,
      title: pending.title,
      href,
      authoringItem: stub,
      xml: writer.ok ? writer.xml : undefined,
      diagnostics: [
        ...diagnostics,
        diagnostic(
          "unsupported_item_stubbed",
          "warning",
          "Unsupported item migrated as an extended-text review stub.",
        ),
      ],
    };
  }

  return {
    identifier: pending.identifier,
    title: pending.title,
    href,
    authoringItem: options.unsupportedPolicy === "skip" ? undefined : pending.authoringItem,
    diagnostics,
  };
}

function validateWrittenXml(xml: string): QtiMigrationDiagnostic[] {
  const parsed = parseQtiXml(xml);
  const diagnostics: QtiMigrationDiagnostic[] = [];
  if (!parsed.ok || !parsed.document) {
    diagnostics.push(...coreDiagnostics("core_parse", parsed.diagnostics));
    return diagnostics;
  }
  const validation = validateAssessmentItem(parsed.document);
  if (!validation.ok) diagnostics.push(...coreDiagnostics("core_validate", validation.diagnostics));
  return diagnostics;
}

function coreDiagnostics(
  prefix: string,
  diagnostics: readonly QtiDiagnostic[],
): QtiMigrationDiagnostic[] {
  return diagnostics.map((entry) =>
    diagnostic(
      `${prefix}.${entry.code}`,
      entry.severity === "error" ? "error" : "warning",
      entry.message,
    ),
  );
}

function stubItem(identifier: string, title: string): Qti3AuthoringItem {
  return {
    interactionType: "extendedText",
    identifier,
    title,
    bodyHtml: qti3TrustedXmlFragment("<p>This item requires manual migration review.</p>"),
    responseIdentifier: "RESPONSE",
    responseBaseType: "string",
    responseCardinality: "single",
    expectedLines: 6,
  };
}

function packageAssets(entries: readonly MigrationEntry[]): QtiMigrationAsset[] {
  return entries
    .filter((entry) => !entry.path.toLowerCase().endsWith(".xml"))
    .map((entry) => ({ path: entry.path, data: entry.bytes, mediaType: mediaType(entry.path) }));
}

function partFromItems(
  identifier: string,
  title: string,
  items: readonly QtiMigrationItemResult[],
): QtiMigrationPart {
  return { identifier, title, itemHrefs: items.map((item) => item.href) };
}

function pathIdentifier(path: string): string {
  return path.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_") || "ITEM";
}

function itemTitleFromXmlSafe(xml: string): string {
  try {
    return itemTitleFromXml(xml);
  } catch {
    return "Imported Item";
  }
}

function mediaType(path: string): string | undefined {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.mp3$/i.test(path)) return "audio/mpeg";
  if (/\.mp4$/i.test(path)) return "video/mp4";
  return undefined;
}
