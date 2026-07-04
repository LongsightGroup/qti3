import { isQtiIdentifier } from "./identifier.js";
import type { Qti3AuthoringItemBase, Qti3WriterDiagnostic, Qti3WriterResult } from "./types.js";
import { Qti3WriterError } from "./types.js";

export function writerDiagnostic(
  code: string,
  path: string,
  message: string,
  value?: unknown,
): Qti3WriterDiagnostic {
  return value === undefined ? { code, path, message } : { code, path, message, value };
}

export function invalidIdentifierDiagnostic(
  path: string,
  label: string,
  value: string,
): Qti3WriterDiagnostic {
  return writerDiagnostic(
    "invalid_identifier",
    path,
    `${label} must be a valid QTI identifier.`,
    value,
  );
}

export function validateQtiIdentifier(
  path: string,
  label: string,
  value: string,
): Qti3WriterDiagnostic | undefined {
  if (isQtiIdentifier(value)) return undefined;
  return invalidIdentifierDiagnostic(path, label, value);
}

export function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function validateItemBase(input: Qti3AuthoringItemBase): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const identifierDiagnostic = validateQtiIdentifier(
    "identifier",
    "Assessment item identifier",
    input.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (!input.title.trim()) {
    diagnostics.push(
      writerDiagnostic("missing_title", "title", "Assessment item title is required."),
    );
  }
  if (input.lang !== undefined && !input.lang.trim()) {
    diagnostics.push(
      writerDiagnostic("missing_lang", "lang", "Language must not be empty when provided."),
    );
  }
  return diagnostics;
}

export function duplicateDiagnostics(
  values: readonly string[],
  path: string,
  label: string,
): Qti3WriterDiagnostic[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) duplicateValues.add(trimmed);
    else seen.add(trimmed);
  }
  return Array.from(duplicateValues).map((value) =>
    writerDiagnostic("duplicate_identifier", path, `${label} "${value}" must be unique.`, value),
  );
}

export function dedupeNonemptyTrimmed(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function throwIfDiagnostics(diagnostics: readonly Qti3WriterDiagnostic[]): void {
  if (diagnostics.length) throw new Qti3WriterError(diagnostics);
}

export function writerResult(
  xml: string,
  diagnostics: readonly Qti3WriterDiagnostic[],
): Qti3WriterResult {
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, xml, diagnostics: [] };
}
