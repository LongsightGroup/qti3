/**
 * Diagnostic codes emitted while parsing QTI XML, before validation runs.
 * Conformance fixtures use this classifier to separate parse-time diagnostics
 * from validation diagnostics in `parseQtiXml` results.
 */
const CONFORMANCE_PARSE_DIAGNOSTIC_CODES = new Set([
  "xml.parse",
  "xml.empty",
  "qti.root",
  "processing.unsupported",
  "processing.response.forbidden",
  "interaction.unsupported",
  "interaction.deprecated",
  "interaction.custom.markupInteraction",
  "interaction.portableCustom.markupInteraction",
  "interaction.portableCustom.child.duplicate",
  "companionMaterials.child.unsupported",
  "companionMaterials.digitalMaterial.fileHref.duplicate",
  "companionMaterials.digitalMaterial.fileHref.missing",
  "companionMaterials.digitalMaterial.fileHref.empty",
  "companionMaterials.digitalMaterial.resourceIcon.duplicate",
  "companionMaterials.physicalMaterial.empty",
  "item.child.duplicate",
]);

export function isConformanceParseDiagnostic(code: string): boolean {
  return CONFORMANCE_PARSE_DIAGNOSTIC_CODES.has(code);
}
