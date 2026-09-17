import {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  normalizePackagePath,
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
  try {
    return { ok: true, entries: await extractZip(bytes, limits) };
  } catch (cause: unknown) {
    return failure(
      "package.zip.invalid",
      cause instanceof Error ? cause.message : "Could not read ZIP package.",
    );
  }
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

interface ZipFile {
  readonly path: string;
  readonly start: number;
  readonly compressed: number;
  readonly expanded: number;
  readonly method: number;
}

async function extractZip(
  bytes: Uint8Array,
  limits: QtiPackageResourceLimits,
): Promise<QtiPackageEntry[]> {
  if (Object.values(limits).some((limit) => !Number.isSafeInteger(limit) || limit <= 0)) {
    throw new Error("ZIP resource limits must be positive safe integers.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === bytes.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("No ZIP central directory was found.");
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  const directoryStart = offset;
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count ||
    count === 65535
  ) {
    throw new Error("Multi-disk and ZIP64 packages are not supported.");
  }
  if (count > limits.maxEntries) throw new Error("ZIP entry count exceeds the package budget.");
  if (offset + directorySize !== end) throw new Error("ZIP central directory bounds are invalid.");
  const files: ZipFile[] = [];
  const paths = new Set<string>();
  const ranges: { start: number; end: number }[] = [];
  let total = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("ZIP central directory entry is truncated or invalid.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const expanded = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true);
    const next =
      offset +
      46 +
      nameSize +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (next > end || view.getUint16(offset + 34, true) !== 0)
      throw new Error("ZIP entry bounds are invalid.");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
    offset = next;
    const path = name.endsWith("/") ? name.slice(0, -1) : name;
    const pathDiagnostics: QtiDiagnostic[] = [];
    const canonicalPath = normalizePackagePath(path, "ZIP entry", pathDiagnostics);
    if (pathDiagnostics.length)
      throw new Error(pathDiagnostics.map((diagnostic) => diagnostic.message).join(" "));
    if (
      !path ||
      path.includes("\\") ||
      path.includes("\0") ||
      canonicalPath !== path ||
      paths.has(path)
    ) {
      throw new Error("ZIP entry paths must be unique, canonical, and package-relative.");
    }
    paths.add(path);
    if ((flags & ~0x080e) !== 0 || (flags & 1) !== 0 || (method !== 0 && method !== 8))
      throw new Error("Unsupported ZIP encryption or compression method.");
    if (
      expanded > limits.maxEntryUncompressedBytes ||
      total + expanded > limits.maxTotalUncompressedBytes
    )
      throw new Error("ZIP expanded size exceeds the package budget.");
    if (expanded > Math.max(1, compressed) * limits.maxCompressionRatio)
      throw new Error("ZIP compression ratio exceeds the package budget.");
    if (method === 0 && expanded !== compressed)
      throw new Error("Stored ZIP entry sizes do not match.");
    total += expanded;
    if (local + 30 > directoryStart || view.getUint32(local, true) !== 0x04034b50)
      throw new Error("ZIP local header is invalid.");
    const localNameSize = view.getUint16(local + 26, true);
    const start = local + 30 + localNameSize + view.getUint16(local + 28, true);
    if (
      start + compressed > directoryStart ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + localNameSize)) !== name
    )
      throw new Error("ZIP local and central entries do not match.");
    if (
      !(flags & 8) &&
      (view.getUint32(local + 18, true) !== compressed ||
        view.getUint32(local + 22, true) !== expanded)
    )
      throw new Error("ZIP local and central sizes do not match.");
    ranges.push({ start: local, end: start + compressed });
    if (name.endsWith("/")) {
      if (expanded !== 0) throw new Error("ZIP directory has unexpected content.");
    } else files.push({ path, start, compressed, expanded, method });
  }
  if (offset !== end) throw new Error("ZIP entry count does not match the central directory.");
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index++) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (previous && current && previous.end > current.start)
      throw new Error("ZIP entry bodies overlap.");
  }
  const entries: QtiPackageEntry[] = [];
  for (const file of files) {
    const input = bytes.slice(file.start, file.start + file.compressed);
    const output = file.method === 0 ? input : await inflateBounded(input, file.expanded);
    if (output.length !== file.expanded)
      throw new Error("Expanded ZIP entry size does not match its declaration.");
    entries.push({ path: file.path, bytes: output });
  }
  return entries;
}

async function inflateBounded(
  bytes: Uint8Array<ArrayBuffer>,
  maxBytes: number,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined")
    throw new Error("This browser cannot read deflated ZIP packages.");
  const reader = new Blob([bytes])
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
