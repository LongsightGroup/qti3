import type { QtiProcessingDocument } from "./processing-document.js";
import type {
  QtiBaseType,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import { builtInVariableBaseType } from "./session-builtins.js";
import { parseBaseType } from "./parser-values.js";

export function getResponseDeclaration(
  document: QtiProcessingDocument,
  identifier: string,
): QtiResponseDeclaration | undefined {
  if ("test" in document) return undefined;
  return document.item.responseDeclarations.find(
    (declaration) => declaration.identifier === identifier,
  );
}

export function resolveVariableValue(
  document: QtiProcessingDocument,
  identifier: string,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
): QtiValue {
  return (
    resolveOptionalVariableValue(document, identifier, responses, outcomes, templateValues) ?? null
  );
}

export function resolveOptionalVariableValue(
  document: QtiProcessingDocument,
  identifier: string,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
): QtiValue | undefined {
  if (identifier === "completionStatus") return outcomes.completionStatus ?? "not_attempted";
  const declaration = resolveVariableDeclaration(document, identifier);
  if (!declaration) return undefined;
  if (declaration.kind === "response") return responses[identifier] ?? null;
  if (declaration.kind === "outcome") return outcomes[identifier] ?? null;
  return templateValues[identifier] ?? null;
}

export function defaultValueForIdentifier(
  document: QtiProcessingDocument,
  identifier: string,
): QtiValue {
  return resolveVariableDeclaration(document, identifier)?.defaultValue ?? null;
}

export function expressionIsOrdered(
  expression: QtiProcessingExpression,
  document: QtiProcessingDocument,
): boolean {
  if (expression.type === "ordered" || expression.type === "repeat") return true;
  if (expression.type === "delete") return expressionIsOrdered(expression.collection, document);
  if (
    (expression.type === "variable" ||
      expression.type === "correct" ||
      expression.type === "default") &&
    variableCardinality(document, expression.identifier) === "ordered"
  ) {
    return true;
  }
  return false;
}

/** Resolve the declared atomic base type for an expression when it is statically knowable. */
export function expressionBaseType(
  expression: QtiProcessingExpression,
  document: QtiProcessingDocument,
): QtiBaseType | undefined {
  if (expression.type === "baseValue") return parseBaseType(expression.baseType);
  if (expression.type === "isNull") return "boolean";
  if (
    expression.type === "variable" ||
    expression.type === "correct" ||
    expression.type === "default"
  ) {
    return (
      builtInVariableBaseType(expression.identifier) ??
      resolveVariableDeclaration(document, expression.identifier)?.baseType
    );
  }
  if (expression.type === "index") return expressionBaseType(expression.expression, document);
  if (expression.type === "delete") return expressionBaseType(expression.collection, document);
  if (expression.type === "random") return expressionBaseType(expression.expression, document);
  if (
    expression.type === "multiple" ||
    expression.type === "ordered" ||
    expression.type === "repeat"
  ) {
    return commonExpressionBaseType(expression.expressions, document);
  }
  return undefined;
}

function commonExpressionBaseType(
  expressions: QtiProcessingExpression[],
  document: QtiProcessingDocument,
): QtiBaseType | undefined {
  const [first, ...rest] = expressions;
  if (!first) return undefined;
  const baseType = expressionBaseType(first, document);
  if (!baseType) return undefined;
  return rest.every((expression) => expressionBaseType(expression, document) === baseType)
    ? baseType
    : undefined;
}

function variableCardinality(
  document: QtiProcessingDocument,
  identifier: string,
): string | undefined {
  return resolveVariableDeclaration(document, identifier)?.cardinality;
}

function resolveVariableDeclaration(
  document: QtiProcessingDocument,
  identifier: string,
): QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration | undefined {
  if ("test" in document)
    return document.test.outcomeDeclarations.find((value) => value.identifier === identifier);
  return (
    document.item.responseDeclarations.find(
      (declaration) => declaration.identifier === identifier,
    ) ??
    document.item.outcomeDeclarations.find(
      (declaration) => declaration.identifier === identifier,
    ) ??
    document.item.templateDeclarations.find((declaration) => declaration.identifier === identifier)
  );
}
