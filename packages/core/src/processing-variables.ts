import type {
  QtiBaseType,
  QtiDocument,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import { parseBaseType } from "./parser-values.js";

export function getResponseDeclaration(
  document: QtiDocument,
  identifier: string,
): QtiResponseDeclaration | undefined {
  return document.item.responseDeclarations.find(
    (declaration) => declaration.identifier === identifier,
  );
}

export function resolveVariableValue(
  document: QtiDocument,
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
  document: QtiDocument,
  identifier: string,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
): QtiValue | undefined {
  const declaration = resolveVariableDeclaration(document, identifier);
  if (!declaration) return undefined;
  if (declaration.kind === "response") return responses[identifier] ?? null;
  if (declaration.kind === "outcome") return outcomes[identifier] ?? null;
  return templateValues[identifier] ?? null;
}

export function defaultValueForIdentifier(document: QtiDocument, identifier: string): QtiValue {
  return resolveVariableDeclaration(document, identifier)?.defaultValue ?? null;
}

export function expressionIsOrdered(
  expression: QtiProcessingExpression,
  document: QtiDocument,
): boolean {
  if (expression.type === "ordered") return true;
  if (
    (expression.type === "variable" ||
      expression.type === "correct" ||
      expression.type === "default" ||
      expression.type === "isNull") &&
    variableCardinality(document, expression.identifier) === "ordered"
  ) {
    return true;
  }
  return false;
}

/** Resolve the declared atomic base type for an expression when it is statically knowable. */
export function expressionBaseType(
  expression: QtiProcessingExpression,
  document: QtiDocument,
): QtiBaseType | undefined {
  if (expression.type === "baseValue") return parseBaseType(expression.baseType);
  if (
    expression.type === "variable" ||
    expression.type === "correct" ||
    expression.type === "default" ||
    expression.type === "isNull"
  ) {
    return resolveVariableDeclaration(document, expression.identifier)?.baseType;
  }
  return undefined;
}

function variableCardinality(document: QtiDocument, identifier: string): string | undefined {
  return resolveVariableDeclaration(document, identifier)?.cardinality;
}

function resolveVariableDeclaration(
  document: QtiDocument,
  identifier: string,
): QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration | undefined {
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
