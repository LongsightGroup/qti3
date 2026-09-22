import {
  parseQtiPackageFromEntries,
  type QtiDiagnostic,
  type QtiPackageEntry,
  type QtiPackageItem,
  type QtiPackageParseResult,
} from "@longsightgroup/qti3-core";

/** Original package plus the items the library can open; package validity is unchanged. */
export interface LibraryPackage {
  readonly kind: "ready";
  readonly package: QtiPackageParseResult;
  readonly items: readonly QtiPackageItem[];
  readonly rejectedItems: readonly QtiPackageItem[];
}

/** Apply the same item acceptance policy on import and on every database reopen. */
export function importLibraryItems(
  entries: readonly QtiPackageEntry[],
): LibraryPackage | { readonly kind: "blocked"; readonly diagnostics: readonly QtiDiagnostic[] } {
  const parsed = parseQtiPackageFromEntries(entries);
  const items: QtiPackageItem[] = [];
  const rejectedItems: QtiPackageItem[] = [];
  const itemErrors = new Set<QtiDiagnostic>();
  for (const item of parsed.items) {
    const errors = item.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    for (const error of errors) itemErrors.add(error);
    if (!item.document || errors.length) rejectedItems.push(item);
    else items.push(item);
  }
  // Core includes the item diagnostic objects in the aggregate list. Only those
  // errors are recoverable here; ZIP, manifest, reference, and asset errors block import.
  const hasPackageErrors = parsed.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error" && !itemErrors.has(diagnostic),
  );
  if (hasPackageErrors || !items.length) {
    return {
      kind: "blocked",
      diagnostics: parsed.diagnostics.length
        ? parsed.diagnostics
        : [
            {
              code: "library.items.empty",
              severity: "error",
              message: "No valid questions found.",
            },
          ],
    };
  }
  return { kind: "ready", package: parsed, items, rejectedItems };
}
