import {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  readQtiPackageZipEntriesAsync,
  type QtiDiagnostic,
  type QtiPackageEntry,
  type QtiPackageResourceLimits,
} from "@longsightgroup/qti3-core";

/** A failed browser extraction or core import; provisional content is never exposed. */
export interface PackageFailure {
  readonly ok: false;
  readonly diagnostics: readonly QtiDiagnostic[];
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
