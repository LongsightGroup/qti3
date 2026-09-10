import {
  itemReferencesForPackageShape,
  parseAssessmentTestPackageModel,
  parsePackageItem,
} from "./qti-package-items.js";
import { QTI_PACKAGE_MANIFEST_PATH } from "./qti-package-manifest.js";
import {
  buildPackageSummary,
  enforceDiagnosticLimit,
  failedPackageSummary,
  inspectPackageManifest,
  type QtiPackageSummary,
} from "./qti-package-plan.js";
import { normalizePackagePath, pushPackageDiagnostic } from "./qti-package-paths.js";
import type { QtiPackageItem } from "./qti-package-types.js";
import { parsePackageXml } from "./qti-package-xml.js";
import type { QtiPackageEntry } from "./qti-package-zip.js";
import type { QtiDiagnostic } from "./types.js";

/** An immutable entry inventory and host-owned, bounded reads of decoded entry bytes. */
export interface QtiPackageSource {
  readonly entries: readonly { readonly path: string; readonly size: number }[];
  /** Enforce maxBytes during extraction, before allocating an oversized body. */
  readonly readEntry: (path: string, maxBytes: number) => Promise<Uint8Array>;
}

/** Explicit resource budgets for an incremental package read. */
export interface QtiPackageStreamLimits {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
  readonly maxDiagnostics: number;
}

/** Package metadata without extracted bodies or retained item models. */
export type QtiPackageStreamSummary = QtiPackageSummary;

/** Items are provisional until the terminal summary reports ok; hosts must stage them. */
export type QtiPackageStreamEvent =
  | { readonly kind: "item"; readonly index: number; readonly item: QtiPackageItem }
  | { readonly kind: "summary"; readonly summary: QtiPackageStreamSummary };

/**
 * Parse immutable package entries sequentially with canonical package semantics.
 *
 * The caller owns ZIP/object storage and must not collect item events when bounded
 * memory is required. Assets are described in the terminal summary, never loaded.
 * Breaking iteration stops subsequent reads. Read failures become safe diagnostics.
 */
export async function* parseQtiPackageStream(
  source: QtiPackageSource,
  limits: QtiPackageStreamLimits,
): AsyncGenerator<QtiPackageStreamEvent> {
  const diagnostics: QtiDiagnostic[] = [];
  const inventory = inspectInventory(source, limits, diagnostics);
  if (!inventory) {
    yield { kind: "summary", summary: failedPackageSummary(diagnostics) };
    return;
  }
  const read = createEntryReader(source, inventory, limits, diagnostics);
  const manifestEntry = await read(QTI_PACKAGE_MANIFEST_PATH);
  const manifest = inspectPackageManifest(
    inventory,
    manifestEntry ? parsePackageXml(manifestEntry) : undefined,
    diagnostics,
  );
  // Only the primary assessment test supplies the package structure. The shared
  // parser diagnoses additional test resources without loading their bodies.
  const testEntries = new Map<string, QtiPackageEntry>();
  const testHref = manifest.assessmentTestResources[0]?.href;
  if (testHref !== undefined) {
    const entry = await read(testHref);
    if (entry) testEntries.set(testHref, entry);
  }
  const assessmentTest = parseAssessmentTestPackageModel(
    manifest.packageShape,
    manifest.assessmentTestResources,
    testEntries,
    new Map(),
    diagnostics,
  );
  const references = itemReferencesForPackageShape(
    manifest.packageShape,
    manifest.itemResources,
    assessmentTest,
    diagnostics,
  );
  const assetItems: Pick<QtiPackageItem, "href" | "manifestResourceIdentifier" | "assetHrefs">[] =
    [];
  const itemStandards: QtiPackageItem["standards"][number][] = [];
  const titleItems: Pick<QtiPackageItem, "title">[] = [];
  const seen = new Set<string>();
  let itemCount = 0;
  let timedItemCount = 0;
  let soleItemTiming: QtiPackageItem["timing"] | undefined;
  for (const reference of references) {
    if (diagnostics.length >= limits.maxDiagnostics) break;
    if (seen.has(reference.href)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.item.reference.duplicate",
        "warning",
        `Package item ${reference.href} is referenced more than once.`,
        reference.href,
      );
      continue;
    }
    seen.add(reference.href);
    const entry = await read(reference.href);
    if (!entry) continue;
    const item = parsePackageItem(reference, entry, undefined, diagnostics);
    if (item.title !== undefined && titleItems.length === 0) {
      titleItems.push({ title: item.title });
    }
    if (item.timing !== undefined) {
      timedItemCount += 1;
      soleItemTiming = item.timing;
    }
    itemStandards.push(...item.standards);
    assetItems.push({
      href: item.href,
      manifestResourceIdentifier: item.manifestResourceIdentifier,
      assetHrefs: item.assetHrefs,
    });
    yield { kind: "item", index: itemCount++, item };
  }
  enforceDiagnosticLimit(diagnostics, limits.maxDiagnostics);
  yield {
    kind: "summary",
    summary: buildPackageSummary({
      manifestRoot: manifest.manifestRoot,
      manifestResources: manifest.manifestResources,
      resourcesByIdentifier: manifest.resourcesByIdentifier,
      packageShape: manifest.packageShape,
      assessmentTest,
      assetItems,
      titleItems,
      timedItemCount,
      soleItemTiming,
      itemStandards,
      entriesByPath: inventory,
      diagnostics,
      itemCount,
    }),
  };
}

function createEntryReader(
  source: QtiPackageSource,
  inventory: ReadonlyMap<string, number>,
  limits: QtiPackageStreamLimits,
  diagnostics: QtiDiagnostic[],
): (path: string) => Promise<QtiPackageEntry | undefined> {
  return async (path) => {
    const size = inventory.get(path);
    if (size === undefined) return undefined;
    try {
      const bytes = await source.readEntry(path, limits.maxEntryBytes);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== size) {
        pushPackageDiagnostic(
          diagnostics,
          "package.entry.size",
          "error",
          "Package entry size does not match its immutable inventory.",
          path,
        );
        return undefined;
      }
      return { path, bytes };
    } catch {
      pushPackageDiagnostic(
        diagnostics,
        "package.entry.read",
        "error",
        "Package entry could not be read.",
        path,
      );
      return undefined;
    }
  };
}

function inspectInventory(
  source: QtiPackageSource,
  limits: QtiPackageStreamLimits,
  diagnostics: QtiDiagnostic[],
): Map<string, number> | undefined {
  if (!validStreamLimits(limits)) {
    pushPackageDiagnostic(
      diagnostics,
      "package.limits.invalid",
      "error",
      "Package limits must be positive safe integers.",
    );
    return undefined;
  }
  if (source.entries.length > limits.maxEntries) {
    pushPackageDiagnostic(
      diagnostics,
      "package.entries.limit",
      "error",
      "Package contains more entries than allowed.",
    );
    return undefined;
  }
  const inventory = new Map<string, number>();
  let total = 0;
  for (const entry of source.entries) {
    const path = normalizePackagePath(entry.path, "entry", diagnostics);
    if (!path) return undefined;
    if (path !== entry.path || inventory.has(path)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.entry.duplicate",
        "error",
        "Package inventory paths must be unique and canonical.",
        entry.path,
      );
      return undefined;
    }
    total += entry.size;
    if (
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      entry.size > limits.maxEntryBytes ||
      !Number.isSafeInteger(total) ||
      total > limits.maxTotalBytes
    ) {
      pushPackageDiagnostic(
        diagnostics,
        "package.bytes.limit",
        "error",
        "Package entry or total size exceeds its configured budget.",
        path,
      );
      return undefined;
    }
    inventory.set(path, entry.size);
  }
  return inventory;
}

function validStreamLimits(limits: QtiPackageStreamLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxEntries) &&
    limits.maxEntries > 0 &&
    Number.isSafeInteger(limits.maxEntryBytes) &&
    limits.maxEntryBytes > 0 &&
    Number.isSafeInteger(limits.maxTotalBytes) &&
    limits.maxTotalBytes > 0 &&
    Number.isSafeInteger(limits.maxDiagnostics) &&
    limits.maxDiagnostics > 0
  );
}
