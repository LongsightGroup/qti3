import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import type { QtiBasicImportItemOnlyCertificationReport } from "./basic-import-items.js";
import { certificationDiagnostic } from "./certification-package.js";

/** Check saved evidence against a fresh full run on the exact candidate and reviewed inputs. */
export function checkQti3BasicImportReport(
  saved: unknown,
  current: QtiBasicImportItemOnlyCertificationReport,
): { readonly ok: boolean; readonly diagnostics: readonly QtiDiagnostic[] } {
  const diagnostics: QtiDiagnostic[] = [];
  if (!current.automatedEvidenceReady)
    diagnostics.push(
      certificationDiagnostic(
        "certification.report.currentNotReady",
        "The fresh run needs complete passing evidence, pinned unchanged inputs, and a clean identifiable candidate build.",
      ),
    );
  if (!record(saved) || saved.schemaVersion !== 1)
    return {
      ok: false,
      diagnostics: [
        ...diagnostics,
        certificationDiagnostic(
          "certification.report.format",
          "Expected a version 1 import evidence report.",
        ),
      ],
    };
  for (const field of [
    "targetCapability",
    "targetLevel",
    "targetScope",
    "runScope",
    "coverage",
    "checked",
    "failed",
    "ok",
    "packages",
    "rows",
    "diagnostics",
    "validatorEvidence",
    "automatedEvidenceReady",
  ] as const) {
    if (canonical(saved[field]) !== canonical(current[field]))
      diagnostics.push(
        certificationDiagnostic(
          "certification.report.mismatch",
          `Saved evidence differs from the fresh run at ${field}.`,
        ),
      );
  }
  const identity = record(saved.identity) ? saved.identity : {};
  for (const field of ["source", "producer"] as const) {
    if (canonical(identity[field]) !== canonical(current.identity[field]))
      diagnostics.push(
        certificationDiagnostic(
          "certification.report.identityMismatch",
          `Saved ${field} identity does not match the fresh run.`,
        ),
      );
  }
  return { ok: diagnostics.length === 0, diagnostics };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function canonical(value: unknown, depth = 0): string {
  if (depth > 64) return "<excessive-depth>";
  if (typeof value === "number" && !Number.isFinite(value)) return "<non-json-number>";
  if (["bigint", "function", "symbol"].includes(typeof value)) return "<non-json-value>";
  if (Array.isArray(value))
    return `[${value.map((entry) => canonical(entry, depth + 1)).join(",")}]`;
  if (record(value))
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key], depth + 1)}`)
      .join(",")}}`;
  return value === undefined ? "undefined" : JSON.stringify(value);
}
