import { coerceValue, parseCoords, parseShape, parseXmlBoolean } from "./parser-values.js";
import { responseConditionsFromRules } from "./processing-rules.js";
import type {
  QtiLookupOutcomeValue,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseProcessing,
  QtiResponseRule,
  QtiSetOutcomeValue,
  QtiTemplateProcessing,
  QtiTemplateRule,
} from "./types.js";
import { childElements, textContent, type XmlNode } from "./xml.js";

export function parseResponseProcessing(
  node: XmlNode | undefined,
): QtiResponseProcessing | undefined {
  if (!node) return undefined;
  const rules = parseResponseRules(node);
  return {
    template: node.attributes.template,
    rules,
    conditions: responseConditionsFromRules(rules),
    expressions: node.children.flatMap((child) => {
      const expression = parseExpression(child);
      return expression ? [expression] : [];
    }),
  };
}

export function parseTemplateProcessing(
  node: XmlNode | undefined,
): QtiTemplateProcessing | undefined {
  if (!node) return undefined;
  return {
    rules: parseTemplateRules(node),
  };
}

function parseTemplateRules(node: XmlNode): QtiTemplateRule[] {
  return childElements(node)
    .map(parseTemplateRule)
    .filter((rule): rule is QtiTemplateRule => rule !== undefined);
}

function parseTemplateRule(node: XmlNode): QtiTemplateRule | undefined {
  if (node.localName === "qti-set-template-value") {
    return {
      type: "setTemplateValue",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-set-default-value") {
    return {
      type: "setDefaultValue",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-set-correct-response") {
    return {
      type: "setCorrectResponse",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-template-condition") {
    const templateIf = childElements(node, "qti-template-if")[0];
    const templateElse = childElements(node, "qti-template-else")[0];
    return {
      type: "templateCondition",
      ifExpression: templateIf ? parseFirstExpression(templateIf) : undefined,
      thenRules: templateIf ? parseTemplateRules(templateIf) : [],
      elseIfs: childElements(node, "qti-template-else-if").map((branch) => ({
        expression: parseFirstExpression(branch),
        rules: parseTemplateRules(branch),
      })),
      elseRules: templateElse ? parseTemplateRules(templateElse) : [],
      source: node.source,
    };
  }

  if (node.localName === "qti-exit-template") {
    return {
      type: "exitTemplate",
      source: node.source,
    };
  }

  if (node.localName === "qti-template-constraint") {
    return {
      type: "templateConstraint",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  return undefined;
}

function parseResponseCondition(node: XmlNode): QtiResponseCondition {
  const responseIf = childElements(node, "qti-response-if")[0];
  const responseElse = childElements(node, "qti-response-else")[0];
  return {
    ifExpression: responseIf ? parseFirstExpression(responseIf) : undefined,
    thenRules: responseIf ? parseResponseRules(responseIf) : [],
    elseIfs: childElements(node, "qti-response-else-if").map((branch) => ({
      expression: parseFirstExpression(branch),
      rules: parseResponseRules(branch),
    })),
    elseRules: responseElse ? parseResponseRules(responseElse) : [],
  };
}

function parseResponseRules(node: XmlNode): QtiResponseRule[] {
  return childElements(node)
    .map(parseResponseRule)
    .filter((rule): rule is QtiResponseRule => rule !== undefined);
}

function parseResponseRule(node: XmlNode): QtiResponseRule | undefined {
  if (node.localName === "qti-response-condition") {
    return {
      type: "responseCondition",
      condition: parseResponseCondition(node),
      source: node.source,
    };
  }
  if (node.localName === "qti-set-outcome-value") return parseSetOutcomeValue(node);
  if (node.localName === "qti-lookup-outcome-value") return parseLookupOutcomeValue(node);
  if (node.localName === "qti-exit-response") {
    return { type: "exitResponse", source: node.source };
  }
  if (node.localName === "qti-response-processing-fragment") {
    return {
      type: "responseProcessingFragment",
      rules: parseResponseRules(node),
      source: node.source,
    };
  }
  return undefined;
}

function parseLookupOutcomeValue(node: XmlNode): QtiLookupOutcomeValue {
  return {
    type: "lookupOutcomeValue",
    identifier: node.attributes.identifier ?? "",
    expression: parseFirstExpression(node) ?? {
      type: "baseValue",
      value: null,
      source: node.source,
    },
    source: node.source,
  };
}

function parseSetOutcomeValue(setNode: XmlNode): QtiSetOutcomeValue {
  return {
    type: "setOutcomeValue",
    identifier: setNode.attributes.identifier ?? "",
    expression: parseFirstExpression(setNode) ?? {
      type: "baseValue",
      value: null,
      source: setNode.source,
    },
    source: setNode.source,
  };
}

function parseFirstExpression(node: XmlNode): QtiProcessingExpression | undefined {
  for (const child of node.children) {
    const expression = parseExpression(child);
    if (expression) return expression;
  }
  return undefined;
}

function parseExpression(node: XmlNode): QtiProcessingExpression | undefined {
  if (node.localName === "qti-base-value") {
    const rawValue = textContent(node);
    return {
      type: "baseValue",
      value: coerceValue(rawValue, node.attributes["base-type"]),
      rawValue,
      baseType: node.attributes["base-type"],
      source: node.source,
    };
  }

  if (node.localName === "qti-null") {
    return { type: "null", source: node.source };
  }

  if (node.localName === "qti-is-null") {
    const variable = childElements(node, "qti-variable")[0];
    return {
      type: "isNull",
      identifier: variable?.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-map-response") {
    return {
      type: "mapResponse",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-map-response-point") {
    return {
      type: "mapResponsePoint",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-correct") {
    return {
      type: "correct",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-default") {
    return {
      type: "default",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-variable") {
    return { type: "variable", identifier: node.attributes.identifier ?? "", source: node.source };
  }

  if (node.localName === "qti-random-integer") {
    return {
      type: "randomInteger",
      min: Number(node.attributes.min ?? 0),
      max: Number(node.attributes.max ?? 0),
      step: Number(node.attributes.step ?? 1),
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-random-float") {
    return {
      type: "randomFloat",
      min: Number(node.attributes.min ?? 0),
      max: Number(node.attributes.max ?? 0),
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-random") {
    const multiple = childElements(node, "qti-multiple")[0];
    return {
      type: "random",
      values: childElements(multiple ?? node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-multiple") {
    return {
      type: "multiple",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-ordered") {
    return {
      type: "ordered",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-index") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return { type: "index", expression, n: node.attributes.n ?? "", source: node.source };
    }
  }

  if (node.localName === "qti-container-size") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "containerSize", expression, source: node.source };
  }

  if (node.localName === "qti-sum") {
    return {
      type: "sum",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-product") {
    return {
      type: "product",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-min") {
    return {
      type: "min",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-max") {
    return {
      type: "max",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-subtract") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "subtract", left, right, source: node.source };
  }

  if (node.localName === "qti-divide") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "divide", left, right, source: node.source };
  }

  if (node.localName === "qti-power") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "power", left, right, source: node.source };
  }

  if (node.localName === "qti-integer-divide") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "integerDivide", left, right, source: node.source };
  }

  if (node.localName === "qti-integer-modulus") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "integerModulus", left, right, source: node.source };
  }

  if (node.localName === "qti-round") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "round", expression, source: node.source };
  }

  if (node.localName === "qti-round-to") {
    const expression = parseFirstExpression(node);
    const roundingMode = node.attributes["rounding-mode"];
    const figures = Number(node.attributes.figures ?? 0);
    if (
      expression &&
      (roundingMode === "decimalPlaces" || roundingMode === "significantFigures") &&
      Number.isInteger(figures) &&
      (roundingMode === "decimalPlaces" ? figures >= 0 : figures > 0)
    ) {
      return { type: "roundTo", expression, roundingMode, figures, source: node.source };
    }
  }

  if (node.localName === "qti-truncate") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "truncate", expression, source: node.source };
  }

  if (node.localName === "qti-integer-to-float") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "integerToFloat", expression, source: node.source };
  }

  if (node.localName === "qti-and") {
    return {
      type: "and",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-any-n") {
    return {
      type: "anyN",
      min: node.attributes.min ?? "",
      max: node.attributes.max ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-or") {
    return {
      type: "or",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-not") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "not", expression, source: node.source };
  }

  if (node.localName === "qti-equal") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) return { type: "equal", left, right, source: node.source };
  }

  if (node.localName === "qti-equal-rounded") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const roundingMode = node.attributes["rounding-mode"] ?? "";
    const figures = Number(node.attributes.figures ?? 0);
    if (left && right) {
      return { type: "equalRounded", left, right, roundingMode, figures, source: node.source };
    }
  }

  const numericCompareOperator = numericCompareOperatorFor(node.localName);
  if (numericCompareOperator) {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "numericCompare",
        operator: numericCompareOperator,
        left,
        right,
        source: node.source,
      };
    }
  }

  const durationCompareOperator = durationCompareOperatorFor(node.localName);
  if (durationCompareOperator) {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "durationCompare",
        operator: durationCompareOperator,
        left,
        right,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-string-match") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "stringMatch",
        left,
        right,
        caseSensitive: parseXmlBoolean(node.attributes["case-sensitive"]) ?? true,
        substring: parseXmlBoolean(node.attributes.substring) === true,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-substring") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "substring",
        left,
        right,
        caseSensitive: parseXmlBoolean(node.attributes["case-sensitive"]) ?? true,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-pattern-match") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "patternMatch",
        expression,
        pattern: node.attributes.pattern ?? "",
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-field-value") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "fieldValue",
        fieldIdentifier: node.attributes["field-identifier"] ?? "",
        expression,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-member") {
    const [value, collection] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (value && collection) return { type: "member", value, collection, source: node.source };
  }

  if (node.localName === "qti-delete") {
    const [value, collection] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (value && collection) return { type: "delete", value, collection, source: node.source };
  }

  if (node.localName === "qti-contains") {
    const [collection, values] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (collection && values) return { type: "contains", collection, values, source: node.source };
  }

  if (node.localName === "qti-gcd" || node.localName === "qti-lcm") {
    return {
      type: node.localName === "qti-gcd" ? "gcd" : "lcm",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-inside") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "inside",
        expression,
        shape: parseShape(node.attributes.shape),
        coords: parseCoords(node.attributes.coords),
        attributes: node.attributes,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-math-constant") {
    return { type: "mathConstant", name: node.attributes.name ?? "", source: node.source };
  }

  if (node.localName === "qti-math-operator") {
    return {
      type: "mathOperator",
      name: node.attributes.name ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-repeat") {
    return {
      type: "repeat",
      numberRepeats: node.attributes["number-repeats"] ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-stats-operator") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "statsOperator",
        name: node.attributes.name ?? "",
        expression,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-custom-operator") {
    return {
      type: "customOperator",
      definition: node.attributes.definition,
      className: node.attributes.class,
      attributes: node.attributes,
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-match") {
    const variable = childElements(node, "qti-variable")[0];
    const correct = childElements(node, "qti-correct")[0];
    if (variable && correct) {
      return {
        type: "matchCorrect",
        identifier: variable.attributes.identifier ?? "",
        correctIdentifier: correct.attributes.identifier ?? "",
        source: node.source,
      };
    }
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) return { type: "match", left, right, source: node.source };
  }

  return undefined;
}

function numericCompareOperatorFor(localName: string): "lt" | "lte" | "gt" | "gte" | undefined {
  if (localName === "qti-lt") return "lt";
  if (localName === "qti-lte") return "lte";
  if (localName === "qti-gt") return "gt";
  if (localName === "qti-gte") return "gte";
  return undefined;
}

function durationCompareOperatorFor(localName: string): "lt" | "gte" | undefined {
  if (localName === "qti-duration-lt") return "lt";
  if (localName === "qti-duration-gte") return "gte";
  return undefined;
}
