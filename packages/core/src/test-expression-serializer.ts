import { assertNever } from "./assert-never.js";
import { renderElement, type XmlAttribute } from "./serializer-processing-xml.js";
import { testExpressionSyntax, type QtiTestExpression } from "./test-expression.js";
import { testFailure, type QtiTestResult } from "./test-model.js";
import { escapeXmlText } from "./xml.js";

/** Serialize the closed test expression language without involving item processing. */
export function serializeTestExpression(expression: QtiTestExpression): QtiTestResult<string> {
  const result = serializeExpression(expression, 0);
  return result.ok ? { ok: true, value: result.value.join("\n") } : result;
}

function serializeExpression(
  expression: QtiTestExpression,
  indent: number,
): QtiTestResult<readonly string[]> {
  const syntax = testExpressionSyntax.find(
    (entry) =>
      entry.type === expression.type &&
      (expression.type !== "numericCompare" ||
        (entry.type === "numericCompare" && entry.operator === expression.operator)),
  );
  if (!syntax)
    return testFailure(
      "expression.unsupported",
      "Cannot serialize an unsupported test expression.",
    );
  const attributes: XmlAttribute[] = [];
  let children: readonly QtiTestExpression[] = [];
  switch (expression.type) {
    case "baseValue":
      return {
        ok: true,
        value: renderElement(
          syntax.name,
          [["base-type", expression.baseType]],
          escapeXmlText(String(expression.value)),
          indent,
        ),
      };
    case "variable":
      attributes.push(["identifier", expression.identifier]);
      break;
    case "testVariables":
      attributes.push(
        ["variable-identifier", expression.variableIdentifier],
        ["include-category", expression.includeCategory],
      );
      break;
    case "sum":
    case "and":
    case "or":
      children = expression.expressions;
      break;
    case "numericCompare":
      children = [expression.left, expression.right];
      break;
    case "not":
      children = [expression.expression];
      break;
    default:
      return assertNever(expression);
  }
  const content: string[] = [];
  for (const child of children) {
    const result = serializeExpression(child, indent + 1);
    if (!result.ok) return result;
    content.push(...result.value);
  }
  return { ok: true, value: renderElement(syntax.name, attributes, content, indent) };
}
