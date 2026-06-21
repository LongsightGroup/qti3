import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { mapOrMatchResponse, scoreAreaMapping } from "./processing-mapping.js";
import { isNullResponse, qtiMatchValues } from "./processing-values.js";
import {
  defaultValueForIdentifier,
  getResponseDeclaration,
  resolveVariableValue,
} from "./processing-variables.js";

type VariableExpression = Extract<
  QtiProcessingExpression,
  {
    type:
      | "isNull"
      | "matchCorrect"
      | "mapResponse"
      | "mapResponsePoint"
      | "correct"
      | "default"
      | "variable";
  }
>;

export function evaluateVariableExpression(
  expression: VariableExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "isNull":
      return isNullResponse(context.responses[expression.identifier] ?? null);
    case "matchCorrect": {
      const declaration = getResponseDeclaration(context.document, expression.correctIdentifier);
      return declaration
        ? qtiMatchValues(
            context.responses[expression.identifier] ?? null,
            context.correctResponses[expression.correctIdentifier] ?? null,
            declaration.cardinality === "ordered",
          )
        : false;
    }
    case "mapResponse": {
      const declaration = getResponseDeclaration(context.document, expression.identifier);
      return declaration
        ? mapOrMatchResponse(
            declaration,
            context.responses[expression.identifier] ?? null,
            context.correctResponses[expression.identifier] ?? null,
          )
        : 0;
    }
    case "mapResponsePoint": {
      const declaration = getResponseDeclaration(context.document, expression.identifier);
      return declaration?.areaMapping
        ? scoreAreaMapping(
            context.responses[expression.identifier] ?? null,
            declaration.areaMapping,
          )
        : 0;
    }
    case "correct":
      return context.correctResponses[expression.identifier] ?? null;
    case "default":
      return defaultValueForIdentifier(context.document, expression.identifier);
    case "variable":
      return (
        resolveVariableValue(
          context.document,
          expression.identifier,
          context.responses,
          context.outcomes,
          context.templateValues,
        ) ??
        context.undeclaredResponseValue(expression.identifier) ??
        null
      );
    default:
      return assertNever(expression);
  }
}
