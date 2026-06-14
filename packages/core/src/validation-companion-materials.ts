import type { QtiAssessmentItem, QtiDiagnostic } from "./types.js";
import { PARSED_COMPANION_MATERIAL_CHILD_NAMES } from "./companion-materials.js";

export function validateCompanionMaterials(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  const companionMaterials = item.companionMaterials;
  if (!companionMaterials) return;

  for (const child of companionMaterials.unparsedChildren) {
    if (!PARSED_COMPANION_MATERIAL_CHILD_NAMES.has(child.qtiName)) continue;

    diagnostics.push({
      code: "companionMaterials.model.inconsistent",
      severity: "error",
      message: `${child.qtiName} must be represented in the parsed companion materials model, not as an unparsed child.`,
      path: child.source?.path,
      source: child.source,
    });
  }

  for (const material of companionMaterials.physicalMaterials) {
    if (material.text.trim().length === 0) {
      diagnostics.push({
        code: "companionMaterials.physicalMaterial.empty.model",
        severity: "error",
        message:
          "qti-physical-material requires non-empty text content in the parsed companion materials model.",
        path: material.source?.path,
        source: material.source,
      });
    }
  }

  for (const material of companionMaterials.digitalMaterials) {
    if (material.fileHref.trim().length === 0) {
      diagnostics.push({
        code: "companionMaterials.digitalMaterial.fileHref.empty.model",
        severity: "error",
        message:
          "qti-digital-material requires non-empty qti-file-href text content in the parsed companion materials model.",
        path: material.source?.path,
        source: material.source,
      });
    }
  }
}
