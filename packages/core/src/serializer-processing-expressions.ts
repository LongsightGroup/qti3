import {
  durationCompareTags,
  identifierExpressionTags,
  leftRightExpressionTags,
  naryExpressionTags,
  numericCompareTags,
  unaryExpressionTags,
  type IdentifierExpressionType,
  type LeftRightExpressionType,
  type NaryExpressionType,
  type UnaryExpressionType,
} from "./processing-expression-tags.js";
import { escapeXmlText } from "./xml.js";
import { assertNever } from "./assert-never.js";
import {
  addSerializerDiagnostic,
  knownAttributesWithBagFallback,
  renderElement,
  sortedBagAttributes,
  type SerializationContext,
  type XmlAttribute,
} from "./serializer-processing-xml.js";
import type { QtiProcessingExpression, QtiSourceLocation, QtiValue } from "./types.js";
import { qtiValueToString } from "./value-format.js";

type IdentifierExpression = Extract<QtiProcessingExpression, { type: IdentifierExpressionType }>;
type UnaryExpression = Extract<QtiProcessingExpression, { type: UnaryExpressionType }>;
type NaryExpression = Extract<QtiProcessingExpression, { type: NaryExpressionType }>;
type LeftRightExpression = Extract<QtiProcessingExpression, { type: LeftRightExpressionType }>;

/**
 * Parser asymmetries that do not map 1:1 to a single expression type tag.
 * See `docs/plans/issue-12-response-processing-serialization-revised.md`.
 */
export function serializeExpression(
  expression: QtiProcessingExpression,
  context: SerializationContext,
  indent: number,
): string[] {
  if (isIdentifierExpression(expression)) {
    return identifierExpression(
      identifierExpressionTags[expression.type],
      expression.identifier,
      expression.source,
      context,
      indent,
    );
  }
  if (isNaryExpression(expression)) {
    return renderExpressionContainer(
      naryExpressionTags[expression.type],
      [],
      expression.expressions,
      context,
      indent,
    );
  }
  if (isUnaryExpression(expression)) {
    return renderExpressionContainer(
      unaryExpressionTags[expression.type],
      [],
      [expression.expression],
      context,
      indent,
    );
  }
  if (isLeftRightExpression(expression)) {
    return renderExpressionContainer(
      leftRightExpressionTags[expression.type],
      [],
      [expression.left, expression.right],
      context,
      indent,
    );
  }

  switch (expression.type) {
    case "baseValue":
      return serializeBaseValue(expression, context, indent);
    case "null":
      return renderElement("qti-null", [], [], indent);
    case "isNull":
      return serializeIsNull(expression, context, indent);
    case "matchCorrect":
      return serializeMatchCorrect(expression, context, indent);
    case "randomInteger":
      return renderElement(
        "qti-random-integer",
        knownAttributesWithBagFallback(expression.attributes, [
          { name: "min", fallback: finiteNumberFallback(expression.min) },
          { name: "max", fallback: finiteNumberFallback(expression.max) },
          { name: "step", fallback: finiteNumberFallback(expression.step) },
        ]),
        [],
        indent,
      );
    case "randomFloat":
      return renderElement(
        "qti-random-float",
        knownAttributesWithBagFallback(expression.attributes, [
          { name: "min", fallback: finiteNumberFallback(expression.min) },
          { name: "max", fallback: finiteNumberFallback(expression.max) },
        ]),
        [],
        indent,
      );
    case "random":
      return renderElement(
        "qti-random",
        [],
        expression.values.flatMap((value) => serializeExpression(value, context, indent + 1)),
        indent,
      );
    case "index":
      return renderExpressionContainer(
        "qti-index",
        [["n", expression.n]],
        [expression.expression],
        context,
        indent,
      );
    case "roundTo":
      return renderExpressionContainer(
        "qti-round-to",
        [
          ["rounding-mode", expression.roundingMode],
          ["figures", expression.figures],
        ],
        [expression.expression],
        context,
        indent,
      );
    case "anyN":
      return renderExpressionContainer(
        "qti-any-n",
        [
          ["min", expression.min],
          ["max", expression.max],
        ],
        expression.expressions,
        context,
        indent,
      );
    case "not":
      return renderExpressionContainer("qti-not", [], [expression.expression], context, indent);
    case "equalRounded":
      return renderExpressionContainer(
        "qti-equal-rounded",
        [
          ["rounding-mode", expression.roundingMode],
          ["figures", expression.figures],
        ],
        [expression.left, expression.right],
        context,
        indent,
      );
    case "numericCompare":
      return renderExpressionContainer(
        numericCompareTags[expression.operator],
        [],
        [expression.left, expression.right],
        context,
        indent,
      );
    case "durationCompare":
      return renderExpressionContainer(
        durationCompareTags[expression.operator],
        [],
        [expression.left, expression.right],
        context,
        indent,
      );
    case "stringMatch":
      return renderExpressionContainer(
        "qti-string-match",
        [
          ["case-sensitive", expression.caseSensitive],
          ["substring", expression.substring],
        ],
        [expression.left, expression.right],
        context,
        indent,
      );
    case "substring":
      return renderExpressionContainer(
        "qti-substring",
        [["case-sensitive", expression.caseSensitive]],
        [expression.left, expression.right],
        context,
        indent,
      );
    case "patternMatch":
      return renderExpressionContainer(
        "qti-pattern-match",
        [["pattern", expression.pattern]],
        [expression.expression],
        context,
        indent,
      );
    case "fieldValue":
      return renderExpressionContainer(
        "qti-field-value",
        [["field-identifier", expression.fieldIdentifier]],
        [expression.expression],
        context,
        indent,
      );
    case "member":
      return renderExpressionContainer(
        "qti-member",
        [],
        [expression.value, expression.collection],
        context,
        indent,
      );
    case "delete":
      return renderExpressionContainer(
        "qti-delete",
        [],
        [expression.value, expression.collection],
        context,
        indent,
      );
    case "contains":
      return renderExpressionContainer(
        "qti-contains",
        [],
        [expression.collection, expression.values],
        context,
        indent,
      );
    case "inside":
      return renderExpressionContainer(
        "qti-inside",
        knownAttributesWithBagFallback(expression.attributes, [
          { name: "shape", fallback: expression.shape },
          { name: "coords", fallback: expression.coords.join(",") },
        ]),
        [expression.expression],
        context,
        indent,
      );
    case "mathConstant":
      return renderElement("qti-math-constant", [["name", expression.name]], [], indent);
    case "mathOperator":
      return renderExpressionContainer(
        "qti-math-operator",
        [["name", expression.name]],
        expression.expressions,
        context,
        indent,
      );
    case "repeat":
      return renderExpressionContainer(
        "qti-repeat",
        [["number-repeats", expression.numberRepeats]],
        expression.expressions,
        context,
        indent,
      );
    case "statsOperator":
      return renderExpressionContainer(
        "qti-stats-operator",
        [["name", expression.name]],
        [expression.expression],
        context,
        indent,
      );
    case "customOperator":
      return renderExpressionContainer(
        "qti-custom-operator",
        customOperatorAttributes(expression),
        expression.expressions,
        context,
        indent,
      );
    default:
      return assertNever(expression);
  }
}

function isIdentifierExpression(
  expression: QtiProcessingExpression,
): expression is IdentifierExpression {
  return expression.type in identifierExpressionTags;
}

function isUnaryExpression(expression: QtiProcessingExpression): expression is UnaryExpression {
  return expression.type in unaryExpressionTags;
}

function isNaryExpression(expression: QtiProcessingExpression): expression is NaryExpression {
  return expression.type in naryExpressionTags;
}

function isLeftRightExpression(
  expression: QtiProcessingExpression,
): expression is LeftRightExpression {
  return expression.type in leftRightExpressionTags;
}

function serializeBaseValue(
  expression: Extract<QtiProcessingExpression, { type: "baseValue" }>,
  context: SerializationContext,
  indent: number,
): string[] {
  if (expression.baseType === undefined) {
    addSerializerDiagnostic(context, "responseProcessing.serialize.invalidAttribute", {
      message: "qti-base-value requires base-type.",
      source: expression.source,
    });
    return [];
  }

  const text = baseValueText(expression);
  if (text === undefined) {
    addSerializerDiagnostic(context, "responseProcessing.serialize.invalidExpression", {
      message: "qti-base-value can serialize only single scalar values.",
      source: expression.source,
    });
    return [];
  }

  return renderElement(
    "qti-base-value",
    [["base-type", expression.baseType]],
    escapeXmlText(text),
    indent,
  );
}

function baseValueText(
  expression: Extract<QtiProcessingExpression, { type: "baseValue" }>,
): string | undefined {
  if (expression.rawValue !== undefined) return expression.rawValue;
  if (!isSerializableBaseValue(expression.value)) return undefined;
  return qtiValueToString(expression.value);
}

function serializeIsNull(
  expression: Extract<QtiProcessingExpression, { type: "isNull" }>,
  context: SerializationContext,
  indent: number,
): string[] {
  if (!requireIdentifier(expression.identifier, "qti-is-null", expression.source, context)) {
    return [];
  }
  return renderElement(
    "qti-is-null",
    [],
    renderElement("qti-variable", [["identifier", expression.identifier]], [], indent + 1),
    indent,
  );
}

function serializeMatchCorrect(
  expression: Extract<QtiProcessingExpression, { type: "matchCorrect" }>,
  context: SerializationContext,
  indent: number,
): string[] {
  if (
    !requireIdentifier(expression.identifier, "qti-match", expression.source, context) ||
    !requireIdentifier(expression.correctIdentifier, "qti-match", expression.source, context)
  ) {
    return [];
  }
  return renderElement(
    "qti-match",
    [],
    [
      ...renderElement("qti-variable", [["identifier", expression.identifier]], [], indent + 1),
      ...renderElement(
        "qti-correct",
        [["identifier", expression.correctIdentifier]],
        [],
        indent + 1,
      ),
    ],
    indent,
  );
}

function customOperatorAttributes(
  expression: Extract<QtiProcessingExpression, { type: "customOperator" }>,
): XmlAttribute[] {
  const bag = { ...expression.attributes };
  if (expression.definition !== undefined && bag.definition === undefined) {
    bag.definition = expression.definition;
  }
  if (expression.className !== undefined && bag.class === undefined) {
    bag.class = expression.className;
  }
  return sortedBagAttributes(bag);
}

function identifierExpression(
  tagName: string,
  identifier: string,
  source: QtiSourceLocation | undefined,
  context: SerializationContext,
  indent: number,
): string[] {
  if (!requireIdentifier(identifier, tagName, source, context)) return [];
  return renderElement(tagName, [["identifier", identifier]], [], indent);
}

function renderExpressionContainer(
  tagName: string,
  attrs: readonly XmlAttribute[],
  expressions: readonly QtiProcessingExpression[],
  context: SerializationContext,
  indent: number,
): string[] {
  return renderElement(
    tagName,
    attrs,
    expressions.flatMap((child) => serializeExpression(child, context, indent + 1)),
    indent,
  );
}

function requireIdentifier(
  identifier: string,
  tagName: string,
  source: QtiSourceLocation | undefined,
  context: SerializationContext,
): boolean {
  if (identifier !== "") return true;
  addSerializerDiagnostic(context, "responseProcessing.serialize.invalidAttribute", {
    message: `${tagName} requires a non-empty identifier.`,
    source,
  });
  return false;
}

function finiteNumberFallback(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function isSerializableBaseValue(value: QtiValue): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}
