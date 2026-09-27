import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { scoreMapping, scoreAreaMapping } from "./processing-mapping.js";
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
      return isNullResponse(context.evaluate(expression.expression));
    case "matchCorrect": {
      const declaration = getResponseDeclaration(context.document, expression.correctIdentifier);
      return declaration
        ? qtiMatchValues(
            context.responses[expression.identifier] ?? null,
            context.correctResponses[expression.correctIdentifier] ?? null,
            declaration.cardinality === "ordered",
            declaration.baseType,
          )
        : false;
    }
    case "mapResponse":
    case "mapResponsePoint": {
      const declaration = getResponseDeclaration(context.document, expression.identifier);
      const response = context.responses[expression.identifier] ?? null;
      if (expression.type === "mapResponse" && declaration?.mapping) {
        return scoreMapping(response, declaration.mapping, declaration.baseType);
      }
      if (expression.type === "mapResponsePoint" && declaration?.areaMapping) {
        return scoreAreaMapping(response, declaration.areaMapping);
      }
      context.diagnostics.push({
        code: "processing.mapping.required",
        severity: "error",
        message: `${expression.type} requires its corresponding mapping on response ${expression.identifier}.`,
        source: expression.source,
      });
      return null;
    }
    case "correct":
      return context.correctResponses[expression.identifier] ?? null;
    case "default":
      return Object.hasOwn(context.defaultValues, expression.identifier)
        ? (context.defaultValues[expression.identifier] ?? null)
        : defaultValueForIdentifier(context.document, expression.identifier);
    case "variable": {
      const builtIn = context.builtInVariable(expression.identifier);
      if (builtIn !== undefined) return builtIn;
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
    }
    default:
      return assertNever(expression);
  }
}
