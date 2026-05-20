import type {
  QtiAssessmentItem,
  QtiAttemptStatus,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiModalFeedback,
  QtiProcessingExpression,
  QtiResponseDeclaration,
  QtiSetOutcomeValue,
  QtiScoreResult,
  QtiTemplateRule,
  QtiValue,
} from "./types.js";

export interface QtiItemSessionOptions {
  randomSeed?: string | number | undefined;
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
  const defaultOutcomes = { ...outcomes };

  applyTemplateProcessing(document, templateValues, responses, correctResponses, random);
  Object.assign(templateValues, priorState?.templateValues ?? {});
  Object.assign(outcomes, priorState?.outcomes ?? {});

  return {
    item: document.item,
    correctResponses() {
      return { ...correctResponses };
    },
    respond(identifier: string, value: QtiValue) {
      responses[identifier] = value;
      if (status === "initialized" || status === "suspended") status = "interacting";
    },
    setStatus(nextStatus: QtiAttemptStatus) {
      status = nextStatus;
    },
    score() {
      const diagnostics: QtiDiagnostic[] = [];
      resetRecord(outcomes, defaultOutcomes);
      applyResponseProcessing(
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
      );
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
  correctResponses: Record<string, QtiValue>,
  random: () => number,
): void {
  for (const rule of document.item.templateProcessing?.rules ?? []) {
    applyTemplateRule(rule, document, templateValues, responses, correctResponses, random);
  }
}

function applyTemplateRule(
  rule: QtiTemplateRule,
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
  responses: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
): void {
  const value = evaluateValue(
    rule.expression,
    document,
    responses,
    {},
    templateValues,
    correctResponses,
    random,
  );
  if (rule.type === "setTemplateValue") {
    templateValues[rule.identifier] = value;
    return;
  }

  const declaration = getResponseDeclaration(document, rule.identifier);
  if (declaration)
    correctResponses[rule.identifier] = normalizeValueForCardinality(
      value,
      declaration.cardinality,
    );
}

function applyResponseProcessing(
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
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
            )
          ) {
            branch = elseIf.rules;
            break;
          }
        }
      }
      branch ??= condition.elseRules;
      applyOutcomeRules(
        branch,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
      );
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

function applyOutcomeRules(
  rules: QtiSetOutcomeValue[],
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
): void {
  for (const rule of rules) {
    outcomes[rule.identifier] = evaluateValue(
      rule.expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
    );
  }
}

function evaluateBoolean(
  expression: QtiProcessingExpression | undefined,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue> = {},
  templateValues: Record<string, QtiValue> = {},
  correctResponses: Record<string, QtiValue> = {},
  random: () => number = Math.random,
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
    );
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
          ),
        ),
      1,
    );
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
        ),
      )
    );
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
        ),
      ),
    );
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
      ),
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
      ),
    );
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
      ),
      evaluateValue(
        expression.right,
        document,
        responses,
        outcomes,
        templateValues,
        correctResponses,
        random,
      ),
      expression.caseSensitive,
      expression.substring,
    );
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
    );
    const collection = evaluateValue(
      expression.collection,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
    );
    const values = Array.isArray(collection)
      ? collection
      : collection === null
        ? []
        : [String(collection)];
    return values.includes(String(value ?? ""));
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
    const parsed = parsePoint(point);
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
    const score = response.reduce((sum, value) => sum + (values[value] ?? mapping.defaultValue), 0);
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
  if (Array.isArray(actual) || Array.isArray(expected)) {
    const actualValues = Array.isArray(actual) ? actual : actual === null ? [] : [String(actual)];
    const expectedValues = Array.isArray(expected)
      ? expected
      : expected === null
        ? []
        : [String(expected)];
    if (actualValues.length !== expectedValues.length) return false;
    if (ordered) return actualValues.every((value, index) => value === expectedValues[index]);
    return [...actualValues]
      .sort()
      .every((value, index) => value === [...expectedValues].sort()[index]);
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
    !Array.isArray(value)
  ) {
    return [String(value)];
  }
  return value;
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
