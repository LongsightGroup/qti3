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

export class QtiMigrationBlocked extends Error {
  constructor(readonly diagnostics: readonly QtiMigrationDiagnostic[]) {
    super("QTI migration blocked by strict policy.");
  }
}

/** QTI 2.x path: record safe repairs and throw when strict policy blocks migration. */
export function repairOrThrow(input: {
  readonly needed: boolean;
  readonly context: RepairPolicyContext;
  readonly code: string;
  readonly message: string;
  readonly repairMessage: string;
}): void {
  const result = applyRepairPolicy(input);
  if (result.action === "blocked") {
    throw new QtiMigrationBlocked(result.diagnostics);
  }
}

/** QTI 1.2 path: return whether migration should stop and any emitted diagnostics. */
export function repairOrBlock(input: {
  readonly needed: boolean;
  readonly context: RepairPolicyContext;
  readonly code: string;
  readonly message: string;
  readonly repairMessage: string;
}): {
  readonly blocked: boolean;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const result = applyRepairPolicy(input);
  if (result.action === "blocked") {
    return { blocked: true, diagnostics: result.diagnostics };
  }
  return {
    blocked: false,
    diagnostics: result.action === "repaired" ? result.diagnostics : [],
  };
}
