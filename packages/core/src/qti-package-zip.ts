import { normalizePackagePath, pushPackageDiagnostic } from "./qti-package-paths.js";
import type { QtiDiagnostic } from "./types.js";

/** Context passed to a caller-owned raw DEFLATE inflater. */
export interface QtiPackageInflateContext {
  readonly path: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly compressionMethod: number;
  /** Maximum output bytes the inflater may materialize for this entry. */
  readonly maxOutputLength: number;
}

/**
 * Optional raw DEFLATE inflater for ZIP entries compressed with method 8.
 * Implementations must enforce `context.maxOutputLength` while expanding input.
 */
export type QtiPackageInflateRaw = (
  bytes: Uint8Array,
  context: QtiPackageInflateContext,
) => Uint8Array;

/** Async raw DEFLATE adapter; enforce the same output budget as the sync adapter. */
export type QtiPackageInflateRawAsync = (
  bytes: Uint8Array,
  context: QtiPackageInflateContext,
) => Promise<Uint8Array>;

/** Resource budgets applied before and after QTI package entry expansion. */
export interface QtiPackageResourceLimits {
  readonly maxEntries: number;
  readonly maxEntryUncompressedBytes: number;
  readonly maxTotalUncompressedBytes: number;
  readonly maxCompressionRatio: number;
}

/** Conservative default budgets for untrusted QTI package ZIP input. */
export const DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS: QtiPackageResourceLimits = Object.freeze({
  maxEntries: 4_096,
  maxEntryUncompressedBytes: 128 * 1_024 * 1_024,
  maxTotalUncompressedBytes: 512 * 1_024 * 1_024,
  maxCompressionRatio: 200,
});

/** Options for parsing a QTI ZIP package. */
export interface QtiPackageParseOptions {
  readonly inflateRaw?: QtiPackageInflateRaw | undefined;
  /** Overrides for the default package resource budgets. */
  readonly limits?: Partial<QtiPackageResourceLimits> | undefined;
}

/** Options for ZIP extraction with an asynchronous host inflater. */
export interface QtiPackageZipAsyncOptions {
  readonly inflateRaw?: QtiPackageInflateRawAsync | undefined;
  readonly limits?: Partial<QtiPackageResourceLimits> | undefined;
}

/** Decoded ZIP entry from a QTI package. */
export interface QtiPackageEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

interface ZipEntry extends QtiPackageInflateContext {
  readonly compressed: Uint8Array;
}

/** Read stored ZIP entries and optionally inflate raw DEFLATE entries through caller code.
 * Entries are provisional: reject the archive if diagnostics contains an error.
 */
export function readQtiPackageZipEntries(
  bytes: Uint8Array,
  options: QtiPackageParseOptions,
  diagnostics: QtiDiagnostic[],
): QtiPackageEntry[] {
  const entries: QtiPackageEntry[] = [];
  for (const entry of inspectZipEntries(bytes, options.limits, diagnostics)) {
    try {
      let expanded = entry.compressed;
      if (entry.compressionMethod !== 0) {
        const inflateRaw = options.inflateRaw;
        if (!inflateRaw) {
          diagnoseMissingInflater(entry, diagnostics);
          continue;
        }
        expanded = inflateRaw(entry.compressed, entry);
      }
      appendExpandedEntry(entries, entry, expanded, diagnostics);
    } catch {
      diagnoseInflateFailure(entry, diagnostics);
    }
  }
  return entries;
}

/** Async counterpart with identical archive validation, limits, and diagnostics. */
export async function readQtiPackageZipEntriesAsync(
  bytes: Uint8Array,
  options: QtiPackageZipAsyncOptions,
  diagnostics: QtiDiagnostic[],
): Promise<QtiPackageEntry[]> {
  const entries: QtiPackageEntry[] = [];
  for (const entry of inspectZipEntries(bytes, options.limits, diagnostics)) {
    try {
      let expanded = entry.compressed;
      if (entry.compressionMethod !== 0) {
        const inflateRaw = options.inflateRaw;
        if (!inflateRaw) {
          diagnoseMissingInflater(entry, diagnostics);
          continue;
        }
        expanded = await inflateRaw(entry.compressed, entry);
      }
      appendExpandedEntry(entries, entry, expanded, diagnostics);
    } catch {
      diagnoseInflateFailure(entry, diagnostics);
    }
  }
  return entries;
}

function diagnoseMissingInflater(entry: ZipEntry, diagnostics: QtiDiagnostic[]): void {
  pushPackageDiagnostic(
    diagnostics,
    "package.zip.entry.compression.unsupported",
    "error",
    `ZIP entry ${entry.path} uses DEFLATE compression, but no inflateRaw option was provided.`,
    entry.path,
  );
}

function appendExpandedEntry(
  entries: QtiPackageEntry[],
  entry: ZipEntry,
  expanded: Uint8Array,
  diagnostics: QtiDiagnostic[],
): void {
  if (expanded.length === entry.uncompressedSize) {
    entries.push({ path: entry.path, bytes: expanded });
  } else {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.entry.size",
      "error",
      `ZIP entry ${entry.path} expanded to ${expanded.length} bytes; expected ${entry.uncompressedSize}.`,
      entry.path,
    );
  }
}

function diagnoseInflateFailure(entry: ZipEntry, diagnostics: QtiDiagnostic[]): void {
  pushPackageDiagnostic(
    diagnostics,
    "package.zip.entry.inflate",
    "error",
    `ZIP entry ${entry.path} could not be inflated.`,
    entry.path,
  );
}

function inspectZipEntries(
  bytes: Uint8Array,
  overrides: QtiPackageParseOptions["limits"],
  diagnostics: QtiDiagnostic[],
): ZipEntry[] {
  const limits = resolveResourceLimits(overrides, diagnostics);
  if (!limits) return [];
  try {
    return readZipDirectory(bytes, limits, diagnostics);
  } catch {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.invalid",
      "error",
      "QTI package ZIP central directory is malformed.",
    );
    return [];
  }
}

// Intentionally manual: core's TS lib is ES2023-only (no DOM/Node globals).
// TextDecoder is available on all supported runtimes, but using it would require
// widening lib, ambient types, or globalThis casts in this zero-runtime-dependency package.
/** Decode UTF-8 package entry names and XML payloads. */
export function decodeUtf8(bytes: Uint8Array): string {
  const input =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  let text = "";

  for (let index = 0; index < input.length; ) {
    const first = input[index];
    if (first === undefined) break;
    if (first < 0x80) {
      text += String.fromCharCode(first);
      index += 1;
      continue;
    }

    const decoded = decodeUtf8CodePoint(input, index);
    text += String.fromCodePoint(decoded.codePoint);
    index += decoded.length;
  }

  return text;
}

function readZipDirectory(
  bytes: Uint8Array,
  limits: QtiPackageResourceLimits,
  diagnostics: QtiDiagnostic[],
): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.centralDirectory.missing",
      "error",
      "No ZIP central directory was found.",
    );
    return [];
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  if (entryCount > limits.maxEntries) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.limit.entries",
      "error",
      `QTI package ZIP contains ${entryCount} entries; the configured limit is ${limits.maxEntries}.`,
    );
    return [];
  }
  if (
    view.getUint16(eocdOffset + 4, true) !== 0 ||
    view.getUint16(eocdOffset + 6, true) !== 0 ||
    view.getUint16(eocdOffset + 8, true) !== entryCount ||
    entryCount === 0xffff
  ) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.format.unsupported",
      "error",
      "Multi-disk and ZIP64 packages are not supported.",
    );
    return [];
  }
  let offset = view.getUint32(eocdOffset + 16, true);
  const directoryStart = offset;
  if (offset + view.getUint32(eocdOffset + 12, true) !== eocdOffset) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.centralDirectory.bounds",
      "error",
      "ZIP central directory bounds are invalid.",
    );
    return [];
  }
  const paths = new Set<string>();
  const ranges: { start: number; end: number }[] = [];
  let totalUncompressedBytes = 0;
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocdOffset) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.centralDirectory.truncated",
        "error",
        "ZIP central directory ended before all entries could be read.",
      );
      break;
    }

    if (view.getUint32(offset, true) !== 0x02014b50) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.centralDirectory.entry",
        "error",
        "ZIP central directory entry header is invalid.",
      );
      break;
    }

    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const declaredExpandedSize =
      compressionMethod === 0 ? Math.max(compressedSize, uncompressedSize) : uncompressedSize;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const disk = view.getUint16(offset + 34, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength + commentLength > eocdOffset) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.centralDirectory.name",
        "error",
        "ZIP central directory entry name is truncated.",
      );
      break;
    }

    const rawName = bytes.slice(nameStart, nameEnd);
    const decodedName = decodeUtf8(rawName);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!isValidUtf8(rawName)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.name",
        "error",
        "ZIP entry name is not valid UTF-8.",
      );
      continue;
    }
    if (
      disk !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.format.unsupported",
        "error",
        "Multi-disk and ZIP64 entries are not supported.",
        decodedName,
      );
      continue;
    }
    if ((flags & ~0x080e) !== 0) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.flags.unsupported",
        "error",
        "ZIP encryption or entry flags are unsupported.",
        decodedName,
      );
      continue;
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.compression.unsupported",
        "error",
        `ZIP entry ${decodedName} uses unsupported compression method ${compressionMethod}.`,
        decodedName,
      );
      continue;
    }

    if (declaredExpandedSize > limits.maxEntryUncompressedBytes) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.limit.entrySize",
        "error",
        `ZIP entry ${decodedName} declares ${declaredExpandedSize} expanded bytes; the configured per-entry limit is ${limits.maxEntryUncompressedBytes}.`,
        decodedName,
      );
      continue;
    }
    if (exceedsCompressionRatio(compressionMethod, compressedSize, uncompressedSize, limits)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.limit.compressionRatio",
        "error",
        `ZIP entry ${decodedName} exceeds the configured compression ratio limit of ${limits.maxCompressionRatio}.`,
        decodedName,
      );
      continue;
    }
    if (totalUncompressedBytes + declaredExpandedSize > limits.maxTotalUncompressedBytes) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.limit.totalSize",
        "error",
        `QTI package ZIP exceeds the configured total uncompressed size limit of ${limits.maxTotalUncompressedBytes} bytes.`,
      );
      break;
    }
    totalUncompressedBytes += declaredExpandedSize;

    const name = decodedName.endsWith("/") ? decodedName.slice(0, -1) : decodedName;
    const path = normalizePackagePath(name, "ZIP entry", diagnostics);
    if (path === undefined) continue;
    if (!path || path !== name || name.includes("\\") || name.includes("\0")) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.path",
        "error",
        "ZIP entry paths must be canonical and package-relative.",
        decodedName,
      );
      continue;
    }
    if (paths.has(path)) {
      pushPackageDiagnostic(
        diagnostics,
        "package.entry.duplicate",
        "error",
        `QTI package contains duplicate entry ${path}.`,
        path,
      );
      continue;
    }
    paths.add(path);

    const content = readCompressedEntry(
      bytes,
      view,
      {
        path,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        localHeaderOffset,
        flags,
        rawName,
      },
      directoryStart,
      ranges,
      diagnostics,
    );
    if (!content) continue;
    if (decodedName.endsWith("/")) {
      if (uncompressedSize !== 0 || (compressionMethod === 0 && compressedSize !== 0))
        pushPackageDiagnostic(
          diagnostics,
          "package.zip.directory.content",
          "error",
          "ZIP directory has unexpected content.",
          path,
        );
      continue;
    }
    entries.push({
      path,
      compressed: content,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      maxOutputLength: Math.max(1, uncompressedSize),
    });
  }

  if (offset !== eocdOffset) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.centralDirectory.count",
      "error",
      "ZIP entry count does not match the central directory.",
    );
  }
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index++) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (previous && current && previous.end > current.start) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.overlap",
        "error",
        "ZIP entry bodies overlap.",
      );
      return [];
    }
  }
  return entries;
}

function readCompressedEntry(
  bytes: Uint8Array,
  view: DataView,
  entry: {
    readonly path: string;
    readonly compressedSize: number;
    readonly uncompressedSize: number;
    readonly compressionMethod: number;
    readonly localHeaderOffset: number;
    readonly flags: number;
    readonly rawName: Uint8Array;
  },
  directoryStart: number,
  ranges: { start: number; end: number }[],
  diagnostics: QtiDiagnostic[],
): Uint8Array | undefined {
  if (entry.localHeaderOffset + 30 > directoryStart) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.localHeader.truncated",
      "error",
      `ZIP local header for ${entry.path} is truncated.`,
      entry.path,
    );
    return undefined;
  }

  if (view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.localHeader",
      "error",
      `ZIP local header for ${entry.path} is invalid.`,
      entry.path,
    );
    return undefined;
  }

  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > directoryStart) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.entry.truncated",
      "error",
      `ZIP entry ${entry.path} content is truncated.`,
      entry.path,
    );
    return undefined;
  }

  const localName = bytes.subarray(
    entry.localHeaderOffset + 30,
    entry.localHeaderOffset + 30 + nameLength,
  );
  if (
    view.getUint16(entry.localHeaderOffset + 6, true) !== entry.flags ||
    view.getUint16(entry.localHeaderOffset + 8, true) !== entry.compressionMethod ||
    localName.length !== entry.rawName.length ||
    localName.some((value, index) => value !== entry.rawName[index]) ||
    (!(entry.flags & 8) &&
      (view.getUint32(entry.localHeaderOffset + 18, true) !== entry.compressedSize ||
        view.getUint32(entry.localHeaderOffset + 22, true) !== entry.uncompressedSize))
  ) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.localHeader.mismatch",
      "error",
      `ZIP local and central entries for ${entry.path} do not match.`,
      entry.path,
    );
    return undefined;
  }
  ranges.push({ start: entry.localHeaderOffset, end: dataEnd });
  return bytes.slice(dataOffset, dataEnd);
}

export function resolveResourceLimits(
  overrides: QtiPackageParseOptions["limits"],
  diagnostics: QtiDiagnostic[],
): QtiPackageResourceLimits | undefined {
  const limits = {
    maxEntries: overrides?.maxEntries ?? DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS.maxEntries,
    maxEntryUncompressedBytes:
      overrides?.maxEntryUncompressedBytes ??
      DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS.maxEntryUncompressedBytes,
    maxTotalUncompressedBytes:
      overrides?.maxTotalUncompressedBytes ??
      DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS.maxTotalUncompressedBytes,
    maxCompressionRatio:
      overrides?.maxCompressionRatio ?? DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS.maxCompressionRatio,
  };
  if (
    Object.values(limits).some(
      (limit) => limit !== Infinity && (!Number.isSafeInteger(limit) || limit <= 0),
    )
  ) {
    pushPackageDiagnostic(
      diagnostics,
      "package.limit.invalid",
      "error",
      "Package resource limits must be positive safe integers or Infinity.",
    );
    return undefined;
  }
  return limits;
}

function exceedsCompressionRatio(
  compressionMethod: number,
  compressedSize: number,
  uncompressedSize: number,
  limits: QtiPackageResourceLimits,
): boolean {
  if (compressionMethod !== 8 || uncompressedSize === 0) return false;
  if (compressedSize === 0) return true;
  return uncompressedSize / compressedSize > limits.maxCompressionRatio;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === view.byteLength
    )
      return offset;
  }
  return -1;
}

function decodeUtf8CodePoint(
  bytes: Uint8Array,
  index: number,
): { readonly codePoint: number; readonly length: number } {
  const first = bytes[index];
  if (first === undefined) return { codePoint: 0xfffd, length: 1 };

  if (first >= 0xc2 && first <= 0xdf) {
    const second = bytes[index + 1];
    if (isUtf8Continuation(second)) {
      return {
        codePoint: ((first & 0x1f) << 6) | (second & 0x3f),
        length: 2,
      };
    }
  }

  if (first >= 0xe0 && first <= 0xef) {
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    if (
      isUtf8Continuation(second) &&
      isUtf8Continuation(third) &&
      !(first === 0xe0 && second < 0xa0) &&
      !(first === 0xed && second >= 0xa0)
    ) {
      return {
        codePoint: ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f),
        length: 3,
      };
    }
  }

  if (first >= 0xf0 && first <= 0xf4) {
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const fourth = bytes[index + 3];
    if (
      isUtf8Continuation(second) &&
      isUtf8Continuation(third) &&
      isUtf8Continuation(fourth) &&
      !(first === 0xf0 && second < 0x90) &&
      !(first === 0xf4 && second >= 0x90)
    ) {
      return {
        codePoint:
          ((first & 0x07) << 18) |
          ((second & 0x3f) << 12) |
          ((third & 0x3f) << 6) |
          (fourth & 0x3f),
        length: 4,
      };
    }
  }

  return { codePoint: 0xfffd, length: 1 };
}

function isUtf8Continuation(value: number | undefined): value is number {
  return value !== undefined && value >= 0x80 && value <= 0xbf;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  for (let index = 0; index < bytes.length; ) {
    const byte = bytes[index];
    if (byte === undefined) return false;
    if (byte < 0x80) {
      index++;
      continue;
    }
    const decoded = decodeUtf8CodePoint(bytes, index);
    if (decoded.length === 1) return false;
    index += decoded.length;
  }
  return true;
}
