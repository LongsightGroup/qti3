import type { QtiProcessingExpression, QtiValue } from "./types.js";

export interface QtiCustomOperatorContext {
  definition?: string | undefined;
  className?: string | undefined;
  attributes: Record<string, string>;
  values: QtiValue[];
  expression: Extract<QtiProcessingExpression, { type: "customOperator" }>;
}

export type QtiCustomOperatorHandler = (context: QtiCustomOperatorContext) => QtiValue;
export type QtiCustomOperatorRegistry = Record<string, QtiCustomOperatorHandler>;
