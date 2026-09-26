import type { QtiDiagnostic, QtiProcessingExpression } from "./types.js";
import type { ProcessingVariables } from "./processing-variables.js";
import { parseNumericOperatorAttribute, randomOperatorAttributes } from "./operator-attribute.js";

type RandomExpression = Extract<QtiProcessingExpression, { type: "randomInteger" | "randomFloat" }>;

/** Validate shared numeric bindings, then the random operator's literal bounds. */
export function validateRandomExpression(
  expression: RandomExpression,
  variables: ProcessingVariables,
  diagnostics: QtiDiagnostic[],
): void {
  const integer = expression.type === "randomInteger";
  const report = (suffix: string, message: string) =>
    diagnostics.push({
      code: `processing.${expression.type}.${suffix}`,
      severity: "error",
      message,
      source: expression.source,
      path: expression.source?.path,
    } satisfies QtiDiagnostic);
  const resolved = randomOperatorAttributes(expression);
  const attributes: Array<[string, string | undefined]> = [
    ["min", resolved.min],
    ["max", resolved.max],
  ];
  if (integer) attributes.push(["step", resolved.step]);
  for (const [name, value] of attributes) {
    if (value === undefined) report("attribute", `${expression.type} requires ${name}.`);
    else if (!variables.numericAttribute(value, integer ? "integer" : "number"))
      report(
        integer ? "integer" : "numeric",
        `${expression.type} requires a numeric literal or declared reference for ${name}.`,
      );
  }
  const min = parseNumericOperatorAttribute(resolved.min);
  const max = parseNumericOperatorAttribute(resolved.max);
  if (min.type === "literal" && max.type === "literal" && min.value > max.value)
    report("bounds", `${expression.type} requires min to be less than or equal to max.`);
  if (integer) {
    const step = parseNumericOperatorAttribute(resolved.step);
    if (step.type === "literal" && step.value <= 0)
      report("step", "qti-random-integer requires step to be greater than 0.");
  }
}
