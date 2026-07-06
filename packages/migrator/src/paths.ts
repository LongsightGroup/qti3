import { normalizePackagePath, type QtiDiagnostic } from "@longsightgroup/qti3-core";

import { diagnostic } from "./diagnostics.js";
import type { QtiMigrationDiagnostic } from "./types.js";

/** Normalize a host resource path and map core package-path diagnostics into migrator codes. */
export function normalizeMigrationResourcePath(
  path: string,
  context: string,
  diagnostics: QtiMigrationDiagnostic[],
): string | undefined {
  const coreDiagnostics: QtiDiagnostic[] = [];
  const normalized = normalizePackagePath(path.replaceAll("\\", "/"), context, coreDiagnostics);
  diagnostics.push(
    ...coreDiagnostics.map((entry) =>
      diagnostic(
        `resource_${entry.code}`,
        entry.severity === "error" ? "error" : "warning",
        entry.message,
        {
          path: entry.path,
        },
      ),
    ),
  );
  if (normalized === "") {
    diagnostics.push(
      diagnostic("resource_path_empty", "error", `${context} must not be empty.`, { path }),
    );
    return undefined;
  }
  return normalized;
}
