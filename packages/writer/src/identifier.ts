import { isQtiIdentifier } from "@longsightgroup/qti3-core";

export { isQtiIdentifier };

export function assertQtiIdentifier(identifier: string, label: string): string {
  const trimmed = identifier.trim();
  if (!isQtiIdentifier(trimmed)) {
    throw new Error(`${label} must be a valid QTI identifier.`);
  }
  return trimmed;
}
