import type {
  QtiMigrationDiagnostic,
  QtiMigrationDiagnosticSeverity,
  QtiMigrationSourceFormat,
} from "./types.js";

export function diagnostic(
  code: string,
  severity: QtiMigrationDiagnosticSeverity,
  message: string,
  options: {
    readonly path?: string | undefined;
    readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  } = {},
): QtiMigrationDiagnostic {
  return { code, severity, message, ...options };
}

export function hasErrors(diagnostics: readonly QtiMigrationDiagnostic[]): boolean {
  return diagnostics.some((entry) => entry.severity === "error");
}
