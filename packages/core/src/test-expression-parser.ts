import { assertNever } from "./assert-never.js";
import { coerceValue } from "./parser-values.js";
import { isTestBaseType, testExpressionSyntax, type QtiTestExpression } from "./test-expression.js";
import { checkTestXml, rejectTestXml } from "./test-xml.js";
import type { QtiDiagnostic } from "./types.js";
import { textContent, type XmlNode } from "./xml.js";

/** Read the single expression owned by a branch or outcome assignment. */
export function parseTestExpressionChild(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiTestExpression | undefined {
  const first = node.children[0];
  if (node.children.length !== 1 || !first) {
    rejectTestXml(node, diagnostics);
    return undefined;
  }
  return parseTestExpression(first, diagnostics);
}

function parseTestExpression(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiTestExpression | undefined {
  const syntax = testExpressionSyntax.find((entry) => entry.name === node.localName);
  if (!syntax) {
    rejectTestXml(node, diagnostics);
    return undefined;
  }
  checkTestXml(
    node,
    testExpressionSyntax.map((entry) => entry.name),
    syntax.attributes,
    diagnostics,
    syntax.type === "baseValue",
  );
  const arityValid =
    syntax.arity === "oneOrMore" ? node.children.length > 0 : node.children.length === syntax.arity;
  if (!arityValid) {
    rejectTestXml(node, diagnostics);
    return undefined;
  }
  const expressions: QtiTestExpression[] = [];
  for (const child of node.children) {
    const parsed = parseTestExpression(child, diagnostics);
    if (!parsed) return undefined;
    expressions.push(parsed);
  }
  const source = node.source;
  switch (syntax.type) {
    case "baseValue": {
      const baseType = node.attributes["base-type"];
      if (!isTestBaseType(baseType)) {
        rejectTestXml(node, diagnostics);
        return undefined;
      }
      return {
        type: "baseValue",
        baseType,
        value: coerceValue(textContent(node), baseType),
        source,
      };
    }
    case "variable":
      return { type: "variable", identifier: node.attributes.identifier ?? "", source };
    case "testVariables":
      return {
        type: "testVariables",
        variableIdentifier: node.attributes["variable-identifier"] ?? "",
        includeCategory: node.attributes["include-category"],
        source,
      };
    case "sum":
    case "and":
    case "or":
      return { type: syntax.type, expressions, source };
    case "numericCompare": {
      const [left, right] = expressions;
      if (!left || !right) return undefined;
      return { type: "numericCompare", operator: syntax.operator, left, right, source };
    }
    case "not": {
      const expression = expressions[0];
      return expression ? { type: "not", expression, source } : undefined;
    }
    default:
      return assertNever(syntax);
  }
}
