import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import {
  generalizedGcd,
  generalizedLcm,
  mathOperatorValue,
  roundToDecimalPlaces,
  roundToSignificantFigures,
  statsOperatorValue,
} from "./processing-operators.js";
import {
  isRecordValue,
  numericValue,
  numericValueOrNull,
  valueContainer,
} from "./processing-values.js";

type NumericExpression = Extract<
  QtiProcessingExpression,
  {
    type:
      | "sum"
      | "product"
      | "min"
      | "max"
      | "subtract"
      | "divide"
      | "power"
      | "integerDivide"
      | "integerModulus"
      | "round"
      | "roundTo"
      | "truncate"
      | "integerToFloat"
      | "gcd"
      | "lcm"
      | "mathConstant"
      | "mathOperator"
      | "statsOperator";
  }
>;

export function evaluateNumericExpression(
  expression: NumericExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "sum": {
      const values = context.numericOperands(expression.expressions);
      return values ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    case "product": {
      const values = context.numericOperands(expression.expressions);
      return values ? values.reduce((product, value) => product * value, 1) : null;
    }
    case "min":
    case "max": {
      const values = context.numericOperands(expression.expressions);
      if (!values || values.length === 0) return null;
      return expression.type === "min" ? Math.min(...values) : Math.max(...values);
    }
    case "subtract": {
      const values = context.numericOperands([expression.left, expression.right]);
      return values && values.length === 2 ? values[0]! - values[1]! : null;
    }
    case "divide":
      return divide(context.evaluate(expression.left), context.evaluate(expression.right));
    case "power": {
      const values = context.numericOperands([expression.left, expression.right]);
      if (!values || values.length !== 2) return null;
      const value = Math.pow(values[0]!, values[1]!);
      return Number.isFinite(value) ? value : null;
    }
    case "integerDivide": {
      const values = integerOperands(
        context.evaluate(expression.left),
        context.evaluate(expression.right),
      );
      return values ? Math.floor(values.dividend / values.divisor) : null;
    }
    case "integerModulus": {
      const values = integerOperands(
        context.evaluate(expression.left),
        context.evaluate(expression.right),
      );
      return values
        ? values.dividend - Math.floor(values.dividend / values.divisor) * values.divisor
        : null;
    }
    case "round": {
      const value = numericValueOrNull(context.evaluate(expression.expression));
      return value === null ? null : Math.round(value);
    }
    case "roundTo": {
      const value = numericValueOrNull(context.evaluate(expression.expression));
      if (value === null) return null;
      return expression.roundingMode === "decimalPlaces"
        ? roundToDecimalPlaces(value, expression.figures)
        : roundToSignificantFigures(value, expression.figures);
    }
    case "truncate": {
      const value = numericValueOrNull(context.evaluate(expression.expression));
      return value === null ? null : Math.trunc(value);
    }
    case "integerToFloat":
      return numericValueOrNull(context.evaluate(expression.expression));
    case "gcd":
    case "lcm": {
      const values = expression.expressions.flatMap((item) => {
        const value = context.evaluate(item);
        return value === null ? [null] : valueContainer(value);
      });
      if (values.length === 0 || values.some((value) => value === null || isRecordValue(value))) {
        return null;
      }
      const integers = values.map((value) => Math.trunc(numericValue(value)));
      return expression.type === "gcd" ? generalizedGcd(integers) : generalizedLcm(integers);
    }
    case "mathConstant":
      if (expression.name === "pi") return Math.PI;
      if (expression.name === "e") return Math.E;
      return null;
    case "mathOperator": {
      const values = expression.expressions.map((item) => context.evaluate(item));
      if (values.length === 0 || values.some((value) => value === null)) return null;
      return mathOperatorValue(expression.name, values.map(numericValue));
    }
    case "statsOperator": {
      const value = context.evaluate(expression.expression);
      if (value === null) return null;
      return statsOperatorValue(expression.name, valueContainer(value).map(numericValue));
    }
    default:
      return assertNever(expression);
  }
}

function divide(dividendValue: QtiValue, divisorValue: QtiValue): QtiValue {
  const values = integerOperands(dividendValue, divisorValue);
  if (!values) return null;
  const quotient = values.dividend / values.divisor;
  return Number.isFinite(quotient) ? quotient : null;
}

function integerOperands(
  dividendValue: QtiValue,
  divisorValue: QtiValue,
): { dividend: number; divisor: number } | undefined {
  if (dividendValue === null || divisorValue === null) return undefined;
  const dividend = numericValueOrNull(dividendValue);
  const divisor = numericValueOrNull(divisorValue);
  if (dividend === null || divisor === null || divisor === 0) return undefined;
  return { dividend, divisor };
}
