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
import {
  inferProcessingExpressionType,
  type ProcessingExpressionType,
} from "./processing-expression-type.js";

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
  const declaration = resolveVariableDeclaration(document.item, identifier);
  if (!declaration) return undefined;
  if (declaration.kind === "response") return responses[identifier] ?? null;
  if (declaration.kind === "outcome") return outcomes[identifier] ?? null;
  return templateValues[identifier] ?? null;
}

export function defaultValueForIdentifier(document: QtiDocument, identifier: string): QtiValue {
  return resolveVariableDeclaration(document.item, identifier)?.defaultValue ?? null;
}

export function expressionIsOrdered(
  expression: QtiProcessingExpression,
  document: QtiDocument,
): boolean {
  return (
    inferProcessingExpressionType(expression, (identifier) =>
      processingVariableType(document.item, identifier),
    )?.cardinality === "ordered"
  );
}

/** Resolve an expression's statically known atomic type using the declaration contract. */
export function expressionBaseType(
  expression: QtiProcessingExpression,
  document: QtiDocument,
): QtiBaseType | undefined {
  return inferProcessingExpressionType(expression, (identifier) =>
    processingVariableType(document.item, identifier),
  )?.baseType;
}

/** Read a variable type from its declaration or the built-in contract. */
export function processingVariableType(
  item: QtiAssessmentItem,
  identifier: string,
): ProcessingExpressionType | undefined {
  if (identifier === "QTI_CONTEXT") return { cardinality: "record" };
  const baseType = builtInVariableBaseType(identifier);
  return baseType
    ? { baseType, cardinality: "single" }
    : resolveVariableDeclaration(item, identifier);
}

function resolveVariableDeclaration(
  item: QtiAssessmentItem,
  identifier: string,
): QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration | undefined {
  return (
    item.responseDeclarations.find((declaration) => declaration.identifier === identifier) ??
    item.outcomeDeclarations.find((declaration) => declaration.identifier === identifier) ??
    item.templateDeclarations.find((declaration) => declaration.identifier === identifier)
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
    typeOf: (expression: QtiProcessingExpression) =>
      inferProcessingExpressionType(expression, (identifier) =>
        processingVariableType(item, identifier),
      ),
    outcomeDeclaration: (identifier: string) =>
      item.outcomeDeclarations.find((entry) => entry.identifier === identifier),
    declarationType: (identifier: string) => processingVariableType(item, identifier),
    numericAttribute(raw: string | undefined, baseType: "integer" | "number"): boolean {
      const attribute = parseNumericOperatorAttribute(raw);
      if (attribute.type === "invalid") return false;
      if (attribute.type === "literal") {
        return baseType === "number" || /^[+-]?\d+$/.test((raw ?? "").trim());
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
