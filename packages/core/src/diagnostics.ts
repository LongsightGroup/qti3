import type { QtiDiagnostic } from "./types.js";

/**
 * Return a new array containing the first diagnostic for each diagnosticKey, in input order.
 * Source locations do not distinguish duplicates; the first object's metadata is retained.
 * The input array and diagnostic objects are not modified or cloned.
 */
export function uniqueDiagnostics(diagnostics: readonly QtiDiagnostic[]): QtiDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Identify a diagnostic by code, severity, message, and path, excluding source location.
 * Absent and empty paths are equivalent. Treat the returned string as an opaque key.
 */
export function diagnosticKey(diagnostic: QtiDiagnostic): string {
  return JSON.stringify([
    diagnostic.code,
    diagnostic.severity,
    diagnostic.message,
    diagnostic.path ?? "",
  ]);
}
