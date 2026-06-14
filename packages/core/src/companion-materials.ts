import type { QtiDiagnostic, QtiSourceLocation } from "./types.js";

export const PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES = [
  "qti-physical-material",
  "qti-digital-material",
] as const;

export type ParsedCompanionMaterialChildQtiName =
  (typeof PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES)[number];

export const PARSED_COMPANION_MATERIAL_CHILD_NAMES = new Set<string>(
  PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES,
);

export function pushCompanionMaterialParseWarning(
  diagnostics: QtiDiagnostic[],
  code: string,
  message: string,
  path: string | undefined,
  source: QtiSourceLocation | undefined,
): undefined {
  diagnostics.push({
    code,
    severity: "warning",
    message,
    path,
    source,
  });
  return undefined;
}
