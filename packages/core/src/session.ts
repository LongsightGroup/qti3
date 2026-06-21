import type {
  QtiAssessmentItem,
  QtiAttemptStatus,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiModalFeedback,
  QtiPortableCustomStateValue,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseRule,
  QtiScoreResult,
  QtiTemplateRule,
  QtiValue,
} from "./types.js";
import { qtiValueToString } from "./value-format.js";
import type { QtiCustomOperatorRegistry } from "./custom-operators.js";
export type {
  QtiCustomOperatorContext,
  QtiCustomOperatorHandler,
  QtiCustomOperatorRegistry,
} from "./custom-operators.js";
import { createEvaluationContext, type EvaluationContext } from "./processing-evaluator.js";
import { seededRandom } from "./processing-random.js";
import { getResponseDeclaration } from "./processing-variables.js";
import { lookupOutcomeValue, mapOrMatchResponse } from "./processing-mapping.js";
import { responseProcessingTemplateKind } from "./processing-templates.js";
import { assertCompatiblePriorState } from "./attempt-state.js";
export { assertQtiAttemptStateV1, isQtiAttemptStateV1 } from "./attempt-state.js";
import {
  COMPLETION_COMPLETED,
  COMPLETION_NOT_ATTEMPTED,
  COMPLETION_STATUS,
  COMPLETION_UNKNOWN,
} from "./attempt-state-constants.js";
import {
  cloneDiagnostics,
  clonePortableCustomState,
  clonePortableCustomStateRecord,
  cloneValue,
  cloneValueRecord,
  serialize,
} from "./processing-state.js";
import { booleanValue, normalizeValueForCardinality, qtiMatchValues } from "./processing-values.js";

interface SessionProcessingContext {
  responseDefaults: Record<string, QtiValue>;
  evaluation: EvaluationContext;
}

interface ConditionalRules<Rule> {
  ifExpression?: QtiProcessingExpression | undefined;
  thenRules: Rule[];
  elseIfs: Array<{
    expression?: QtiProcessingExpression | undefined;
    rules: Rule[];
  }>;
  elseRules: Rule[];
}

export interface QtiItemSessionOptions {
  randomSeed?: string | number | undefined;
  customOperators?: QtiCustomOperatorRegistry | undefined;
  allowedUndeclaredResponseIdentifiers?: readonly string[] | undefined;
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
  const allowedUndeclaredResponseIdentifiers = new Set(
    options.allowedUndeclaredResponseIdentifiers ?? [],
  );
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
  const evaluation = createEvaluationContext(
    document,
    responses,
    outcomes,
    templateValues,
    correctResponses,
    random,
    customOperators,
    { allowedUndeclaredResponseIdentifiers },
  );
  const processingContext: SessionProcessingContext = {
    responseDefaults,
    evaluation,
  };

  applyTemplateProcessing(
    processingContext,
    new Set(),
    baseResponses,
    baseResponseDefaults,
    baseOutcomes,
  );
  if (priorState) {
    Object.assign(templateValues, priorTemplateValues);
    resetCorrectResponses(document, correctResponses);
    applyTemplateProcessing(
      processingContext,
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
      applyResponseProcessing(processingContext);
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

function resetRecord<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}

function applyTemplateProcessing(
  context: SessionProcessingContext,
  preservedTemplateIdentifiers = new Set<string>(),
  baseResponses: Record<string, QtiValue> = cloneValueRecord(context.evaluation.responses),
  baseResponseDefaults: Record<string, QtiValue> = cloneValueRecord(context.responseDefaults),
  baseOutcomes: Record<string, QtiValue> = cloneValueRecord(context.evaluation.outcomes),
): void {
  const { evaluation } = context;
  const rules = evaluation.document.item.templateProcessing?.rules ?? [];
  let restarts = 0;
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]!;
    const shouldExit = applyTemplateRule(context, rule, preservedTemplateIdentifiers);
    if (shouldExit) return;
    if (rule.type === "templateConstraint") {
      const satisfied = evaluateProcessingBoolean(context, rule.expression);
      if (!satisfied) {
        resetTemplateValues(evaluation.document, evaluation.templateValues);
        resetRecord(evaluation.responses, cloneValueRecord(baseResponses));
        resetRecord(context.responseDefaults, cloneValueRecord(baseResponseDefaults));
        resetRecord(evaluation.outcomes, cloneValueRecord(baseOutcomes));
        resetCorrectResponses(evaluation.document, evaluation.correctResponses);
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

function evaluateProcessingBoolean(
  context: SessionProcessingContext,
  expression: QtiResponseCondition["ifExpression"],
): boolean {
  return expression ? booleanValue(context.evaluation.evaluate(expression)) : false;
}

function resolveConditionalRules<Rule>(
  context: SessionProcessingContext,
  condition: ConditionalRules<Rule>,
): Rule[] {
  if (evaluateProcessingBoolean(context, condition.ifExpression)) return condition.thenRules;
  for (const elseIf of condition.elseIfs) {
    if (evaluateProcessingBoolean(context, elseIf.expression)) return elseIf.rules;
  }
  return condition.elseRules;
}

function applyTemplateRule(
  context: SessionProcessingContext,
  rule: QtiTemplateRule,
  preservedTemplateIdentifiers: Set<string>,
): boolean {
  const { evaluation } = context;
  if (rule.type === "exitTemplate") return true;
  if (rule.type === "templateConstraint") return false;

  if (rule.type === "templateCondition") {
    const branch = resolveConditionalRules(context, rule);
    for (const branchRule of branch) {
      const shouldExit = applyTemplateRule(context, branchRule, preservedTemplateIdentifiers);
      if (shouldExit) return true;
    }
    return false;
  }

  const value = evaluation.evaluate(rule.expression);
  if (rule.type === "setTemplateValue") {
    if (preservedTemplateIdentifiers.has(rule.identifier)) return false;
    evaluation.templateValues[rule.identifier] = value;
    return false;
  }

  if (rule.type === "setDefaultValue") {
    const responseDeclaration = getResponseDeclaration(evaluation.document, rule.identifier);
    if (responseDeclaration) {
      const normalized = normalizeValueForCardinality(value, responseDeclaration.cardinality);
      if (normalized === null) {
        delete context.responseDefaults[rule.identifier];
      } else {
        context.responseDefaults[rule.identifier] = normalized;
      }
      return false;
    }
    const outcomeDeclaration = evaluation.document.item.outcomeDeclarations.find(
      (declaration) => declaration.identifier === rule.identifier,
    );
    if (outcomeDeclaration) {
      evaluation.outcomes[rule.identifier] = value;
    }
    return false;
  }

  const declaration = getResponseDeclaration(evaluation.document, rule.identifier);
  if (declaration)
    evaluation.correctResponses[rule.identifier] = normalizeValueForCardinality(
      value,
      declaration.cardinality,
    );
  return false;
}

function applyResponseProcessing(context: SessionProcessingContext): void {
  const { evaluation } = context;
  const processing = evaluation.document.item.responseProcessing;
  if (processing?.rules.length) {
    applyResponseRules(context, processing.rules);
    return;
  }

  const templateKind = processing?.template
    ? (responseProcessingTemplateKind(processing.template) ?? "unsupported")
    : undefined;
  if (templateKind === "unsupported") {
    return;
  }
  if (templateKind === "mapResponse" || templateKind === "mapResponsePoint") {
    const declaration = getResponseDeclaration(evaluation.document, "RESPONSE");
    evaluation.outcomes.SCORE = declaration
      ? mapOrMatchResponse(
          declaration,
          evaluation.responses.RESPONSE ?? null,
          evaluation.correctResponses.RESPONSE ?? null,
        )
      : 0;
    return;
  }

  if (templateKind === "matchCorrect") {
    const declaration = getResponseDeclaration(evaluation.document, "RESPONSE");
    const matches = declaration
      ? qtiMatchValues(
          evaluation.responses.RESPONSE ?? null,
          evaluation.correctResponses.RESPONSE ?? null,
          declaration.cardinality === "ordered",
        )
      : null;
    evaluation.outcomes.SCORE = matches === true ? 1 : 0;
  }
}

function applyResponseRules(context: SessionProcessingContext, rules: QtiResponseRule[]): boolean {
  const { evaluation } = context;
  for (const rule of rules) {
    if (rule.type === "exitResponse") return true;
    if (rule.type === "responseCondition") {
      const shouldExit = applyResponseCondition(context, rule.condition);
      if (shouldExit) return true;
      continue;
    }
    if (rule.type === "responseProcessingFragment") {
      const shouldExit = applyResponseRules(context, rule.rules);
      if (shouldExit) return true;
      continue;
    }
    if (rule.type === "lookupOutcomeValue") {
      evaluation.outcomes[rule.identifier] = lookupOutcomeValue(
        evaluation.document,
        rule.identifier,
        evaluation.evaluate(rule.expression),
      );
      continue;
    }
    evaluation.outcomes[rule.identifier] = evaluation.evaluate(rule.expression);
  }
  return false;
}

function applyResponseCondition(
  context: SessionProcessingContext,
  condition: QtiResponseCondition,
): boolean {
  return applyResponseRules(context, resolveConditionalRules(context, condition));
}
