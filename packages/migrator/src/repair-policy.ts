import { diagnostic } from "./diagnostics.js";
import type {
  QtiMigrationDiagnostic,
  QtiMigrationSourceFormat,
  ResolvedQtiMigrationOptions,
} from "./types.js";

export interface RepairPolicyContext {
  readonly options: ResolvedQtiMigrationOptions;
  readonly path?: string | undefined;
  readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  readonly diagnostics?: QtiMigrationDiagnostic[] | undefined;
}

export type RepairPolicyResult =
  | { readonly action: "ok" }
  | { readonly action: "repaired"; readonly diagnostics: readonly QtiMigrationDiagnostic[] }
  | { readonly action: "blocked"; readonly diagnostics: readonly QtiMigrationDiagnostic[] };

export function applyRepairPolicy(input: {
  readonly needed: boolean;
  readonly context: RepairPolicyContext;
  readonly code: string;
  readonly message: string;
  readonly repairMessage: string;
}): RepairPolicyResult {
  if (!input.needed) return { action: "ok" };

  const location = {
    path: input.context.path,
    sourceFormat: input.context.sourceFormat,
  };

  if (input.context.options.repairPolicy === "safe") {
    const repaired = diagnostic(`${input.code}_repaired`, "warning", input.repairMessage, location);
    input.context.diagnostics?.push(repaired);
    return { action: "repaired", diagnostics: [repaired] };
  }

  return {
    action: "blocked",
    diagnostics: [diagnostic(input.code, "error", input.message, location)],
  };
}

export function repairDiagnostics(result: RepairPolicyResult): readonly QtiMigrationDiagnostic[] {
  return result.action === "repaired" ? result.diagnostics : [];
}

export function isRepairBlocked(result: RepairPolicyResult): result is {
  readonly action: "blocked";
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  return result.action === "blocked";
}

export function blockMigrationOnRepair(
  context: { blocked?: readonly QtiMigrationDiagnostic[] | undefined },
  result: RepairPolicyResult,
): boolean {
  if (!isRepairBlocked(result)) return false;
  context.blocked = result.diagnostics;
  return true;
}
