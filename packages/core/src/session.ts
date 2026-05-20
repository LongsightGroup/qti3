import type {
  QtiAssessmentItem,
  QtiAttemptStatus,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiModalFeedback,
  QtiProcessingExpression,
  QtiRecordValue,
  QtiResponseDeclaration,
  QtiResponseRule,
  QtiScalarValue,
  QtiScoreResult,
  QtiTemplateRule,
  QtiValue,
} from "./types.js";

export interface QtiCustomOperatorContext {
  definition?: string | undefined;
  className?: string | undefined;
  attributes: Record<string, string>;
  values: QtiValue[];
  expression: Extract<QtiProcessingExpression, { type: "customOperator" }>;
}

export type QtiCustomOperatorHandler = (context: QtiCustomOperatorContext) => QtiValue;
export type QtiCustomOperatorRegistry = Record<string, QtiCustomOperatorHandler>;

const COMPLETION_STATUS = "completionStatus";
const COMPLETION_NOT_ATTEMPTED = "not_attempted";
const COMPLETION_UNKNOWN = "unknown";
const COMPLETION_COMPLETED = "completed";

export interface QtiItemSessionOptions {
  randomSeed?: string | number | undefined;
  customOperators?: QtiCustomOperatorRegistry | undefined;
}

export interface QtiItemSession {
  readonly item: QtiAssessmentItem;
  correctResponses(): Record<string, QtiValue>;
  respond(identifier: string, value: QtiValue): void;
  setStatus(status: QtiAttemptStatus): void;
  score(): QtiScoreResult;
  serialize(): QtiAttemptStateV1;
}

export function visibleModalFeedback(
  item: QtiAssessmentItem,
  outcomes: Record<string, QtiValue>,
): QtiModalFeedback[] {
  return item.modalFeedback.filter((feedback) => {
    if (feedback.showHide === "hide") return false;
    const outcome = outcomes[feedback.outcomeIdentifier];
    if (Array.isArray(outcome)) return outcome.includes(feedback.identifier);
    return String(outcome ?? "") === feedback.identifier;
  });
}

export function createItemSession(
  document: QtiDocument,
  priorState?: QtiAttemptStateV1,
  options: QtiItemSessionOptions = {},
): QtiItemSession {
  const responses: Record<string, QtiValue> = { ...priorState?.responses };
  const outcomes: Record<string, QtiValue> = {};
  const templateValues: Record<string, QtiValue> = {};
  const correctResponses: Record<string, QtiValue> = {};
  let status: QtiAttemptStatus = priorState?.status ?? "initialized";
  const random = seededRandom(options.randomSeed ?? document.item.identifier);
  const customOperators = options.customOperators ?? {};

  for (const declaration of document.item.responseDeclarations) {
    correctResponses[declaration.identifier] = declaration.correctResponse;
    if (declaration.defaultValue !== null && responses[declaration.identifier] === undefined) {
      responses[declaration.identifier] = declaration.defaultValue;
    }
  }
  for (const declaration of document.item.templateDeclarations) {
    templateValues[declaration.identifier] = declaration.defaultValue;
  }
  for (const outcome of document.item.outcomeDeclarations) {
    outcomes[outcome.identifier] = outcome.defaultValue;
  }
  outcomes[COMPLETION_STATUS] = COMPLETION_NOT_ATTEMPTED;

  applyTemplateProcessing(
    document,
    templateValues,
    responses,
    outcomes,
    correctResponses,
    random,
    customOperators,
  );
  const defaultOutcomes = { ...outcomes };
  Object.assign(templateValues, priorState?.templateValues ?? {});
  Object.assign(outcomes, priorState?.outcomes ?? {});

  return {
    item: document.item,
    correctResponses() {
      return { ...correctResponses };
    },
    respond(identifier: string, value: QtiValue) {
      responses[identifier] = value;
      startAttempt();
    },
    setStatus(nextStatus: QtiAttemptStatus) {
      status = nextStatus;
    },
    score() {
      const diagnostics: QtiDiagnostic[] = [];
      if (document.item.adaptive || status !== "initialized" || Object.keys(responses).length > 0) {
        startAttempt();
      }
      const completionStatus = outcomes[COMPLETION_STATUS] ?? COMPLETION_NOT_ATTEMPTED;
      if (!document.item.adaptive) {
        resetRecord(outcomes, defaultOutcomes);
        outcomes[COMPLETION_STATUS] = completionStatus;
      }
      applyResponseProcessing(
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      );
      if (outcomes[COMPLETION_STATUS] === COMPLETION_COMPLETED) status = "completed";
      const state = serialize(
        document.item.identifier,
        status,
        responses,
        outcomes,
        templateValues,
        diagnostics,
      );
      return { outcomes: { ...outcomes }, diagnostics, state };
    },
    serialize() {
      return serialize(document.item.identifier, status, responses, outcomes, templateValues, []);
    },
  };

  function startAttempt(): void {
    if (status === "initialized" || status === "suspended") status = "interacting";
    if (outcomes[COMPLETION_STATUS] === COMPLETION_NOT_ATTEMPTED) {
      outcomes[COMPLETION_STATUS] = COMPLETION_UNKNOWN;
    }
  }
}

function resetRecord<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}

function applyTemplateProcessing(
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): void {
  const rules = document.item.templateProcessing?.rules ?? [];
  let restarts = 0;
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]!;
    const shouldExit = applyTemplateRule(
      rule,
      document,
      templateValues,
      responses,
      outcomes,
      correctResponses,
      random,
      customOperators,
    );
    if (shouldExit) return;
    if (rule.type === "templateConstraint") {
      const satisfied = evaluateBoolean(
        rule.expression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      );
      if (!satisfied) {
        resetTemplateValues(document, templateValues);
        restarts += 1;
        if (restarts <= 100) index = -1;
      }
    }
  }
}

function resetTemplateValues(
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
): void {
  for (const key of Object.keys(templateValues)) {
    delete templateValues[key];
  }
  for (const declaration of document.item.templateDeclarations) {
    templateValues[declaration.identifier] = declaration.defaultValue;
  }
}

function applyTemplateRule(
  rule: QtiTemplateRule,
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): boolean {
  if (rule.type === "exitTemplate") return true;
  if (rule.type === "templateConstraint") return false;

  if (rule.type === "templateCondition") {
    let branch = evaluateBoolean(
      rule.ifExpression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    )
      ? rule.thenRules
      : undefined;
    if (!branch) {
      for (const elseIf of rule.elseIfs) {
        if (
          evaluateBoolean(
            elseIf.expression,
            document,
            responses,
            outcomes,
            templateValues,
            correctResponses,
            random,
            customOperators,
          )
        ) {
          branch = elseIf.rules;
          break;
        }
      }
    }
    branch ??= rule.elseRules;
    for (const branchRule of branch) {
      const shouldExit = applyTemplateRule(
        branchRule,
        document,
        templateValues,
        responses,
        outcomes,
        correctResponses,
        random,
        customOperators,
      );
      if (shouldExit) return true;
    }
    return false;
  }

  const value = evaluateValue(
    rule.expression,
    document,
    responses,
    outcomes,
    templateValues,
    correctResponses,
    random,
    customOperators,
  );
  if (rule.type === "setTemplateValue") {
    templateValues[rule.identifier] = value;
    return false;
  }

  if (rule.type === "setDefaultValue") {
    const responseDeclaration = getResponseDeclaration(document, rule.identifier);
    if (responseDeclaration) {
      const normalized = normalizeValueForCardinality(value, responseDeclaration.cardinality);
      responseDeclaration.defaultValue = normalized;
      responses[rule.identifier] = normalized;
      return false;
    }
    const outcomeDeclaration = document.item.outcomeDeclarations.find(
      (declaration) => declaration.identifier === rule.identifier,
    );
    if (outcomeDeclaration) {
      outcomeDeclaration.defaultValue = value;
      outcomes[rule.identifier] = value;
    }
    return false;
  }

  const declaration = getResponseDeclaration(document, rule.identifier);
  if (declaration)
    correctResponses[rule.identifier] = normalizeValueForCardinality(
      value,
      declaration.cardinality,
    );
  return false;
}

function applyResponseProcessing(
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): void {
  const processing = document.item.responseProcessing;
  if (processing?.conditions.length) {
    for (const condition of processing.conditions) {
      let branch = evaluateBoolean(
        condition.ifExpression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      )
        ? condition.thenRules
        : undefined;
      if (!branch) {
        for (const elseIf of condition.elseIfs) {
          if (
            evaluateBoolean(
              elseIf.expression,
              document,
              responses,
              outcomes,
              templateValues,
              correctResponses,
              random,
              customOperators,
            )
          ) {
            branch = elseIf.rules;
            break;
          }
        }
      }
      branch ??= condition.elseRules;
      const shouldExit = applyResponseRules(
        branch,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      );
      if (shouldExit) return;
    }
    return;
  }

  const template = processing?.template ?? "";
  if (template.includes("map_response")) {
    let score = 0;
    for (const declaration of document.item.responseDeclarations) {
      score += mapOrMatchResponse(
        declaration,
        responses[declaration.identifier] ?? null,
        correctResponses[declaration.identifier] ?? null,
      );
    }
    outcomes.SCORE = score;
    return;
  }

  let score = 0;
  let scored = false;
  for (const declaration of document.item.responseDeclarations) {
    const response = responses[declaration.identifier] ?? null;
    const correctResponse = correctResponses[declaration.identifier] ?? null;
    if (correctResponse !== null) {
      score += valuesEqual(response, correctResponse, declaration.cardinality === "ordered")
        ? 1
        : 0;
      scored = true;
    }
  }
  if (scored) outcomes.SCORE = score;
}

function applyResponseRules(
  rules: QtiResponseRule[],
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): boolean {
  for (const rule of rules) {
    if (rule.type === "exitResponse") return true;
    if (rule.type === "responseProcessingFragment") {
      const shouldExit = applyResponseRules(
        rule.rules,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      );
      if (shouldExit) return true;
      continue;
    }
    if (rule.type === "lookupOutcomeValue") {
      outcomes[rule.identifier] = lookupOutcomeValue(
        document,
        rule.identifier,
        evaluateValue(
          rule.expression,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      );
      continue;
    }
    outcomes[rule.identifier] = evaluateValue(
      rule.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
  }
  return false;
}

function evaluateBoolean(
  expression: QtiProcessingExpression | undefined,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue> = {},
  templateValues: Record<string, QtiValue> = {},
  correctResponses: Record<string, QtiValue> = {},
  random: () => number = Math.random,
  customOperators: QtiCustomOperatorRegistry = {},
): boolean {
  if (!expression) return false;
  return booleanValue(
    evaluateValue(
      expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    ),
  );
}

function evaluateValue(
  expression: QtiProcessingExpression,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue> = {},
  templateValues: Record<string, QtiValue> = {},
  correctResponses: Record<string, QtiValue> = {},
  random: () => number = Math.random,
  customOperators: QtiCustomOperatorRegistry = {},
): QtiValue {
  if (expression.type === "baseValue") return expression.value;
  if (expression.type === "isNull") return isNullResponse(responses[expression.identifier] ?? null);
  if (expression.type === "matchCorrect") {
    const declaration = getResponseDeclaration(document, expression.correctIdentifier);
    return declaration
      ? valuesEqual(
          responses[expression.identifier] ?? null,
          correctResponses[expression.correctIdentifier] ?? null,
          declaration.cardinality === "ordered",
        )
      : false;
  }
  if (expression.type === "mapResponse") {
    const declaration = getResponseDeclaration(document, expression.identifier);
    return declaration
      ? mapOrMatchResponse(
          declaration,
          responses[expression.identifier] ?? null,
          correctResponses[expression.identifier] ?? null,
        )
      : 0;
  }
  if (expression.type === "mapResponsePoint") {
    const declaration = getResponseDeclaration(document, expression.identifier);
    return declaration?.areaMapping
      ? scoreAreaMapping(responses[expression.identifier] ?? null, declaration.areaMapping)
      : 0;
  }
  if (expression.type === "correct") {
    return correctResponses[expression.identifier] ?? null;
  }
  if (expression.type === "default") {
    return defaultValueForIdentifier(document, expression.identifier);
  }
  if (expression.type === "variable") {
    return (
      responses[expression.identifier] ??
      outcomes[expression.identifier] ??
      templateValues[expression.identifier] ??
      null
    );
  }
  if (expression.type === "randomInteger") {
    const step = expression.step > 0 ? expression.step : 1;
    const count = Math.floor((expression.max - expression.min) / step) + 1;
    return expression.min + Math.floor(random() * count) * step;
  }
  if (expression.type === "randomFloat") {
    return expression.min + random() * (expression.max - expression.min);
  }
  if (expression.type === "random") {
    if (expression.values.length === 0) return null;
    const index = Math.floor(random() * expression.values.length);
    return evaluateValue(
      expression.values[index]!,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
  }
  if (expression.type === "multiple" || expression.type === "ordered") {
    const values = expression.expressions.flatMap((item) =>
      valueContainer(
        evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
    return values.length > 0 ? values : null;
  }
  if (expression.type === "index") {
    const values = valueContainer(
      evaluateValue(
        expression.expression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    const n = indexValue(expression.n, outcomes, templateValues);
    if (n === undefined || n < 1 || n > values.length) return null;
    return values[n - 1] ?? null;
  }
  if (expression.type === "containerSize") {
    return valueContainer(
      evaluateValue(
        expression.expression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    ).length;
  }
  if (expression.type === "sum") {
    return expression.expressions.reduce(
      (sum, item) =>
        sum +
        numericValue(
          evaluateValue(
            item,
            document,
            responses,
            outcomes,
            templateValues,
            correctResponses,
            random,
            customOperators,
          ),
        ),
      0,
    );
  }
  if (expression.type === "product") {
    return expression.expressions.reduce(
      (product, item) =>
        product *
        numericValue(
          evaluateValue(
            item,
            document,
            responses,
            outcomes,
            templateValues,
            correctResponses,
            random,
            customOperators,
          ),
        ),
      1,
    );
  }
  if (expression.type === "min" || expression.type === "max") {
    const values = expression.expressions.flatMap((item) =>
      valueContainer(
        evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
    if (values.length === 0) return null;
    const numericValues = values.map((value) => numericValue(value));
    return expression.type === "min" ? Math.min(...numericValues) : Math.max(...numericValues);
  }
  if (expression.type === "subtract") {
    return (
      numericValue(
        evaluateValue(
          expression.left,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ) -
      numericValue(
        evaluateValue(
          expression.right,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      )
    );
  }
  if (expression.type === "divide") {
    const divisor = numericValue(
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    if (divisor === 0) return 0;
    return (
      numericValue(
        evaluateValue(
          expression.left,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ) / divisor
    );
  }
  if (expression.type === "power") {
    const value = Math.pow(
      numericValue(
        evaluateValue(
          expression.left,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
      numericValue(
        evaluateValue(
          expression.right,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
    return Number.isFinite(value) ? value : null;
  }
  if (expression.type === "integerDivide") {
    const dividendValue = evaluateValue(
      expression.left,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const divisorValue = evaluateValue(
      expression.right,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (dividendValue === null || divisorValue === null) return null;
    const divisor = numericValue(divisorValue);
    if (divisor === 0) return null;
    return Math.floor(numericValue(dividendValue) / divisor);
  }
  if (expression.type === "integerModulus") {
    const dividendValue = evaluateValue(
      expression.left,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const divisorValue = evaluateValue(
      expression.right,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (dividendValue === null || divisorValue === null) return null;
    const divisor = numericValue(divisorValue);
    if (divisor === 0) return null;
    const dividend = numericValue(dividendValue);
    return dividend - Math.floor(dividend / divisor) * divisor;
  }
  if (expression.type === "round") {
    return Math.round(
      numericValue(
        evaluateValue(
          expression.expression,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
  }
  if (expression.type === "roundTo") {
    const value = numericValue(
      evaluateValue(
        expression.expression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    return expression.roundingMode === "decimalPlaces"
      ? roundToDecimalPlaces(value, expression.figures)
      : roundToSignificantFigures(value, expression.figures);
  }
  if (expression.type === "truncate") {
    return Math.trunc(
      numericValue(
        evaluateValue(
          expression.expression,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
  }
  if (expression.type === "integerToFloat") {
    const value = evaluateValue(
      expression.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return value === null ? null : numericValue(value);
  }
  if (expression.type === "and") {
    return expression.expressions.every((item) =>
      booleanValue(
        evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
  }
  if (expression.type === "anyN") {
    const min = indexValue(expression.min, outcomes, templateValues) ?? 0;
    const max = indexValue(expression.max, outcomes, templateValues) ?? 0;
    const values = expression.expressions.map((item) =>
      evaluateValue(
        item,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    const trueCount = values.filter((value) => value === true).length;
    const nullCount = values.filter((value) => value === null).length;
    if (min > max || trueCount > max || trueCount + nullCount < min) return false;
    if (trueCount >= min && trueCount <= max) return true;
    return null;
  }
  if (expression.type === "or") {
    return expression.expressions.some((item) =>
      booleanValue(
        evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
    );
  }
  if (expression.type === "not") {
    return !booleanValue(
      evaluateValue(
        expression.expression,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
  }
  if (expression.type === "equal") {
    return valuesEqual(
      evaluateValue(
        expression.left,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
  }
  if (expression.type === "equalRounded") {
    const left = evaluateValue(
      expression.left,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const right = evaluateValue(
      expression.right,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (left === null || right === null) return null;
    const roundedLeft = roundWithMode(
      numericValue(left),
      expression.roundingMode,
      expression.figures,
    );
    const roundedRight = roundWithMode(
      numericValue(right),
      expression.roundingMode,
      expression.figures,
    );
    return roundedLeft === null || roundedRight === null ? null : roundedLeft === roundedRight;
  }
  if (expression.type === "numericCompare") {
    const left = numericValue(
      evaluateValue(
        expression.left,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    const right = numericValue(
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    if (expression.operator === "lt") return left < right;
    if (expression.operator === "lte") return left <= right;
    if (expression.operator === "gt") return left > right;
    return left >= right;
  }
  if (expression.type === "stringMatch") {
    return stringMatch(
      evaluateValue(
        expression.left,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
      expression.caseSensitive,
      expression.substring,
    );
  }
  if (expression.type === "substring") {
    return stringMatch(
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
      evaluateValue(
        expression.left,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
      expression.caseSensitive,
      true,
    );
  }
  if (expression.type === "patternMatch") {
    const value = evaluateValue(
      expression.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (value === null) return null;
    const patternValue =
      responses[expression.pattern] ??
      outcomes[expression.pattern] ??
      templateValues[expression.pattern] ??
      expression.pattern;
    try {
      return new RegExp(String(patternValue)).test(String(value));
    } catch {
      return null;
    }
  }
  if (expression.type === "fieldValue") {
    const value = evaluateValue(
      expression.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return isRecordValue(value) ? (value[expression.fieldIdentifier] ?? null) : null;
  }
  if (expression.type === "member") {
    const value = evaluateValue(
      expression.value,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const collection = evaluateValue(
      expression.collection,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const values = valueContainer(collection);
    return value === null ? null : values.some((item) => valuesEqual(item, value));
  }
  if (expression.type === "delete") {
    const value = evaluateValue(
      expression.value,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const collection = valueContainer(
      evaluateValue(
        expression.collection,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    if (value === null || collection.length === 0) return null;
    const filtered = collection.filter((item) => !valuesEqual(item, value));
    return filtered.length > 0 ? filtered : null;
  }
  if (expression.type === "contains") {
    const collection = valueContainer(
      evaluateValue(
        expression.collection,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    const values = valueContainer(
      evaluateValue(
        expression.values,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    if (collection.length === 0 || values.length === 0) return null;
    return containsValues(collection, values);
  }
  if (expression.type === "gcd" || expression.type === "lcm") {
    const values = expression.expressions.flatMap((item) => {
      const value = evaluateValue(
        item,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      );
      return value === null ? [null] : valueContainer(value);
    });
    if (values.length === 0 || values.some((value) => value === null)) return null;
    const integers = values.map((value) => Math.trunc(numericValue(value)));
    return expression.type === "gcd" ? generalizedGcd(integers) : generalizedLcm(integers);
  }
  if (expression.type === "inside") {
    const value = evaluateValue(
      expression.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (value === null) return null;
    if (expression.shape === "default") return true;
    return valueContainer(value).some((pointValue) => {
      const point = parsePoint(String(pointValue));
      return point
        ? pointInsideArea(point, {
            shape: expression.shape,
            coords: expression.coords,
            mappedValue: 0,
            attributes: {},
          })
        : false;
    });
  }
  if (expression.type === "mathConstant") {
    if (expression.name === "pi") return Math.PI;
    if (expression.name === "e") return Math.E;
    return null;
  }
  if (expression.type === "mathOperator") {
    const values = expression.expressions.map((item) =>
      evaluateValue(
        item,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
        customOperators,
      ),
    );
    if (values.length === 0 || values.some((value) => value === null)) return null;
    return mathOperatorValue(expression.name, values.map(numericValue));
  }
  if (expression.type === "repeat") {
    const repeats = indexValue(expression.numberRepeats, outcomes, templateValues);
    if (repeats === undefined || repeats < 1) return null;
    const container: QtiScalarValue[] = [];
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      for (const item of expression.expressions) {
        const value = evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        );
        container.push(...valueContainer(value));
      }
    }
    return container.length > 0 ? container : null;
  }
  if (expression.type === "statsOperator") {
    const value = evaluateValue(
      expression.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (value === null) return null;
    const values = valueContainer(value).map(numericValue);
    return statsOperatorValue(expression.name, values);
  }
  if (expression.type === "customOperator") {
    const operatorKey = expression.definition ?? expression.className ?? "";
    const handler = customOperators[operatorKey];
    if (!handler) return null;
    return handler({
      definition: expression.definition,
      className: expression.className,
      attributes: expression.attributes,
      values: expression.expressions.map((item) =>
        evaluateValue(
          item,
          document,
          responses,
          outcomes,
          templateValues,
          correctResponses,
          random,
          customOperators,
        ),
      ),
      expression,
    });
  }
  return null;
}

function getResponseDeclaration(
  document: QtiDocument,
  identifier: string,
): QtiResponseDeclaration | undefined {
  return document.item.responseDeclarations.find(
    (declaration) => declaration.identifier === identifier,
  );
}

function defaultValueForIdentifier(document: QtiDocument, identifier: string): QtiValue {
  return (
    document.item.responseDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.defaultValue ??
    document.item.outcomeDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.defaultValue ??
    document.item.templateDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.defaultValue ??
    null
  );
}

function lookupOutcomeValue(document: QtiDocument, identifier: string, value: QtiValue): QtiValue {
  const declaration = document.item.outcomeDeclarations.find(
    (outcome) => outcome.identifier === identifier,
  );
  const lookupTable = declaration?.lookupTable;
  if (!lookupTable) return null;
  if (value === null) return lookupTable.defaultValue;
  const numeric = numericValue(value);
  if (lookupTable.type === "match") {
    return (
      lookupTable.entries.find((entry) => entry.sourceValue === numeric)?.targetValue ??
      lookupTable.defaultValue
    );
  }
  const entry = [...lookupTable.entries]
    .sort((left, right) => left.sourceValue - right.sourceValue)
    .find(
      (candidate) =>
        numeric < candidate.sourceValue ||
        (candidate.includeBoundary !== false && numeric === candidate.sourceValue),
    );
  return entry?.targetValue ?? lookupTable.defaultValue;
}

function mapOrMatchResponse(
  declaration: QtiResponseDeclaration,
  response: QtiValue,
  correctResponse: QtiValue,
): number {
  if (declaration.areaMapping) return scoreAreaMapping(response, declaration.areaMapping);
  if (declaration.mapping) return scoreMapping(response, declaration.mapping);
  return valuesEqual(response, correctResponse, declaration.cardinality === "ordered") ? 1 : 0;
}

function scoreAreaMapping(
  response: QtiValue,
  areaMapping: NonNullable<QtiResponseDeclaration["areaMapping"]>,
): number {
  const points = Array.isArray(response) ? response : response === null ? [] : [String(response)];
  let score = 0;
  for (const point of points) {
    const parsed = parsePoint(String(point));
    if (!parsed) {
      score += areaMapping.defaultValue;
      continue;
    }
    const entry = areaMapping.entries.find((candidate) => pointInsideArea(parsed, candidate));
    score += entry?.mappedValue ?? areaMapping.defaultValue;
  }
  return clampMappedScore(score, areaMapping.attributes);
}

function parsePoint(value: string): { x: number; y: number } | undefined {
  const [x, y] = value
    .trim()
    .split(/[,\s]+/)
    .map((part) => Number(part));
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

function pointInsideArea(
  point: { x: number; y: number },
  entry: NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number],
): boolean {
  if (entry.shape === "circle") {
    const [cx, cy, radius] = entry.coords;
    if (cx === undefined || cy === undefined || radius === undefined) return false;
    return Math.hypot(point.x - cx, point.y - cy) <= radius;
  }

  if (entry.shape === "rect") {
    const [left, top, right, bottom] = entry.coords;
    if (left === undefined || top === undefined || right === undefined || bottom === undefined) {
      return false;
    }
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  if (entry.shape === "poly") {
    return pointInsidePolygon(point, entry.coords);
  }

  return false;
}

function pointInsidePolygon(point: { x: number; y: number }, coords: number[]): boolean {
  if (coords.length < 6 || coords.length % 2 !== 0) return false;
  let inside = false;
  for (let index = 0, previous = coords.length - 2; index < coords.length; index += 2) {
    const xi = coords[index]!;
    const yi = coords[index + 1]!;
    const xj = coords[previous]!;
    const yj = coords[previous + 1]!;
    const intersects =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
    previous = index;
  }
  return inside;
}

function isNullResponse(response: QtiValue): boolean {
  return response === null || response === "" || (Array.isArray(response) && response.length === 0);
}

function serialize(
  itemIdentifier: string,
  status: QtiAttemptStatus,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  validationMessages: QtiDiagnostic[],
): QtiAttemptStateV1 {
  return {
    schema: "qti3.attempt-state.v1",
    itemIdentifier,
    status,
    responses: { ...responses },
    outcomes: { ...outcomes },
    templateValues: { ...templateValues },
    validationMessages: [...validationMessages],
  };
}

function scoreMapping(
  response: QtiValue,
  mapping: NonNullable<QtiResponseDeclaration["mapping"]>,
): number {
  const values = Object.fromEntries(
    mapping.entries
      .filter((entry) => entry.mapKey !== undefined)
      .map((entry) => [entry.mapKey!, entry.mappedValue]),
  );
  if (Array.isArray(response)) {
    const score = response.reduce<number>(
      (sum, value) => sum + (values[String(value)] ?? mapping.defaultValue),
      0,
    );
    return clampMappedScore(score, mapping.attributes);
  }
  const score = typeof response === "string" ? (values[response] ?? mapping.defaultValue) : 0;
  return clampMappedScore(score, mapping.attributes);
}

function clampMappedScore(score: number, attributes: Record<string, string>): number {
  const lower = numericBound(attributes["lower-bound"]);
  const upper = numericBound(attributes["upper-bound"]);
  let clamped = score;
  if (lower !== undefined) clamped = Math.max(clamped, lower);
  if (upper !== undefined) clamped = Math.min(clamped, upper);
  return clamped;
}

function numericBound(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function valuesEqual(actual: QtiValue, expected: QtiValue, ordered = false): boolean {
  if (isRecordValue(actual) || isRecordValue(expected)) {
    if (!isRecordValue(actual) || !isRecordValue(expected)) return false;
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return (
      valuesEqual(actualKeys, expectedKeys, true) &&
      actualKeys.every((key) => valuesEqual(actual[key] ?? null, expected[key] ?? null, ordered))
    );
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    const actualValues = valueContainer(actual);
    const expectedValues = Array.isArray(expected) ? expected : expected === null ? [] : [expected];
    if (actualValues.length !== expectedValues.length) return false;
    if (ordered) return actualValues.every((value, index) => value === expectedValues[index]);
    return [...actualValues]
      .sort(compareScalarValues)
      .every((value, index) => value === [...expectedValues].sort(compareScalarValues)[index]);
  }
  return actual === expected;
}

function normalizeValueForCardinality(
  value: QtiValue,
  cardinality: QtiResponseDeclaration["cardinality"],
): QtiValue {
  if (
    (cardinality === "multiple" || cardinality === "ordered") &&
    value !== null &&
    !Array.isArray(value) &&
    !isRecordValue(value)
  ) {
    return [value];
  }
  return value;
}

function valueContainer(value: QtiValue): QtiScalarValue[] {
  if (value === null) return [];
  if (isRecordValue(value)) return [];
  return Array.isArray(value) ? value.filter((item) => item !== null) : [value];
}

function isRecordValue(value: QtiValue): value is QtiRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function indexValue(
  n: string,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
): number | undefined {
  const parsed = Number(n);
  if (Number.isInteger(parsed)) return parsed;
  const value = outcomes[n] ?? templateValues[n] ?? null;
  const numeric = numericValue(value);
  return Number.isInteger(numeric) ? numeric : undefined;
}

function containsValues(collection: QtiScalarValue[], values: QtiScalarValue[]): boolean {
  const remaining = [...collection];
  for (const value of values) {
    const index = remaining.findIndex((candidate) => valuesEqual(candidate, value));
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}

function compareScalarValues(left: QtiScalarValue, right: QtiScalarValue): number {
  return String(left).localeCompare(String(right));
}

function numericValue(value: QtiValue): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return Number(value);
  return 0;
}

function booleanValue(value: QtiValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0 && value !== "false";
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function roundToDecimalPlaces(value: number, figures: number): number {
  const factor = 10 ** figures;
  return Math.round(value * factor) / factor;
}

function roundToSignificantFigures(value: number, figures: number): number {
  if (value === 0 || figures <= 0) return 0;
  const factor = 10 ** (figures - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.round(value * factor) / factor;
}

function roundWithMode(value: number, roundingMode: string, figures: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (roundingMode === "decimalPlaces") return roundToDecimalPlaces(value, figures);
  if (roundingMode === "significantFigures") return roundToSignificantFigures(value, figures);
  return null;
}

function generalizedGcd(values: number[]): number {
  let result = 0;
  for (const value of values) {
    result = gcd(result, Math.abs(value));
  }
  return result;
}

function generalizedLcm(values: number[]): number {
  if (values.some((value) => value === 0)) return 0;
  return values.reduce((result, value) => lcm(result, Math.abs(value)), 1);
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function lcm(left: number, right: number): number {
  return Math.abs(left * right) / gcd(left, right);
}

function mathOperatorValue(name: string, values: number[]): QtiValue {
  const [first, second] = values;
  if (first === undefined) return null;
  switch (name) {
    case "abs":
      return finiteOrNull(Math.abs(first));
    case "acos":
      return Math.abs(first) > 1 ? null : finiteOrNull(Math.acos(first));
    case "acot":
      return finiteOrNull(Math.PI / 2 - Math.atan(1 / first));
    case "acsc":
      return Math.abs(first) < 1 ? null : finiteOrNull(Math.PI / 2 - Math.asin(1 / first));
    case "asec":
      return Math.abs(first) < 1 ? null : finiteOrNull(Math.PI / 2 - Math.acos(1 / first));
    case "asin":
      return Math.abs(first) > 1 ? null : finiteOrNull(Math.asin(first));
    case "atan":
      return finiteOrNull(Math.atan(first));
    case "atan2":
      return second === undefined ? null : finiteOrNull(Math.atan2(first, second));
    case "ceil":
      return finiteOrNull(Math.ceil(first));
    case "cos":
      return finiteOrNull(Math.cos(first));
    case "cosh":
      return finiteOrNull(Math.cosh(first));
    case "cot":
      return finiteOrNull(1 / Math.tan(first));
    case "coth":
      return finiteOrNull(1 / Math.tanh(first));
    case "csc":
      return finiteOrNull(1 / Math.sin(first));
    case "csch":
      return finiteOrNull(1 / Math.sinh(first));
    case "exp":
      return finiteOrNull(Math.exp(first));
    case "floor":
      return finiteOrNull(Math.floor(first));
    case "ln":
      return first < 0 ? null : finiteOrNull(Math.log(first));
    case "log":
      return first < 0 ? null : finiteOrNull(Math.log10(first));
    case "sec":
      return finiteOrNull(1 / Math.cos(first));
    case "sech":
      return finiteOrNull(1 / Math.cosh(first));
    case "signum":
      return finiteOrNull(Math.sign(first));
    case "sin":
      return finiteOrNull(Math.sin(first));
    case "sinh":
      return finiteOrNull(Math.sinh(first));
    case "tan":
      return finiteOrNull(Math.tan(first));
    case "tanh":
      return finiteOrNull(Math.tanh(first));
    case "toDegrees":
      return finiteOrNull((first * 180) / Math.PI);
    case "toRadians":
      return finiteOrNull((first * Math.PI) / 180);
    default:
      return null;
  }
}

function statsOperatorValue(name: string, values: number[]): QtiValue {
  if (values.length === 0) return 0;
  const meanValue = mean(values);
  const squareDiffs = values.map((value) => (value - meanValue) ** 2);
  switch (name) {
    case "mean":
      return meanValue;
    case "sampleVariance":
      return meanWithDivisor(squareDiffs, values.length > 1 ? values.length - 1 : 1);
    case "sampleSD":
      return Math.sqrt(meanWithDivisor(squareDiffs, values.length > 1 ? values.length - 1 : 1));
    case "popVariance":
      return mean(squareDiffs);
    case "popSD":
      return Math.sqrt(mean(squareDiffs));
    default:
      return null;
  }
}

function mean(values: number[]): number {
  return meanWithDivisor(values, values.length);
}

function meanWithDivisor(values: number[], divisor: number): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / divisor;
}

function finiteOrNull(value: number): QtiValue {
  return Number.isFinite(value) ? value : null;
}

function stringMatch(
  left: QtiValue,
  right: QtiValue,
  caseSensitive: boolean,
  substring: boolean,
): boolean {
  let actual = String(left ?? "");
  let expected = String(right ?? "");
  if (!caseSensitive) {
    actual = actual.toLocaleLowerCase();
    expected = expected.toLocaleLowerCase();
  }
  return substring ? actual.includes(expected) : actual === expected;
}

function seededRandom(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
