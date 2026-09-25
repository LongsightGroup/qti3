import type { QtiDiagnostic } from "@longsightgroup/qti3-core";

/** Translate host and session boundary failures into player diagnostics. */
export function playerErrorDiagnostic(code: string, error: unknown): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message: error instanceof Error ? error.message : String(error),
  };
}
