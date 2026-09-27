import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import {
  generalizedGcd,
  generalizedLcm,
  mathOperatorValue,
  roundWithMode,
  statsOperatorValue,
} from "./processing-operators.js";

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
      if (expression.expressions.length === 0) return null;
      const values = context.numericOperands(expression.expressions, "either");
      return values ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    case "product": {
      if (expression.expressions.length === 0) return null;
      const values = context.numericOperands(expression.expressions, "either");
      return values ? values.reduce((product, value) => product * value, 1) : null;
    }
    case "min":
    case "max": {
      const values = context.numericOperands(expression.expressions, "either");
      if (!values || values.length === 0) return null;
      return expression.type === "min" ? Math.min(...values) : Math.max(...values);
    }
    case "subtract": {
      const values = context.numericOperands([expression.left, expression.right]);
      return values && values.length === 2 ? values[0]! - values[1]! : null;
    }
    case "divide": {
      const values = context.numericOperands([expression.left, expression.right]);
      if (!values || values[1] === 0) return null;
      const quotient = values[0]! / values[1]!;
      return Number.isFinite(quotient) ? quotient : null;
    }
    case "power": {
      const values = context.numericOperands([expression.left, expression.right]);
      if (!values || values.length !== 2) return null;
      const value = Math.pow(values[0]!, values[1]!);
      return Number.isFinite(value) ? value : null;
    }
    case "integerDivide":
    case "integerModulus": {
      const values = context.numericOperands(
        [expression.left, expression.right],
        "single",
        "integer",
      );
      if (!values || values[1] === 0) return null;
      const dividend = values[0]!;
      const divisor = values[1]!;
      const quotient = Math.floor(dividend / divisor);
      return expression.type === "integerDivide" ? quotient : dividend - quotient * divisor;
    }
    case "round": {
      const value = context.numericOperands([expression.expression])?.[0] ?? null;
      return value === null ? null : Math.round(value);
    }
    case "roundTo": {
      const value = context.numericOperands([expression.expression])?.[0] ?? null;
      const figures = context.indexValue(expression.figures);
      if (
        value === null ||
        figures === undefined ||
        (expression.roundingMode === "decimalPlaces" ? figures < 0 : figures <= 0)
      )
        return null;
      return roundWithMode(value, expression.roundingMode, figures);
    }
    case "truncate": {
      const value = context.numericOperands([expression.expression])?.[0] ?? null;
      return value === null ? null : Math.trunc(value);
    }
    case "integerToFloat":
      return context.numericOperands([expression.expression], "single", "integer")?.[0] ?? null;
    case "gcd":
    case "lcm": {
      const integers = context.numericOperands(expression.expressions, "either", "integer");
      if (!integers || integers.length === 0) return null;
      return expression.type === "gcd" ? generalizedGcd(integers) : generalizedLcm(integers);
    }
    case "mathConstant":
      if (expression.name === "pi") return Math.PI;
      if (expression.name === "e") return Math.E;
      return null;
    case "mathOperator": {
      const values = context.numericOperands(expression.expressions);
      return values?.length ? mathOperatorValue(expression.name, values) : null;
    }
    case "statsOperator": {
      const expressions = expression.expressions ?? [expression.expression];
      if (expressions.length !== 1) return null;
      const values = context.numericOperands(expressions, "container");
      return values ? statsOperatorValue(expression.name, values) : null;
    }
    default:
      return assertNever(expression);
  }
}
