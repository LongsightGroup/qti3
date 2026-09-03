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

/** Decoded ZIP entry from a QTI package. */
export interface QtiPackageEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** Read stored ZIP entries and optionally inflate raw DEFLATE entries through caller code. */
export function readQtiPackageZipEntries(
  bytes: Uint8Array,
  options: QtiPackageParseOptions,
  diagnostics: QtiDiagnostic[],
): QtiPackageEntry[] {
  try {
    return readZipEntriesUnsafe(bytes, options, diagnostics);
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

function readZipEntriesUnsafe(
  bytes: Uint8Array,
  options: QtiPackageParseOptions,
  diagnostics: QtiDiagnostic[],
): QtiPackageEntry[] {
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

  const limits = resolveResourceLimits(options.limits);
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
  let offset = view.getUint32(eocdOffset + 16, true);
  let totalUncompressedBytes = 0;
  const entries: QtiPackageEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength) {
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

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const declaredExpandedSize =
      compressionMethod === 0 ? Math.max(compressedSize, uncompressedSize) : uncompressedSize;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > view.byteLength) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.centralDirectory.name",
        "error",
        "ZIP central directory entry name is truncated.",
      );
      break;
    }

    const rawName = bytes.slice(nameStart, nameEnd);
    const decodedName = decodeUtf8(rawName).replaceAll("\\", "/");
    offset += 46 + nameLength + extraLength + commentLength;
    if (decodedName.endsWith("/")) continue;

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

    const path = normalizePackagePath(decodedName, "ZIP entry", diagnostics);
    if (!path) continue;

    const content = zipEntryBytes(
      bytes,
      view,
      {
        path,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        localHeaderOffset,
      },
      options,
      limits,
      diagnostics,
    );
    if (content) entries.push({ path, bytes: content });
  }

  return entries;
}

function zipEntryBytes(
  bytes: Uint8Array,
  view: DataView,
  entry: {
    readonly path: string;
    readonly compressedSize: number;
    readonly uncompressedSize: number;
    readonly compressionMethod: number;
    readonly localHeaderOffset: number;
  },
  options: QtiPackageParseOptions,
  limits: QtiPackageResourceLimits,
  diagnostics: QtiDiagnostic[],
): Uint8Array | undefined {
  if (entry.localHeaderOffset + 30 > view.byteLength) {
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
  if (dataEnd > view.byteLength) {
    pushPackageDiagnostic(
      diagnostics,
      "package.zip.entry.truncated",
      "error",
      `ZIP entry ${entry.path} content is truncated.`,
      entry.path,
    );
    return undefined;
  }

  const compressed = bytes.slice(dataOffset, dataEnd);
  if (entry.compressionMethod === 0) {
    return validateExpandedSize(compressed, entry, limits, diagnostics);
  }

  if (entry.compressionMethod === 8) {
    const inflateRaw = options.inflateRaw;
    if (!inflateRaw) {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.compression.unsupported",
        "error",
        `ZIP entry ${entry.path} uses DEFLATE compression, but no inflateRaw option was provided.`,
        entry.path,
      );
      return undefined;
    }

    try {
      const expanded = inflateRaw(compressed, {
        path: entry.path,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        compressionMethod: entry.compressionMethod,
        maxOutputLength: Math.max(1, entry.uncompressedSize),
      });
      return validateExpandedSize(expanded, entry, limits, diagnostics);
    } catch {
      pushPackageDiagnostic(
        diagnostics,
        "package.zip.entry.inflate",
        "error",
        `ZIP entry ${entry.path} could not be inflated.`,
        entry.path,
      );
      return undefined;
    }
  }

  pushPackageDiagnostic(
    diagnostics,
    "package.zip.entry.compression.unsupported",
    "error",
    `ZIP entry ${entry.path} uses unsupported compression method ${entry.compressionMethod}.`,
    entry.path,
  );
  return undefined;
}

function resolveResourceLimits(
  overrides: QtiPackageParseOptions["limits"],
): QtiPackageResourceLimits {
  return {
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

function validateExpandedSize(
  expanded: Uint8Array,
  entry: {
    readonly path: string;
    readonly uncompressedSize: number;
  },
  limits: QtiPackageResourceLimits,
  diagnostics: QtiDiagnostic[],
): Uint8Array | undefined {
  if (
    expanded.length === entry.uncompressedSize &&
    expanded.length <= limits.maxEntryUncompressedBytes
  ) {
    return expanded;
  }
  pushPackageDiagnostic(
    diagnostics,
    "package.zip.entry.size",
    "error",
    `ZIP entry ${entry.path} expanded to ${expanded.length} bytes; expected ${entry.uncompressedSize}.`,
    entry.path,
  );
  return undefined;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
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
