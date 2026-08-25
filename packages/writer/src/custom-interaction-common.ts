import { writerDiagnostic } from "./diagnostics.js";
import type { Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute } from "./xml.js";

const BASE_TYPES = new Set([
  "identifier",
  "boolean",
  "integer",
  "float",
  "string",
  "point",
  "pair",
  "directedPair",
  "duration",
  "file",
  "uri",
]);
const CARDINALITIES = new Set(["single", "multiple", "ordered", "record"]);
const ATTR_NAME_RE = /^[A-Za-z_][A-Za-z0-9:._-]*$/;

export function validateCustomFamilyResponseDeclaration(
  input: {
    readonly responseBaseType?: string | undefined;
    readonly responseCardinality?: string | undefined;
    readonly codePrefix: string;
    readonly label: string;
  },
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.responseBaseType !== undefined && !BASE_TYPES.has(input.responseBaseType)) {
    diagnostics.push(
      writerDiagnostic(
        `invalid_${input.codePrefix}_response_base_type`,
        "responseBaseType",
        `${input.label} response base-type must be a QTI base type.`,
        input.responseBaseType,
      ),
    );
  }
  if (input.responseCardinality !== undefined && !CARDINALITIES.has(input.responseCardinality)) {
    diagnostics.push(
      writerDiagnostic(
        `invalid_${input.codePrefix}_response_cardinality`,
        "responseCardinality",
        `${input.label} response cardinality must be single, multiple, ordered, or record.`,
        input.responseCardinality,
      ),
    );
  }
}

export function validateXmlAttributeName(
  name: string,
  path: string,
  code: string,
  label: string,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (ATTR_NAME_RE.test(name)) return;
  diagnostics.push(
    writerDiagnostic(code, path, `${label} "${name}" is not a valid XML attribute name.`, name),
  );
}

export function classAttribute(classNames: readonly string[]): string {
  const tokens = uniqueTrimmed(classNames);
  return tokens.length ? `class="${escapeXmlAttribute(tokens.join(" "))}"` : "";
}

export function uniqueTrimmed(values: readonly string[]): string[] {
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
