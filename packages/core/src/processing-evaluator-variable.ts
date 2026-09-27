import { parseFiniteNumber } from "./parser-values.js";
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
        const image = context.document.item.interactions.find(
          (interaction) => interaction.responseIdentifier === expression.identifier,
        )?.object;
        const width = parseFiniteNumber(image?.width);
        const height = parseFiniteNumber(image?.height);
        const bounds =
          width !== undefined && width > 0 && height !== undefined && height > 0
            ? { width, height }
            : undefined;
        if (
          !isNullResponse(response) &&
          !bounds &&
          declaration.areaMapping.entries.some((entry) => entry.shape === "default")
        ) {
          context.diagnostics.push({
            code: "processing.areaMapping.imageBounds",
            severity: "error",
            message:
              "Default area mapping requires the associated image's positive width and height.",
            source: expression.source,
          });
          return null;
        }
        return scoreAreaMapping(response, declaration.areaMapping, bounds);
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
