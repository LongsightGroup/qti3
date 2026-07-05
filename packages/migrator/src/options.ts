import type { QtiMigrationOptions, ResolvedQtiMigrationOptions } from "./types.js";

export function resolveOptions(options: QtiMigrationOptions = {}): ResolvedQtiMigrationOptions {
  return {
    repairPolicy: options.repairPolicy ?? "none",
    unsupportedPolicy: options.unsupportedPolicy ?? "diagnostic",
  };
}
