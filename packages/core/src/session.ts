import type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiProcessingExpression,
  QtiResponseDeclaration,
  QtiSetOutcomeValue,
  QtiScoreResult,
  QtiValue,
} from "./types.js";

export interface QtiItemSession {
  readonly item: QtiAssessmentItem;
  respond(identifier: string, value: QtiValue): void;
  score(): QtiScoreResult;
  serialize(): QtiAttemptStateV1;
}

export function createItemSession(
  document: QtiDocument,
  priorState?: QtiAttemptStateV1,
): QtiItemSession {
  const responses: Record<string, QtiValue> = { ...priorState?.responses };
  const outcomes: Record<string, QtiValue> = {};

  for (const outcome of document.item.outcomeDeclarations) {
    outcomes[outcome.identifier] = outcome.defaultValue;
  }
  Object.assign(outcomes, priorState?.outcomes ?? {});

  return {
    item: document.item,
    respond(identifier: string, value: QtiValue) {
      responses[identifier] = value;
    },
    score() {
      const diagnostics: QtiDiagnostic[] = [];
      applyResponseProcessing(document, responses, outcomes);
      const state = serialize(document.item.identifier, responses, outcomes, diagnostics);
      return { outcomes: { ...outcomes }, diagnostics, state };
    },
    serialize() {
      return serialize(document.item.identifier, responses, outcomes, []);
    },
  };
}

function applyResponseProcessing(
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
): void {
  const processing = document.item.responseProcessing;
  if (processing?.conditions.length) {
    for (const condition of processing.conditions) {
      const branch = evaluateBoolean(condition.ifExpression, document, responses)
        ? condition.thenRules
        : condition.elseRules;
      applyOutcomeRules(branch, document, responses, outcomes);
    }
    return;
  }

  const template = processing?.template ?? "";
  if (template.includes("map_response")) {
    for (const declaration of document.item.responseDeclarations) {
      outcomes.SCORE = mapOrMatchResponse(declaration, responses[declaration.identifier] ?? null);
    }
    return;
  }

  for (const declaration of document.item.responseDeclarations) {
    const response = responses[declaration.identifier] ?? null;
    if (declaration.correctResponse !== null) {
      outcomes.SCORE = valuesEqual(
        response,
        declaration.correctResponse,
        declaration.cardinality === "ordered",
      )
        ? 1
        : 0;
    }
  }
}

function applyOutcomeRules(
  rules: QtiSetOutcomeValue[],
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
): void {
  for (const rule of rules) {
    outcomes[rule.identifier] = evaluateValue(rule.expression, document, responses);
  }
}

function evaluateBoolean(
  expression: QtiProcessingExpression | undefined,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
): boolean {
  if (!expression) return false;
  const value = evaluateValue(expression, document, responses);
  return value === true;
}

function evaluateValue(
  expression: QtiProcessingExpression,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
): QtiValue {
  if (expression.type === "baseValue") return expression.value;
  if (expression.type === "isNull") return isNullResponse(responses[expression.identifier] ?? null);
  if (expression.type === "matchCorrect") {
    const declaration = getResponseDeclaration(document, expression.identifier);
    return declaration
      ? valuesEqual(
          responses[expression.identifier] ?? null,
          declaration.correctResponse,
          declaration.cardinality === "ordered",
        )
      : false;
  }
  if (expression.type === "mapResponse") {
    const declaration = getResponseDeclaration(document, expression.identifier);
    return declaration
      ? mapOrMatchResponse(declaration, responses[expression.identifier] ?? null)
      : 0;
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

function mapOrMatchResponse(declaration: QtiResponseDeclaration, response: QtiValue): number {
  if (declaration.areaMapping) return scoreAreaMapping(response, declaration.areaMapping);
  if (declaration.mapping) return scoreMapping(response, declaration.mapping);
  return valuesEqual(response, declaration.correctResponse, declaration.cardinality === "ordered")
    ? 1
    : 0;
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
  return score;
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
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  validationMessages: QtiDiagnostic[],
): QtiAttemptStateV1 {
  return {
    schema: "qti3.attempt-state.v1",
    itemIdentifier,
    responses: { ...responses },
    outcomes: { ...outcomes },
    validationMessages: [...validationMessages],
  };
}

function scoreMapping(response: QtiValue, mapping: Record<string, number>): number {
  if (Array.isArray(response)) {
    return response.reduce((sum, value) => sum + (mapping[value] ?? 0), 0);
  }
  return typeof response === "string" ? (mapping[response] ?? 0) : 0;
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
