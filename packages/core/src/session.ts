import type {
  QtiAssessmentItem,
  QtiAttemptStatus,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiModalFeedback,
  QtiPortableCustomStateValue,
  QtiProcessingExpression,
  QtiRecordValue,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseRule,
  QtiScalarValue,
  QtiScoreResult,
  QtiTemplateRule,
  QtiValue,
  QtiVariableDeclaration,
} from "./types.js";
import { qtiScalarToString, qtiValueToString, qtiValueToStringList } from "./value-format.js";

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
const ATTEMPT_STATE_SCHEMA = "qti3.attempt-state.v1";
const ATTEMPT_STATUSES = new Set<QtiAttemptStatus>([
  "initialized",
  "interacting",
  "suspended",
  "completed",
]);

export interface QtiItemSessionOptions {
  randomSeed?: string | number | undefined;
  customOperators?: QtiCustomOperatorRegistry | undefined;
}

export interface QtiItemSession {
  readonly item: QtiAssessmentItem;
  correctResponses(): Record<string, QtiValue>;
  respond(identifier: string, value: QtiValue): void;
  setInteractionState(identifier: string, state: QtiPortableCustomStateValue): void;
  interactionState(identifier: string): QtiPortableCustomStateValue | undefined;
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
    const outcomeValue: QtiValue = outcome === undefined ? null : outcome;
    if (Array.isArray(outcomeValue)) return outcomeValue.includes(feedback.identifier);
    return qtiValueToString(outcomeValue) === feedback.identifier;
  });
}

export function createItemSession(
  document: QtiDocument,
  priorState?: QtiAttemptStateV1,
  options: QtiItemSessionOptions = {},
): QtiItemSession {
  assertCompatiblePriorState(document, priorState);

  const priorResponses = cloneValueRecord(priorState?.responses ?? {});
  const priorOutcomes = cloneValueRecord(priorState?.outcomes ?? {});
  const priorTemplateValues = cloneValueRecord(priorState?.templateValues ?? {});
  const priorInteractionStates = clonePortableCustomStateRecord(
    priorState?.interactionStates ?? {},
  );
  let validationMessages = cloneDiagnostics(priorState?.validationMessages ?? []);
  const responses: Record<string, QtiValue> = {};
  const responseDefaults: Record<string, QtiValue> = {};
  const outcomes: Record<string, QtiValue> = {};
  const templateValues: Record<string, QtiValue> = {};
  const interactionStates: Record<string, QtiPortableCustomStateValue> = {};
  const correctResponses: Record<string, QtiValue> = {};
  let status: QtiAttemptStatus = priorState?.status ?? "initialized";
  const random = seededRandom(options.randomSeed ?? document.item.identifier);
  const customOperators = options.customOperators ?? {};
  const portableCustomResponseIdentifiers = new Set(
    document.item.interactions
      .filter((interaction) => interaction.type === "portableCustom")
      .map((interaction) => interaction.responseIdentifier)
      .filter((identifier): identifier is string => Boolean(identifier)),
  );

  for (const declaration of document.item.responseDeclarations) {
    correctResponses[declaration.identifier] = cloneValue(declaration.correctResponse);
    if (declaration.defaultValue !== null) {
      responseDefaults[declaration.identifier] = cloneValue(declaration.defaultValue);
    }
  }
  for (const declaration of document.item.templateDeclarations) {
    templateValues[declaration.identifier] = cloneValue(declaration.defaultValue);
  }
  for (const outcome of document.item.outcomeDeclarations) {
    outcomes[outcome.identifier] = cloneValue(outcome.defaultValue);
  }
  outcomes[COMPLETION_STATUS] = COMPLETION_NOT_ATTEMPTED;
  const baseResponses = cloneValueRecord(responses);
  const baseResponseDefaults = cloneValueRecord(responseDefaults);
  const baseOutcomes = cloneValueRecord(outcomes);

  applyTemplateProcessing(
    document,
    templateValues,
    responses,
    responseDefaults,
    outcomes,
    correctResponses,
    random,
    customOperators,
    new Set(),
    baseResponses,
    baseResponseDefaults,
    baseOutcomes,
  );
  if (priorState) {
    Object.assign(templateValues, priorTemplateValues);
    resetCorrectResponses(document, correctResponses);
    applyTemplateProcessing(
      document,
      templateValues,
      responses,
      responseDefaults,
      outcomes,
      correctResponses,
      random,
      customOperators,
      new Set(Object.keys(priorTemplateValues)),
      baseResponses,
      baseResponseDefaults,
      baseOutcomes,
    );
  }
  const defaultOutcomes = cloneValueRecord(outcomes);
  Object.assign(responses, priorResponses);
  Object.assign(outcomes, priorOutcomes);
  Object.assign(interactionStates, priorInteractionStates);

  return {
    item: document.item,
    correctResponses() {
      return cloneValueRecord(correctResponses);
    },
    respond(identifier: string, value: QtiValue) {
      responses[identifier] = cloneValue(value);
      validationMessages = [];
      startAttempt();
    },
    setInteractionState(identifier: string, state: QtiPortableCustomStateValue) {
      if (!portableCustomResponseIdentifiers.has(identifier)) {
        throw new Error(`Cannot set interaction state for non-PCI response ${identifier}.`);
      }
      interactionStates[identifier] = clonePortableCustomState(state);
      validationMessages = [];
      startAttempt();
    },
    interactionState(identifier: string) {
      const state = interactionStates[identifier];
      return state === undefined ? undefined : clonePortableCustomState(state);
    },
    setStatus(nextStatus: QtiAttemptStatus) {
      status = nextStatus;
    },
    score() {
      const diagnostics: QtiDiagnostic[] = [];
      if (document.item.adaptive || status !== "initialized") {
        startAttempt();
      }
      const completionStatus = outcomes[COMPLETION_STATUS] ?? COMPLETION_NOT_ATTEMPTED;
      if (!document.item.adaptive) {
        resetRecord(outcomes, cloneValueRecord(defaultOutcomes));
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
      validationMessages = diagnostics;
      const state = serialize(
        document.item.identifier,
        status,
        responses,
        outcomes,
        templateValues,
        interactionStates,
        diagnostics,
      );
      return { outcomes: cloneValueRecord(outcomes), diagnostics, state };
    },
    serialize() {
      return serialize(
        document.item.identifier,
        status,
        responses,
        outcomes,
        templateValues,
        interactionStates,
        validationMessages,
      );
    },
  };

  function startAttempt(): void {
    for (const [identifier, value] of Object.entries(responseDefaults)) {
      if (responses[identifier] === undefined) responses[identifier] = cloneValue(value);
    }
    if (status === "initialized" || status === "suspended") status = "interacting";
    if (outcomes[COMPLETION_STATUS] === COMPLETION_NOT_ATTEMPTED) {
      outcomes[COMPLETION_STATUS] = COMPLETION_UNKNOWN;
    }
  }
}

export function isQtiAttemptStateV1(value: unknown): value is QtiAttemptStateV1 {
  return attemptStateErrors(value).length === 0;
}

export function assertQtiAttemptStateV1(value: unknown): asserts value is QtiAttemptStateV1 {
  const [firstError] = attemptStateErrors(value);
  if (firstError) throw new Error(firstError);
}

function resetRecord<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}

function assertCompatiblePriorState(
  document: QtiDocument,
  priorState: QtiAttemptStateV1 | undefined,
): void {
  if (!priorState) return;
  assertQtiAttemptStateV1(priorState);
  if (priorState.itemIdentifier !== document.item.identifier) {
    throw new Error(
      `Cannot restore state for ${priorState.itemIdentifier} into ${document.item.identifier}.`,
    );
  }
  const responseIdentifiers = new Set(
    document.item.responseDeclarations.map((declaration) => declaration.identifier),
  );
  const outcomeIdentifiers = new Set([
    ...document.item.outcomeDeclarations.map((declaration) => declaration.identifier),
    COMPLETION_STATUS,
  ]);
  const templateIdentifiers = new Set(
    document.item.templateDeclarations.map((declaration) => declaration.identifier),
  );
  const interactionStateIdentifiers = new Set(
    document.item.interactions
      .filter((interaction) => interaction.type === "portableCustom")
      .map((interaction) => interaction.responseIdentifier)
      .filter((identifier): identifier is string => Boolean(identifier)),
  );
  assertKnownStateIdentifiers("response", priorState.responses, responseIdentifiers);
  assertKnownStateIdentifiers("outcome", priorState.outcomes, outcomeIdentifiers);
  assertKnownStateIdentifiers("template", priorState.templateValues ?? {}, templateIdentifiers);
  assertKnownPortableCustomStateIdentifiers(
    priorState.interactionStates ?? {},
    interactionStateIdentifiers,
  );
  for (const message of priorState.validationMessages) {
    if (message.path && !responseIdentifiers.has(message.path)) {
      throw new Error(`Cannot restore validation message for unknown response ${message.path}.`);
    }
  }
  for (const declaration of document.item.responseDeclarations) {
    assertRestoredValueMatchesDeclaration("response", declaration, priorState.responses);
  }
  for (const declaration of document.item.outcomeDeclarations) {
    assertRestoredValueMatchesDeclaration("outcome", declaration, priorState.outcomes);
  }
  for (const declaration of document.item.templateDeclarations) {
    assertRestoredValueMatchesDeclaration("template", declaration, priorState.templateValues ?? {});
  }
  const completionStatus = priorState.outcomes[COMPLETION_STATUS];
  if (
    completionStatus !== undefined &&
    completionStatus !== COMPLETION_NOT_ATTEMPTED &&
    completionStatus !== COMPLETION_UNKNOWN &&
    completionStatus !== COMPLETION_COMPLETED &&
    completionStatus !== "incomplete"
  ) {
    throw new Error(
      `Cannot restore unsupported completionStatus ${qtiValueToString(completionStatus)}.`,
    );
  }
}

function assertKnownStateIdentifiers(
  kind: string,
  record: Record<string, QtiValue>,
  allowed: Set<string>,
): void {
  const unknown = Object.keys(record).find((identifier) => !allowed.has(identifier));
  if (unknown) throw new Error(`Cannot restore unknown ${kind} identifier ${unknown}.`);
}

function assertKnownPortableCustomStateIdentifiers(
  record: Record<string, QtiPortableCustomStateValue>,
  allowed: Set<string>,
): void {
  const unknown = Object.keys(record).find((identifier) => !allowed.has(identifier));
  if (unknown) throw new Error(`Cannot restore unknown interaction state identifier ${unknown}.`);
}

function assertRestoredValueMatchesDeclaration(
  kind: string,
  declaration: QtiVariableDeclaration,
  record: Record<string, QtiValue>,
): void {
  if (!(declaration.identifier in record)) return;
  const value = record[declaration.identifier] ?? null;
  const error = restoredValueError(declaration, value);
  if (error) throw new Error(`Cannot restore ${kind} ${declaration.identifier}: ${error}.`);
}

function restoredValueError(
  declaration: QtiVariableDeclaration,
  value: QtiValue,
): string | undefined {
  if (value === null) return undefined;
  if (declaration.cardinality === "record") {
    return isRecordValue(value) ? undefined : "expected record value";
  }
  if (isRecordValue(value)) return "expected scalar value";
  if (declaration.cardinality === "single" && Array.isArray(value)) {
    return "expected single value";
  }
  if (
    (declaration.cardinality === "multiple" || declaration.cardinality === "ordered") &&
    !Array.isArray(value)
  ) {
    return `expected ${declaration.cardinality} value container`;
  }
  if (!declaration.baseType) return undefined;
  for (const entry of restoredValueEntries(value)) {
    if (!restoredScalarMatchesBaseType(entry, declaration.baseType)) {
      return `value ${String(entry)} is not valid for base-type ${declaration.baseType}`;
    }
  }
  return undefined;
}

function restoredValueEntries(value: QtiValue): QtiScalarValue[] {
  if (value === null || isRecordValue(value)) return [];
  return Array.isArray(value) ? value : [value];
}

function restoredScalarMatchesBaseType(
  value: QtiScalarValue,
  baseType: QtiVariableDeclaration["baseType"],
): boolean {
  if (!baseType) return true;
  if (baseType === "integer") {
    return typeof value === "number" ? Number.isInteger(value) : /^-?\d+$/.test(String(value));
  }
  if (baseType === "float") {
    return typeof value === "number" ? Number.isFinite(value) : Number.isFinite(Number(value));
  }
  if (baseType === "boolean")
    return typeof value === "boolean" || value === "true" || value === "false";
  if (baseType === "point") return pointValueIsValid(value);
  if (baseType === "pair" || baseType === "directedPair") return pairValueIsValid(value);
  if (baseType === "identifier")
    return typeof value === "string" && value.trim().length > 0 && !/\s/.test(value);
  return typeof value === "string";
}

function pointValueIsValid(value: QtiScalarValue): boolean {
  const parts = String(value).trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => Number.isFinite(Number(part)));
}

function pairValueIsValid(value: QtiScalarValue): boolean {
  const parts = String(value).trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => part.length > 0);
}

function attemptStateErrors(value: unknown): string[] {
  if (!isRecord(value)) return ["QTI attempt state must be an object."];

  const schema = value.schema;
  if (schema !== ATTEMPT_STATE_SCHEMA) {
    return [`Unsupported QTI attempt state schema ${String(schema)}.`];
  }

  const errors: string[] = [];
  if (typeof value.itemIdentifier !== "string" || value.itemIdentifier.length === 0) {
    errors.push("QTI attempt state itemIdentifier must be a non-empty string.");
  }
  if (typeof value.status !== "string" || !ATTEMPT_STATUSES.has(value.status as QtiAttemptStatus)) {
    errors.push(`QTI attempt state status ${String(value.status)} is not supported.`);
  }
  if (!isQtiValueRecord(value.responses)) {
    errors.push("QTI attempt state responses must be a record of QTI values.");
  }
  if (!isQtiValueRecord(value.outcomes)) {
    errors.push("QTI attempt state outcomes must be a record of QTI values.");
  }
  if (value.templateValues !== undefined && !isQtiValueRecord(value.templateValues)) {
    errors.push("QTI attempt state templateValues must be a record of QTI values.");
  }
  if (
    value.interactionStates !== undefined &&
    !isPortableCustomStateRecord(value.interactionStates)
  ) {
    errors.push("QTI attempt state interactionStates must be a record of JSON values.");
  }
  if (!isDiagnosticArray(value.validationMessages)) {
    errors.push("QTI attempt state validationMessages must be an array of diagnostics.");
  }
  return errors;
}

function applyTemplateProcessing(
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
  responses: Record<string, QtiValue>,
  responseDefaults: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
  preservedTemplateIdentifiers = new Set<string>(),
  baseResponses: Record<string, QtiValue> = cloneValueRecord(responses),
  baseResponseDefaults: Record<string, QtiValue> = cloneValueRecord(responseDefaults),
  baseOutcomes: Record<string, QtiValue> = cloneValueRecord(outcomes),
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
      responseDefaults,
      outcomes,
      correctResponses,
      random,
      customOperators,
      preservedTemplateIdentifiers,
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
        resetRecord(responses, cloneValueRecord(baseResponses));
        resetRecord(responseDefaults, cloneValueRecord(baseResponseDefaults));
        resetRecord(outcomes, cloneValueRecord(baseOutcomes));
        resetCorrectResponses(document, correctResponses);
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

function resetCorrectResponses(
  document: QtiDocument,
  correctResponses: Record<string, QtiValue>,
): void {
  for (const declaration of document.item.responseDeclarations) {
    correctResponses[declaration.identifier] = cloneValue(declaration.correctResponse);
  }
}

function applyTemplateRule(
  rule: QtiTemplateRule,
  document: QtiDocument,
  templateValues: Record<string, QtiValue>,
  responses: Record<string, QtiValue>,
  responseDefaults: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
  preservedTemplateIdentifiers: Set<string>,
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
        responseDefaults,
        outcomes,
        correctResponses,
        random,
        customOperators,
        preservedTemplateIdentifiers,
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
    if (preservedTemplateIdentifiers.has(rule.identifier)) return false;
    templateValues[rule.identifier] = value;
    return false;
  }

  if (rule.type === "setDefaultValue") {
    const responseDeclaration = getResponseDeclaration(document, rule.identifier);
    if (responseDeclaration) {
      const normalized = normalizeValueForCardinality(value, responseDeclaration.cardinality);
      if (normalized === null) {
        delete responseDefaults[rule.identifier];
      } else {
        responseDefaults[rule.identifier] = normalized;
      }
      return false;
    }
    const outcomeDeclaration = document.item.outcomeDeclarations.find(
      (declaration) => declaration.identifier === rule.identifier,
    );
    if (outcomeDeclaration) {
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
  if (processing?.rules.length) {
    applyResponseRules(
      processing.rules,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return;
  }

  const templateKind = responseProcessingTemplateKind(processing?.template);
  if (templateKind === "unsupported") {
    return;
  }
  if (templateKind === "mapResponse" || templateKind === "mapResponsePoint") {
    const declaration = getResponseDeclaration(document, "RESPONSE");
    outcomes.SCORE = declaration
      ? mapOrMatchResponse(
          declaration,
          responses.RESPONSE ?? null,
          correctResponses.RESPONSE ?? null,
        )
      : 0;
    return;
  }

  if (templateKind === "matchCorrect") {
    const declaration = getResponseDeclaration(document, "RESPONSE");
    const matches = declaration
      ? qtiMatchValues(
          responses.RESPONSE ?? null,
          correctResponses.RESPONSE ?? null,
          declaration.cardinality === "ordered",
        )
      : null;
    outcomes.SCORE = matches === true ? 1 : 0;
  }
}

function responseProcessingTemplateKind(
  template: string | undefined,
): "matchCorrect" | "mapResponse" | "mapResponsePoint" | "unsupported" | undefined {
  if (!template) return undefined;
  const path = template.split(/[?#]/, 1)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.xml$/i, "");
  if (name === "match_correct") return "matchCorrect";
  if (name === "map_response") return "mapResponse";
  if (name === "map_response_point") return "mapResponsePoint";
  return "unsupported";
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
    if (rule.type === "responseCondition") {
      const shouldExit = applyResponseCondition(
        rule.condition,
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

function applyResponseCondition(
  condition: QtiResponseCondition,
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): boolean {
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
  return applyResponseRules(
    branch,
    document,
    responses,
    outcomes,
    templateValues,
    correctResponses,
    random,
    customOperators,
  );
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
  if (expression.type === "null") return null;
  if (expression.type === "isNull") return isNullResponse(responses[expression.identifier] ?? null);
  if (expression.type === "matchCorrect") {
    const declaration = getResponseDeclaration(document, expression.correctIdentifier);
    return declaration
      ? qtiMatchValues(
          responses[expression.identifier] ?? null,
          correctResponses[expression.correctIdentifier] ?? null,
          declaration.cardinality === "ordered",
        )
      : false;
  }
  if (expression.type === "match") {
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
    return qtiMatchValues(
      left,
      right,
      expressionIsOrdered(expression.left, document) ||
        expressionIsOrdered(expression.right, document),
    );
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
    const values = evaluateNumericOperands(
      expression.expressions,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return values ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  if (expression.type === "product") {
    const values = evaluateNumericOperands(
      expression.expressions,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return values ? values.reduce((product, value) => product * value, 1) : null;
  }
  if (expression.type === "min" || expression.type === "max") {
    const values = evaluateNumericOperands(
      expression.expressions,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (!values || values.length === 0) return null;
    return expression.type === "min" ? Math.min(...values) : Math.max(...values);
  }
  if (expression.type === "subtract") {
    const values = evaluateNumericOperands(
      [expression.left, expression.right],
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    return values && values.length === 2 ? values[0]! - values[1]! : null;
  }
  if (expression.type === "divide") {
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
    const dividend = numericValueOrNull(dividendValue);
    const divisor = numericValueOrNull(divisorValue);
    if (dividend === null || divisor === null || divisor === 0) return null;
    const quotient = dividend / divisor;
    return Number.isFinite(quotient) ? quotient : null;
  }
  if (expression.type === "power") {
    const values = evaluateNumericOperands(
      [expression.left, expression.right],
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (!values || values.length !== 2) return null;
    const value = Math.pow(values[0]!, values[1]!);
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
    const dividend = numericValueOrNull(dividendValue);
    const divisor = numericValueOrNull(divisorValue);
    if (dividend === null || divisor === null || divisor === 0) return null;
    return Math.floor(dividend / divisor);
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
    const dividend = numericValueOrNull(dividendValue);
    const divisor = numericValueOrNull(divisorValue);
    if (dividend === null || divisor === null || divisor === 0) return null;
    return dividend - Math.floor(dividend / divisor) * divisor;
  }
  if (expression.type === "round") {
    const value = numericValueOrNull(
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
    return value === null ? null : Math.round(value);
  }
  if (expression.type === "roundTo") {
    const value = numericValueOrNull(
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
    if (value === null) return null;
    return expression.roundingMode === "decimalPlaces"
      ? roundToDecimalPlaces(value, expression.figures)
      : roundToSignificantFigures(value, expression.figures);
  }
  if (expression.type === "truncate") {
    const value = numericValueOrNull(
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
    return value === null ? null : Math.trunc(value);
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
    return numericValueOrNull(value);
  }
  if (expression.type === "and") {
    let sawNull = false;
    for (const item of expression.expressions) {
      const value = booleanValueOrNull(
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
      if (value === false) return false;
      if (value === null) sawNull = true;
    }
    return sawNull ? null : true;
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
    let sawNull = false;
    for (const item of expression.expressions) {
      const value = booleanValueOrNull(
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
      if (value === true) return true;
      if (value === null) sawNull = true;
    }
    return sawNull ? null : false;
  }
  if (expression.type === "not") {
    const value = booleanValueOrNull(
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
    return value === null ? null : !value;
  }
  if (expression.type === "equal") {
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
    return left === null || right === null ? null : valuesEqual(left, right);
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
    const leftNumber = numericValueOrNull(left);
    const rightNumber = numericValueOrNull(right);
    if (leftNumber === null || rightNumber === null) return null;
    const roundedLeft = roundWithMode(leftNumber, expression.roundingMode, expression.figures);
    const roundedRight = roundWithMode(rightNumber, expression.roundingMode, expression.figures);
    return roundedLeft === null || roundedRight === null ? null : roundedLeft === roundedRight;
  }
  if (expression.type === "numericCompare") {
    const leftValue = evaluateValue(
      expression.left,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const rightValue = evaluateValue(
      expression.right,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (leftValue === null || rightValue === null) return null;
    const left = numericValueOrNull(leftValue);
    const right = numericValueOrNull(rightValue);
    if (left === null || right === null) return null;
    if (expression.operator === "lt") return left < right;
    if (expression.operator === "lte") return left <= right;
    if (expression.operator === "gt") return left > right;
    return left >= right;
  }
  if (expression.type === "durationCompare") {
    const leftValue = evaluateValue(
      expression.left,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const rightValue = evaluateValue(
      expression.right,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const left = durationSeconds(leftValue);
    const right = durationSeconds(rightValue);
    if (left === null || right === null) return null;
    return expression.operator === "lt" ? left < right : left >= right;
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
      return new RegExp(
        typeof patternValue === "string" ? patternValue : qtiValueToString(patternValue),
      ).test(qtiValueToString(value));
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
    if (value === null || collection === null) return null;
    const values = valueContainer(collection);
    return values.some((item) => valuesEqual(item, value));
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
    const collectionValue = evaluateValue(
      expression.collection,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (value === null || collectionValue === null) return null;
    const collection = valueContainer(collectionValue);
    if (collection.length === 0) return null;
    const filtered = collection.filter((item) => !valuesEqual(item, value));
    return filtered.length > 0 ? filtered : null;
  }
  if (expression.type === "contains") {
    const collectionValue = evaluateValue(
      expression.collection,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    const valuesValue = evaluateValue(
      expression.values,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (collectionValue === null || valuesValue === null) return null;
    const collection = valueContainer(collectionValue);
    const values = valueContainer(valuesValue);
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

function expressionIsOrdered(expression: QtiProcessingExpression, document: QtiDocument): boolean {
  if (expression.type === "ordered") return true;
  if (
    (expression.type === "variable" ||
      expression.type === "correct" ||
      expression.type === "default" ||
      expression.type === "isNull") &&
    variableCardinality(document, expression.identifier) === "ordered"
  ) {
    return true;
  }
  return false;
}

function variableCardinality(document: QtiDocument, identifier: string): string | undefined {
  return (
    document.item.responseDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.cardinality ??
    document.item.outcomeDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.cardinality ??
    document.item.templateDeclarations.find((declaration) => declaration.identifier === identifier)
      ?.cardinality
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
  const points = Array.isArray(response)
    ? response.map(qtiScalarToString)
    : response === null
      ? []
      : qtiValueToStringList(response);
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
  interactionStates: Record<string, QtiPortableCustomStateValue>,
  validationMessages: QtiDiagnostic[],
): QtiAttemptStateV1 {
  return {
    schema: ATTEMPT_STATE_SCHEMA,
    itemIdentifier,
    status,
    responses: cloneValueRecord(responses),
    outcomes: cloneValueRecord(outcomes),
    templateValues: cloneValueRecord(templateValues),
    interactionStates: clonePortableCustomStateRecord(interactionStates),
    validationMessages: cloneDiagnostics(validationMessages),
  };
}

function cloneValueRecord(record: Record<string, QtiValue>): Record<string, QtiValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]));
}

function clonePortableCustomStateRecord(
  record: Record<string, QtiPortableCustomStateValue>,
): Record<string, QtiPortableCustomStateValue> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, clonePortableCustomState(value)]),
  );
}

function cloneValue(value: QtiValue): QtiValue {
  if (Array.isArray(value)) return [...value];
  if (isRecordValue(value)) return cloneValueRecord(value);
  return value;
}

function clonePortableCustomState(value: QtiPortableCustomStateValue): QtiPortableCustomStateValue {
  if (Array.isArray(value)) return value.map(clonePortableCustomState);
  if (isPortableCustomStateObject(value)) return clonePortableCustomStateRecord(value);
  return value;
}

function cloneDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ? { ...diagnostic.source } : undefined,
  }));
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
  const score =
    response === null || isRecordValue(response)
      ? 0
      : (values[String(response)] ?? mapping.defaultValue);
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
    if (ordered)
      return actualValues.every((value, index) => scalarValuesEqual(value, expectedValues[index]!));
    const sortedExpected = [...expectedValues].sort(compareScalarValues);
    return [...actualValues]
      .sort(compareScalarValues)
      .every((value, index) => scalarValuesEqual(value, sortedExpected[index]!));
  }
  return scalarValuesEqual(actual, expected);
}

function qtiMatchValues(actual: QtiValue, expected: QtiValue, ordered = false): boolean | null {
  if (actual === null || expected === null) return null;
  return valuesEqual(actual, expected, ordered);
}

function scalarValuesEqual(actual: QtiValue, expected: QtiValue): boolean {
  if (typeof actual === "boolean" && typeof expected === "string") {
    return String(actual) === expected;
  }
  if (typeof actual === "string" && typeof expected === "boolean") {
    return actual === String(expected);
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

function isQtiValue(value: unknown): value is QtiValue {
  if (value === null) return true;
  if (isQtiScalarValue(value)) return true;
  if (Array.isArray(value)) return value.every(isQtiScalarValue);
  return isQtiValueRecord(value);
}

function isQtiScalarValue(value: unknown): value is QtiScalarValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isQtiValueRecord(value: unknown): value is Record<string, QtiValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isQtiValue);
}

function isPortableCustomState(value: unknown): value is QtiPortableCustomStateValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPortableCustomState);
  if (isRecord(value)) return Object.values(value).every(isPortableCustomState);
  return false;
}

function isPortableCustomStateObject(
  value: QtiPortableCustomStateValue,
): value is { [key: string]: QtiPortableCustomStateValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPortableCustomStateRecord(
  value: unknown,
): value is Record<string, QtiPortableCustomStateValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isPortableCustomState);
}

function isDiagnosticArray(value: unknown): value is QtiDiagnostic[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!isRecord(item)) return false;
    if (typeof item.code !== "string" || item.code.length === 0) return false;
    if (item.severity !== "info" && item.severity !== "warning" && item.severity !== "error") {
      return false;
    }
    if (typeof item.message !== "string" || item.message.length === 0) return false;
    return item.path === undefined || typeof item.path === "string";
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
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
  const numeric = numericValueOrNull(value);
  return numeric !== null && Number.isInteger(numeric) ? numeric : undefined;
}

function evaluateNumericOperands(
  expressions: QtiProcessingExpression[],
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
): number[] | null {
  const numericValues: number[] = [];
  for (const expression of expressions) {
    const value = evaluateValue(
      expression,
      document,
      responses,
      outcomes,
      templateValues,
      correctResponses,
      random,
      customOperators,
    );
    if (value === null || isRecordValue(value)) return null;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const numeric = numericValueOrNull(item);
      if (numeric === null) return null;
      numericValues.push(numeric);
    }
  }
  return numericValues;
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

function numericValueOrNull(value: QtiValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function durationSeconds(value: QtiValue): number | null {
  if (value === null || Array.isArray(value) || isRecordValue(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (raw.length === 0) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      raw,
    );
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) ? total : null;
}

function booleanValue(value: QtiValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0 && value !== "false";
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function booleanValueOrNull(value: QtiValue): boolean | null {
  if (value === null) return null;
  return booleanValue(value);
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
): boolean | null {
  if (left === null || right === null) return null;
  let actual = qtiValueToString(left);
  let expected = qtiValueToString(right);
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
