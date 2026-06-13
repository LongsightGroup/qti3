import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import { interactionRegistryDiagnostics, interactionRegistryStatus } from "./support.js";

describe("interaction registry helpers", () => {
  it("reports supported status for registered current interactions", () => {
    expect(interactionRegistryStatus("qti-choice-interaction")).toBe("supported");
    expect(
      interactionRegistryDiagnostics("qti-choice-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "choice",
      }),
    ).toEqual([]);
  });

  it("reports deprecated status and diagnostics for deprecated interactions", () => {
    expect(interactionRegistryStatus("qti-custom-interaction")).toBe("deprecated");
    expect(
      interactionRegistryDiagnostics("qti-custom-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "custom",
      }),
    ).toEqual([
      expect.objectContaining({
        code: "interaction.deprecated",
        severity: "warning",
      }),
    ]);
  });

  it("reports unsupported status and diagnostics for unknown interactions", () => {
    expect(interactionRegistryStatus("qti-unsupported-interaction")).toBe("unsupported");
    expect(
      interactionRegistryDiagnostics("qti-unsupported-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "unsupported",
      }),
    ).toEqual([
      expect.objectContaining({
        code: "interaction.unsupported",
        severity: "warning",
      }),
    ]);
  });

  it("derives fixture QTI names from the canonical interaction registry", () => {
    expect(testInteraction({ type: "extendedText" })).toMatchObject({
      qtiName: "qti-extended-text-interaction",
      registryStatus: "supported",
    });
    expect(testInteraction({ type: "portableCustom" })).toMatchObject({
      qtiName: "qti-portable-custom-interaction",
      registryStatus: "supported",
    });
  });
});
