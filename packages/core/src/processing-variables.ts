import { parseNumericOperatorAttribute } from "./operator-attribute.js";
import type {
  QtiBaseType,
  QtiAssessmentItem,
  QtiDocument,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import { builtInVariableBaseType } from "./session-builtins.js";
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
  if (identifier === "completionStatus") return outcomes.completionStatus ?? "not_attempted";
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
  document: QtiDocument,
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
  document: QtiDocument,
): QtiBaseType | undefined {
  const [first, ...rest] = expressions;
  if (!first) return undefined;
  const baseType = expressionBaseType(first, document);
  if (!baseType) return undefined;
  return rest.every((expression) => expressionBaseType(expression, document) === baseType)
    ? baseType
    : undefined;
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

/** Reference lookup keeps original declarations; builtins participate only in name checks. */
export function processingVariables(item: QtiAssessmentItem) {
  const names = new Set([
    ...item.responseDeclarations.map((entry) => entry.identifier),
    ...item.outcomeDeclarations.map((entry) => entry.identifier),
    ...item.templateDeclarations.map((entry) => entry.identifier),
    "completionStatus",
    "numAttempts",
    "QTI_CONTEXT",
    ...(item.timeDependent ? ["duration"] : []),
  ]);
  const declarations = new Map(
    [...item.outcomeDeclarations, ...item.templateDeclarations].map((entry) => [
      entry.identifier,
      entry,
    ]),
  );
  return {
    has: (identifier: string) => names.has(identifier),
    numericAttribute(raw: string | number, baseType: "integer" | "number"): boolean {
      const attribute = parseNumericOperatorAttribute(String(raw));
      if (attribute.type === "invalid") return false;
      if (attribute.type === "literal") {
        return baseType === "number" || /^[+-]?\d+$/.test(String(raw).trim());
      }
      const declaration = declarations.get(attribute.identifier);
      return (
        declaration?.cardinality === "single" &&
        (declaration.baseType === "integer" ||
          (baseType === "number" && declaration.baseType === "float"))
      );
    },
  };
}
export type ProcessingVariables = ReturnType<typeof processingVariables>;
