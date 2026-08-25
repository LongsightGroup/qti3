import { describe, expect, it } from "vitest";
import { applyRepairPolicy, blockMigrationOnRepair, repairDiagnostics } from "./repair-policy.js";
import type { QtiMigrationDiagnostic, ResolvedQtiMigrationOptions } from "./types.js";

describe("migrator repair policy", () => {
  it("leaves valid input and existing unsupported-feature diagnostics unchanged", () => {
    const existing = unsupportedDiagnostic();
    const diagnostics = [existing];
    const result = applyRepairPolicy({
      needed: false,
      context: context({ repairPolicy: "none", unsupportedPolicy: "diagnostic" }, diagnostics),
      code: "missing_value",
      message: "Value is required.",
      repairMessage: "Value was repaired.",
    });

    expect(result).toEqual({ action: "ok" });
    expect(diagnostics).toEqual([existing]);
    expect(repairDiagnostics(result)).toEqual([]);
  });

  it("blocks strict migration with source-formatted location metadata", () => {
    const migration: { blocked?: readonly QtiMigrationDiagnostic[] } = {};
    const result = applyRepairPolicy({
      needed: true,
      context: context({ repairPolicy: "none", unsupportedPolicy: "diagnostic" }, []),
      code: "missing_value",
      message: "Value is required.",
      repairMessage: "Value was repaired.",
    });

    expect(result).toEqual({
      action: "blocked",
      diagnostics: [
        {
          code: "missing_value",
          severity: "error",
          message: "Value is required.",
          path: "items/item.xml",
          sourceFormat: "qti22",
        },
      ],
    });
    expect(blockMigrationOnRepair(migration, result)).toBe(true);
    expect(migration.blocked).toEqual(result.action === "blocked" ? result.diagnostics : []);
    expect(repairDiagnostics(result)).toEqual([]);
  });

  it("assembles safe-repair diagnostics without discarding unsupported findings", () => {
    const existing = unsupportedDiagnostic();
    const diagnostics = [existing];
    const result = applyRepairPolicy({
      needed: true,
      context: context({ repairPolicy: "safe", unsupportedPolicy: "stub" }, diagnostics),
      code: "missing_value",
      message: "Value is required.",
      repairMessage: "Value was repaired.",
    });

    expect(result).toEqual({
      action: "repaired",
      diagnostics: [
        expect.objectContaining({
          code: "missing_value_repaired",
          severity: "warning",
          path: "items/item.xml",
          sourceFormat: "qti22",
        }),
      ],
    });
    expect(diagnostics).toEqual([
      existing,
      ...(result.action === "repaired" ? result.diagnostics : []),
    ]);
    expect(repairDiagnostics(result)).toEqual(
      result.action === "repaired" ? result.diagnostics : [],
    );
    expect(blockMigrationOnRepair({}, result)).toBe(false);
  });
});

function context(options: ResolvedQtiMigrationOptions, diagnostics: QtiMigrationDiagnostic[]) {
  return { options, diagnostics, path: "items/item.xml", sourceFormat: "qti22" as const };
}

function unsupportedDiagnostic(): QtiMigrationDiagnostic {
  return {
    code: "unsupported_feature",
    severity: "warning",
    message: "Preserve this unsupported feature finding.",
    path: "items/item.xml",
    sourceFormat: "qti22",
  };
}
