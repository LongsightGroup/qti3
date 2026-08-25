import type { QtiDiagnostic } from "@longsightgroup/qti3-core";

/** Remove repeated diagnostics while preserving their first-seen order. */
export function uniqueDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\n${diagnostic.severity}\n${diagnostic.message}\n${diagnostic.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
