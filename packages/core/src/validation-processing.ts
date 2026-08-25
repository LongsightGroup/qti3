import type {
  QtiAssessmentItem,
  QtiDiagnostic,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseRule,
  QtiSetOutcomeValue,
  QtiTemplateRule,
} from "./types.js";
import { expressionChildren } from "./processing-expression-children.js";
import { MAX_QTI_REPEAT_RESULT_ELEMENTS } from "./processing-limits.js";
import { MATH_OPERATOR_NAMES, STATS_OPERATOR_NAMES } from "./processing-operators.js";
import {
  responseProcessingTemplateKind,
  type ResponseProcessingTemplateKind,
} from "./processing-templates.js";
import {
  isBaseType,
  isBooleanAttribute,
  isFiniteNumber,
  isInteger,
} from "./validation-primitives.js";
import { COMPLETION_STATUS } from "./attempt-state-constants.js";

export function validateResponseProcessingTemplate(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  const template = item.responseProcessing?.template;
  if (!template) return;
  const templateKind = responseProcessingTemplateKind(template);
  if (templateKind) {
    validateBuiltInResponseProcessingTemplate(item, templateKind, diagnostics);
    return;
  }
  diagnostics.push({
    code: "processing.template.unsupported",
    severity: "error",
    message: `qti-response-processing template ${template} is not currently supported.`,
    path: item.source?.path,
    source: item.source,
  });
}

function validateBuiltInResponseProcessingTemplate(
  item: QtiAssessmentItem,
  templateKind: ResponseProcessingTemplateKind,
  diagnostics: QtiDiagnostic[],
): void {
  const response = item.responseDeclarations.find(
    (declaration) => declaration.identifier === "RESPONSE",
  );
  const score = item.outcomeDeclarations.find((declaration) => declaration.identifier === "SCORE");
  if (!response) {
    diagnostics.push({
      code: "processing.template.responseIdentifier",
      severity: "error",
      message:
        "Built-in response-processing templates require a response declaration named RESPONSE.",
      path: item.source?.path,
      source: item.source,
    });
  }
  if (!score) {
    diagnostics.push({
      code: "processing.template.scoreIdentifier",
      severity: "error",
      message: "Built-in response-processing templates require an outcome declaration named SCORE.",
      path: item.source?.path,
      source: item.source,
    });
  } else if (score.cardinality !== "single" || score.baseType !== "float") {
    diagnostics.push({
      code: "processing.template.scoreDeclaration",
      severity: "error",
      message:
        "Built-in response-processing templates require SCORE to be single cardinality with base-type float.",
      path: score.source?.path,
      source: score.source,
    });
  }
  const responseInteractions = item.interactions.filter(
    (interaction) => interaction.responseIdentifier === "RESPONSE",
  );
  if (responseInteractions.length !== 1 || item.interactions.length !== 1) {
    diagnostics.push({
      code: "processing.template.singleInteraction",
      severity: "error",
      message:
        "Built-in response-processing templates require a single interaction bound to RESPONSE.",
      path: item.source?.path,
      source: item.source,
    });
  }
  if (templateKind === "mapResponse" && response && !response.mapping) {
    diagnostics.push({
      code: "processing.template.mapping",
      severity: "error",
      message: "The map_response template requires RESPONSE to define qti-mapping.",
      path: response.source?.path,
      source: response.source,
    });
  }
  if (templateKind === "mapResponsePoint" && response && !response.areaMapping) {
    diagnostics.push({
      code: "processing.template.areaMapping",
      severity: "error",
      message: "The map_response_point template requires RESPONSE to define qti-area-mapping.",
      path: response.source?.path,
      source: response.source,
    });
  }
}

export function validateProcessingReferences(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  const responses = new Set(item.responseDeclarations.map((declaration) => declaration.identifier));
  const outcomes = new Set(item.outcomeDeclarations.map((declaration) => declaration.identifier));
  outcomes.add(COMPLETION_STATUS);
  const templates = new Set(item.templateDeclarations.map((declaration) => declaration.identifier));
  const variables = new Set([...responses, ...outcomes, ...templates]);

  for (const rule of item.templateProcessing?.rules ?? []) {
    validateTemplateRule(rule, responses, outcomes, templates, variables, diagnostics);
  }

  for (const rule of item.responseProcessing?.rules ?? []) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
}

function validateResponseCondition(
  condition: QtiResponseCondition,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateExpressionReferences(condition.ifExpression, responses, variables, diagnostics);
  for (const rule of condition.thenRules) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
  for (const branch of condition.elseIfs) {
    validateExpressionReferences(branch.expression, responses, variables, diagnostics);
    for (const rule of branch.rules) {
      validateResponseRule(rule, outcomes, responses, variables, diagnostics);
    }
  }
  for (const rule of condition.elseRules) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
}

function validateTemplateRule(
  rule: QtiTemplateRule,
  responses: Set<string>,
  outcomes: Set<string>,
  templates: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (rule.type === "exitTemplate") return;
  if (rule.type === "templateConstraint") {
    validateExpressionReferences(rule.expression, responses, variables, diagnostics);
    return;
  }

  if (rule.type === "templateCondition") {
    validateExpressionReferences(rule.ifExpression, responses, variables, diagnostics);
    for (const branchRule of rule.thenRules) {
      validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
    }
    for (const branch of rule.elseIfs) {
      validateExpressionReferences(branch.expression, responses, variables, diagnostics);
      for (const branchRule of branch.rules) {
        validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
      }
    }
    for (const branchRule of rule.elseRules) {
      validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
    }
    return;
  }

  if (rule.type === "setTemplateValue") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.templateTarget",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !templates.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.templateTarget.reference",
        severity: "error",
        message: `qti-set-template-value references missing template declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  if (rule.type === "setDefaultValue") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.defaultTarget",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !responses.has(rule.identifier) && !outcomes.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.defaultTarget.reference",
        severity: "error",
        message: `qti-set-default-value references missing response or outcome declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  if (rule.type === "setCorrectResponse") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.correctResponse",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !responses.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.correctResponse.reference",
        severity: "error",
        message: `qti-set-correct-response references missing response declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateResponseRule(
  rule: QtiResponseRule,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (rule.type === "exitResponse") return;
  if (rule.type === "responseCondition") {
    validateResponseCondition(rule.condition, outcomes, responses, variables, diagnostics);
    return;
  }
  if (rule.type === "responseProcessingFragment") {
    for (const childRule of rule.rules) {
      validateResponseRule(childRule, outcomes, responses, variables, diagnostics);
    }
    return;
  }
  if (rule.type === "lookupOutcomeValue") {
    validateLookupOutcomeRule(rule, outcomes, responses, variables, diagnostics);
    return;
  }
  validateSetOutcomeRule(rule, outcomes, responses, variables, diagnostics);
}

function validateLookupOutcomeRule(
  rule: Extract<QtiResponseRule, { type: "lookupOutcomeValue" }>,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateProcessingIdentifier(
    rule.identifier,
    "processing.lookupOutcomeTarget",
    rule.source,
    diagnostics,
  );
  if (rule.identifier && !outcomes.has(rule.identifier)) {
    diagnostics.push({
      code: "processing.lookupOutcomeTarget.reference",
      severity: "error",
      message: `qti-lookup-outcome-value references missing outcome declaration ${rule.identifier}.`,
      path: rule.source?.path,
      source: rule.source,
    });
  }
  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateSetOutcomeRule(
  rule: QtiSetOutcomeValue,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateProcessingIdentifier(
    rule.identifier,
    "processing.outcomeTarget",
    rule.source,
    diagnostics,
  );
  if (rule.identifier && !outcomes.has(rule.identifier)) {
    diagnostics.push({
      code: "processing.outcomeTarget.reference",
      severity: "error",
      message: `qti-set-outcome-value references missing outcome declaration ${rule.identifier}.`,
      path: rule.source?.path,
      source: rule.source,
    });
  }
  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateExpressionReferences(
  expression: QtiProcessingExpression | undefined,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!expression) return;

  if (expression.type === "variable" || expression.type === "isNull") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.variable",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !variables.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.variable.reference",
        severity: "error",
        message: `Processing expression references missing variable ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "matchCorrect") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.response",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.response.reference",
        severity: "error",
        message: `Processing expression references missing response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
    validateProcessingIdentifier(
      expression.correctIdentifier,
      "processing.correct",
      expression.source,
      diagnostics,
    );
    if (expression.correctIdentifier && !responses.has(expression.correctIdentifier)) {
      diagnostics.push({
        code: "processing.correct.reference",
        severity: "error",
        message: `Processing expression references missing correct response declaration ${expression.correctIdentifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "mapResponse" || expression.type === "mapResponsePoint") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.response",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.response.reference",
        severity: "error",
        message: `Processing expression references missing response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "correct") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.correct",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.correct.reference",
        severity: "error",
        message: `Processing expression references missing correct response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "default") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.variable",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !variables.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.variable.reference",
        severity: "error",
        message: `Processing expression references missing variable ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "randomInteger") {
    validateRandomIntegerExpression(expression, diagnostics);
  }

  if (expression.type === "randomFloat") {
    validateRandomFloatExpression(expression, diagnostics);
  }

  if (expression.type === "baseValue") {
    validateBaseValueExpression(expression, diagnostics);
  }

  if (expression.type === "equalRounded") {
    validateRounding(
      "qti-equal-rounded",
      expression.roundingMode,
      expression.figures,
      diagnostics,
      expression.source,
    );
  }

  if (expression.type === "mathConstant" && !mathConstantNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.mathConstant.name",
      severity: "error",
      message: `qti-math-constant has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "mathOperator" && !mathOperatorNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.mathOperator.name",
      severity: "error",
      message: `qti-math-operator has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "statsOperator" && !statsOperatorNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.statsOperator.name",
      severity: "error",
      message: `qti-stats-operator has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (
    (expression.type === "sum" ||
      expression.type === "product" ||
      expression.type === "min" ||
      expression.type === "max") &&
    expression.expressions.length === 0
  ) {
    diagnostics.push({
      code: "processing.numeric.arity",
      severity: "error",
      message: `qti-${expression.type} requires at least one child expression.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (
    expression.type === "statsOperator" &&
    (expression.expressions ?? [expression.expression]).length !== 1
  ) {
    diagnostics.push({
      code: "processing.statsOperator.arity",
      severity: "error",
      message: "qti-stats-operator requires exactly one child expression.",
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "repeat") {
    validateRepeatExpression(expression, variables, diagnostics);
  }

  if (expression.type === "inside") {
    validateInsideExpression(expression, diagnostics);
  }

  if (expression.type === "fieldValue") {
    validateProcessingIdentifier(
      expression.fieldIdentifier,
      "processing.fieldValue.fieldIdentifier",
      expression.source,
      diagnostics,
    );
  }

  for (const child of expressionChildren(expression)) {
    validateExpressionReferences(child, responses, variables, diagnostics);
  }
}

const mathConstantNames = new Set(["pi", "e"]);
const mathOperatorNames = new Set<string>(MATH_OPERATOR_NAMES);
const statsOperatorNames = new Set<string>(STATS_OPERATOR_NAMES);

function validateRounding(
  qtiName: string,
  roundingMode: string,
  figures: number,
  diagnostics: QtiDiagnostic[],
  source: QtiDiagnostic["source"],
): void {
  if (roundingMode !== "decimalPlaces" && roundingMode !== "significantFigures") {
    diagnostics.push({
      code: "processing.roundingMode",
      severity: "error",
      message: `${qtiName} requires rounding-mode decimalPlaces or significantFigures.`,
      path: source?.path,
      source,
    });
  }
  const validFigures =
    Number.isInteger(figures) && (roundingMode === "decimalPlaces" ? figures >= 0 : figures > 0);
  if (!validFigures) {
    diagnostics.push({
      code: "processing.roundingFigures",
      severity: "error",
      message: `${qtiName} requires valid figures for its rounding mode.`,
      path: source?.path,
      source,
    });
  }
}

function validateRepeatExpression(
  expression: Extract<QtiProcessingExpression, { type: "repeat" }>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (isInteger(expression.numberRepeats)) {
    const repeats = BigInt(expression.numberRepeats);
    if (repeats < 0n) {
      diagnostics.push(repeatCountDiagnostic(expression));
      return;
    }
    const minimumPerRepeat = minimumProducedElements(expression.expressions);
    if (
      repeats > BigInt(MAX_QTI_REPEAT_RESULT_ELEMENTS) ||
      repeats * BigInt(minimumPerRepeat) > BigInt(MAX_QTI_REPEAT_RESULT_ELEMENTS)
    ) {
      diagnostics.push({
        code: "processing.repeat.limit",
        severity: "error",
        message: `qti-repeat cannot exceed ${MAX_QTI_REPEAT_RESULT_ELEMENTS} iterations or produced elements.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
    return;
  }
  if (Number.isFinite(Number(expression.numberRepeats))) {
    diagnostics.push(repeatCountDiagnostic(expression));
    return;
  }
  validateProcessingIdentifier(
    expression.numberRepeats,
    "processing.repeat.numberRepeats",
    expression.source,
    diagnostics,
  );
  if (expression.numberRepeats && !variables.has(expression.numberRepeats)) {
    diagnostics.push({
      code: "processing.repeat.numberRepeats.reference",
      severity: "error",
      message: `qti-repeat references missing template or outcome variable ${expression.numberRepeats}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function repeatCountDiagnostic(
  expression: Extract<QtiProcessingExpression, { type: "repeat" }>,
): QtiDiagnostic {
  return {
    code: "processing.repeat.numberRepeats",
    severity: "error",
    message: "qti-repeat requires a non-negative integer or a declared variable.",
    path: expression.source?.path,
    source: expression.source,
  };
}

function minimumProducedElements(expressions: QtiProcessingExpression[]): number {
  let total = 0;
  for (const expression of expressions) {
    total = cappedElementCount(total + minimumExpressionElements(expression));
  }
  return total;
}

function minimumExpressionElements(expression: QtiProcessingExpression): number {
  if (expression.type === "baseValue") return 1;
  if (expression.type === "multiple" || expression.type === "ordered") {
    return minimumProducedElements(expression.expressions);
  }
  if (expression.type === "random") {
    if (expression.values.length === 0) return 0;
    let minimum = MAX_QTI_REPEAT_RESULT_ELEMENTS + 1;
    for (const value of expression.values) {
      minimum = Math.min(minimum, minimumExpressionElements(value));
    }
    return minimum;
  }
  if (expression.type !== "repeat" || !/^\d+$/.test(expression.numberRepeats)) return 0;
  const perRepeat = minimumProducedElements(expression.expressions);
  const projected = BigInt(expression.numberRepeats) * BigInt(perRepeat);
  return projected > BigInt(MAX_QTI_REPEAT_RESULT_ELEMENTS)
    ? MAX_QTI_REPEAT_RESULT_ELEMENTS + 1
    : Number(projected);
}

function cappedElementCount(value: number): number {
  return Math.min(value, MAX_QTI_REPEAT_RESULT_ELEMENTS + 1);
}

function validateInsideExpression(
  expression: Extract<QtiProcessingExpression, { type: "inside" }>,
  diagnostics: QtiDiagnostic[],
): void {
  const rawShape = expression.attributes.shape;
  if (rawShape === undefined) {
    diagnostics.push({
      code: "processing.inside.shape.required",
      severity: "error",
      message: "qti-inside requires shape.",
      path: expression.source?.path,
      source: expression.source,
    });
  } else if (
    rawShape !== "circle" &&
    rawShape !== "rect" &&
    rawShape !== "poly" &&
    rawShape !== "default"
  ) {
    diagnostics.push({
      code: "processing.inside.shape",
      severity: "error",
      message: `qti-inside has unsupported shape ${rawShape}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  const expectedCoordCount =
    rawShape === "circle" ? 3 : rawShape === "rect" ? 4 : rawShape === "default" ? 0 : undefined;
  if (expectedCoordCount !== undefined && expression.coords.length !== expectedCoordCount) {
    diagnostics.push({
      code: "processing.inside.coords",
      severity: "error",
      message: `qti-inside shape ${rawShape} requires ${expectedCoordCount} coordinates.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
  if (rawShape === "poly" && (expression.coords.length < 6 || expression.coords.length % 2 !== 0)) {
    diagnostics.push({
      code: "processing.inside.coords",
      severity: "error",
      message: "qti-inside poly requires an even number of at least 6 coordinates.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateBaseValueExpression(
  expression: Extract<QtiProcessingExpression, { type: "baseValue" }>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!expression.baseType) {
    diagnostics.push({
      code: "processing.baseValue.baseType.required",
      severity: "error",
      message: "qti-base-value requires base-type.",
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (!isBaseType(expression.baseType)) {
    diagnostics.push({
      code: "processing.baseValue.baseType",
      severity: "error",
      message: `qti-base-value has unsupported base-type ${expression.baseType}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  const value = expression.rawValue ?? "";
  if (
    (expression.baseType === "integer" && !isInteger(value)) ||
    (expression.baseType === "float" && !isFiniteNumber(value))
  ) {
    diagnostics.push({
      code: "processing.baseValue.numeric",
      severity: "error",
      message: `qti-base-value requires ${expression.baseType} content, got ${value}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
  if (expression.baseType === "boolean" && !isBooleanAttribute(value)) {
    diagnostics.push({
      code: "processing.baseValue.boolean",
      severity: "error",
      message: `qti-base-value requires boolean content, got ${value}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomIntegerExpression(
  expression: Extract<QtiProcessingExpression, { type: "randomInteger" }>,
  diagnostics: QtiDiagnostic[],
): void {
  validateRandomIntegerAttribute(expression, "min", diagnostics);
  validateRandomIntegerAttribute(expression, "max", diagnostics);

  if (expression.attributes.step !== undefined) {
    validateRandomIntegerAttribute(expression, "step", diagnostics);
    if (isInteger(expression.attributes.step) && Number(expression.attributes.step) <= 0) {
      diagnostics.push({
        code: "processing.randomInteger.step",
        severity: "error",
        message: "qti-random-integer requires step to be greater than 0.",
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  const min = expression.attributes.min;
  const max = expression.attributes.max;
  if (
    min !== undefined &&
    max !== undefined &&
    isInteger(min) &&
    isInteger(max) &&
    Number(min) > Number(max)
  ) {
    diagnostics.push({
      code: "processing.randomInteger.bounds",
      severity: "error",
      message: "qti-random-integer requires min to be less than or equal to max.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomIntegerAttribute(
  expression: Extract<QtiProcessingExpression, { type: "randomInteger" }>,
  attribute: "min" | "max" | "step",
  diagnostics: QtiDiagnostic[],
): void {
  const value = expression.attributes[attribute];
  if (value === undefined) {
    diagnostics.push({
      code: "processing.randomInteger.attribute",
      severity: "error",
      message: `qti-random-integer requires ${attribute}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (isInteger(value)) return;
  diagnostics.push({
    code: "processing.randomInteger.integer",
    severity: "error",
    message: `qti-random-integer requires integer ${attribute}, got ${value}.`,
    path: expression.source?.path,
    source: expression.source,
  });
}

function validateRandomFloatExpression(
  expression: Extract<QtiProcessingExpression, { type: "randomFloat" }>,
  diagnostics: QtiDiagnostic[],
): void {
  validateRandomFloatAttribute(expression, "max", diagnostics);
  if (expression.attributes.min !== undefined)
    validateRandomFloatAttribute(expression, "min", diagnostics);

  const min = expression.attributes.min ?? "0";
  const max = expression.attributes.max;
  if (
    max !== undefined &&
    isFiniteNumber(min) &&
    isFiniteNumber(max) &&
    Number(min) > Number(max)
  ) {
    diagnostics.push({
      code: "processing.randomFloat.bounds",
      severity: "error",
      message: "qti-random-float requires min to be less than or equal to max.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomFloatAttribute(
  expression: Extract<QtiProcessingExpression, { type: "randomFloat" }>,
  attribute: "min" | "max",
  diagnostics: QtiDiagnostic[],
): void {
  const value = expression.attributes[attribute];
  if (value === undefined) {
    diagnostics.push({
      code: "processing.randomFloat.attribute",
      severity: "error",
      message: `qti-random-float requires ${attribute}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (isFiniteNumber(value)) return;
  diagnostics.push({
    code: "processing.randomFloat.numeric",
    severity: "error",
    message: `qti-random-float requires numeric ${attribute}, got ${value}.`,
    path: expression.source?.path,
    source: expression.source,
  });
}

function validateProcessingIdentifier(
  identifier: string,
  code: string,
  source: QtiDiagnostic["source"],
  diagnostics: QtiDiagnostic[],
): void {
  if (identifier.trim().length > 0) return;
  diagnostics.push({
    code,
    severity: "error",
    message: "Processing rule requires a non-empty identifier.",
    path: source?.path,
    source,
  });
}
