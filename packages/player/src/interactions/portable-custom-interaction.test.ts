import { describe, expect, it } from "vitest";
import { portableCustomValidityDiagnostic } from "./portable-custom-interaction.js";

describe("portable-custom-interaction", () => {
  it("builds validity diagnostics for invalid PCI responses", () => {
    expect(portableCustomValidityDiagnostic("RESPONSE", true, "ignored")).toBeUndefined();
    expect(portableCustomValidityDiagnostic("RESPONSE", false, "Invalid")?.code).toBe(
      "response.portableCustom.validity",
    );
    expect(portableCustomValidityDiagnostic("RESPONSE", false, undefined)?.message).toBe(
      "RESPONSE is not valid.",
    );
  });
});
