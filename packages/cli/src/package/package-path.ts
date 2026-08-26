import { normalizePackagePath, type QtiDiagnostic } from "@longsightgroup/qti3-core";
import { PackageContentError } from "./package-content-error.js";

/** Parse and normalize an authored package-relative path for CLI package handling. */
export function parseCliPackagePath(path: string, context: string): string {
  const diagnostics: QtiDiagnostic[] = [];
  const normalized = normalizePackagePath(path, context, diagnostics);
  if (normalized !== undefined) return normalized;
  throw new PackageContentError(
    diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ??
      `${context} ${path} is not a valid package-relative path.`,
  );
}
