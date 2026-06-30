import type { QtiBaseType, QtiCardinality, QtiValue, QtiVariableDeclaration } from "./types.js";

export interface QtiVariableSnapshot {
  identifier: string;
  value: QtiValue;
  cardinality: QtiCardinality;
  baseType?: QtiBaseType | undefined;
}

export function snapshotQtiVariableDeclarations(
  declarations: readonly QtiVariableDeclaration[],
  values: Record<string, QtiValue>,
): QtiVariableSnapshot[] {
  return declarations.map((declaration) => ({
    identifier: declaration.identifier,
    value: values[declaration.identifier] ?? null,
    cardinality: declaration.cardinality,
    baseType: declaration.baseType,
  }));
}
