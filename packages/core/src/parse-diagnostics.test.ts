import { describe, expect, it } from "vitest";
import { isConformanceParseDiagnostic } from "./parse-diagnostics.js";

describe("conformance parse diagnostics", () => {
  it("classifies parse-time companion material diagnostics", () => {
    expect(isConformanceParseDiagnostic("companionMaterials.physicalMaterial.empty")).toBe(true);
    expect(
      isConformanceParseDiagnostic("companionMaterials.digitalMaterial.fileHref.missing"),
    ).toBe(true);
    expect(
      isConformanceParseDiagnostic("companionMaterials.digitalMaterial.fileHref.duplicate"),
    ).toBe(true);
    expect(
      isConformanceParseDiagnostic("companionMaterials.digitalMaterial.resourceIcon.duplicate"),
    ).toBe(true);
  });

  it("classifies parse-time custom interaction diagnostics", () => {
    expect(isConformanceParseDiagnostic("interaction.custom.markupInteraction")).toBe(true);
    expect(isConformanceParseDiagnostic("interaction.portableCustom.markupInteraction")).toBe(true);
    expect(isConformanceParseDiagnostic("interaction.portableCustom.child.duplicate")).toBe(true);
  });

  it("does not classify validation-time companion material diagnostics as parse phase", () => {
    expect(isConformanceParseDiagnostic("companionMaterials.physicalMaterial.empty.model")).toBe(
      false,
    );
    expect(
      isConformanceParseDiagnostic("companionMaterials.digitalMaterial.fileHref.empty.model"),
    ).toBe(false);
    expect(isConformanceParseDiagnostic("companionMaterials.model.inconsistent")).toBe(false);
  });
});
