import {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  readQtiPackageZipEntriesAsync,
  parseQtiPackageStream,
  type QtiDiagnostic,
  type QtiPackageEntry,
  type QtiPackageItem,
  type QtiPackageResourceLimits,
  type QtiPackageStreamSummary,
} from "@longsightgroup/qti3-core";

/** A failed browser extraction or core import; provisional content is never exposed. */
export interface PackageFailure {
  readonly ok: false;
  readonly diagnostics: readonly QtiDiagnostic[];
}

/** Original entry bytes and core's successfully imported item models and metadata. */
export interface ImportedPackage {
  readonly ok: true;
  readonly entries: readonly QtiPackageEntry[];
  readonly items: readonly QtiPackageItem[];
  readonly summary: QtiPackageStreamSummary;
}

/** Extract a ZIP with native, bounded DEFLATE, preserving every file entry. */
export async function readBrowserPackageZip(
  bytes: Uint8Array,
  limits: QtiPackageResourceLimits = DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
): Promise<{ readonly ok: true; readonly entries: readonly QtiPackageEntry[] } | PackageFailure> {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = await readQtiPackageZipEntriesAsync(
    bytes,
    {
      limits,
      inflateRaw: (input, context) => inflateBounded(input, context.maxOutputLength),
    },
    diagnostics,
  );
  return diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? { ok: false, diagnostics }
    : { ok: true, entries };
}

/** Import original or database-restored entries through the public core package importer. */
export async function importPackageEntries(
  entries: readonly QtiPackageEntry[],
): Promise<ImportedPackage | PackageFailure> {
  const byPath = new Map(entries.map((entry) => [entry.path, entry.bytes]));
  const items: QtiPackageItem[] = [];
  const defaults = DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS;
  for await (const event of parseQtiPackageStream(
    {
      entries: entries.map((entry) => ({ path: entry.path, size: entry.bytes.byteLength })),
      readEntry: async (path, maxBytes) => {
        const bytes = byPath.get(path);
        if (!bytes || bytes.byteLength > maxBytes)
          throw new Error("Entry is missing or exceeds the read budget.");
        return bytes;
      },
    },
    {
      maxEntries: defaults.maxEntries,
      maxEntryBytes: defaults.maxEntryUncompressedBytes,
      maxTotalBytes: defaults.maxTotalUncompressedBytes,
      maxDiagnostics: 10_000,
    },
  )) {
    if (event.kind === "item") items.push(event.item);
    else if (!event.summary.ok) return { ok: false, diagnostics: event.summary.diagnostics };
    else return { ok: true, entries, items, summary: event.summary };
  }
  return failure("package.summary.missing", "Package import did not finish.");
}

function failure(code: string, message: string): PackageFailure {
  return { ok: false, diagnostics: [{ code, severity: "error", message }] };
}

async function inflateBounded(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined")
    throw new Error("This browser cannot read deflated ZIP packages.");
  const reader = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error("Expanded ZIP entry exceeds its declared byte budget.");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
