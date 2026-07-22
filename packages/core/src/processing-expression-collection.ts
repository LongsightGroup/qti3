import { expressionChildren } from "./processing-expression-children.js";
import type {
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseProcessing,
  QtiResponseRule,
} from "./types.js";

/** Collect every processing expression in a parsed response-processing tree. */
export function collectQtiResponseProcessingExpressions(
  processing: QtiResponseProcessing | undefined,
): QtiProcessingExpression[] {
  if (!processing) return [];
  const expressions: QtiProcessingExpression[] = [];
  for (const expression of processing.expressions ?? []) collectExpression(expression, expressions);
  collectRules(processing.rules, expressions);
  for (const condition of processing.conditions) collectCondition(condition, expressions);
  return expressions;
}

function collectRules(
  rules: readonly QtiResponseRule[],
  expressions: QtiProcessingExpression[],
): void {
  for (const rule of rules) {
    if (rule.type === "setOutcomeValue" || rule.type === "lookupOutcomeValue") {
      collectExpression(rule.expression, expressions);
      continue;
    }
    if (rule.type === "responseCondition") {
      collectCondition(rule.condition, expressions);
      continue;
    }
    if (rule.type === "responseProcessingFragment") collectRules(rule.rules, expressions);
  }
}

function collectCondition(
  condition: QtiResponseCondition,
  expressions: QtiProcessingExpression[],
): void {
  if (condition.ifExpression) collectExpression(condition.ifExpression, expressions);
  collectRules(condition.thenRules, expressions);
  for (const branch of condition.elseIfs) {
    if (branch.expression) collectExpression(branch.expression, expressions);
    collectRules(branch.rules, expressions);
  }
  collectRules(condition.elseRules, expressions);
}

function collectExpression(
  expression: QtiProcessingExpression,
  expressions: QtiProcessingExpression[],
): void {
  expressions.push(expression);
  for (const child of expressionChildren(expression)) collectExpression(child, expressions);
}
