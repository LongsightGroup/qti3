import type {
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiDiagnostic,
  QtiDocument,
  QtiPortableCustomStateValue,
  QtiScalarValue,
  QtiValue,
  QtiVariableDeclaration,
} from "./types.js";
import {
  ATTEMPT_STATE_SCHEMA,
  COMPLETION_COMPLETED,
  COMPLETION_NOT_ATTEMPTED,
  COMPLETION_STATUS,
  COMPLETION_UNKNOWN,
} from "./attempt-state-constants.js";
import { isQtiPortableCustomStateValue, isQtiValue, qtiValueToString } from "./value-format.js";
import { parseXmlBoolean } from "./parser-values.js";
import { isRecordValue } from "./processing-values.js";
import { isPair, isPoint } from "./validation-primitives.js";

export function isQtiAttemptStateV1(value: unknown): value is QtiAttemptStateV1 {
  return attemptStateErrors(value).length === 0;
}

export function assertQtiAttemptStateV1(value: unknown): asserts value is QtiAttemptStateV1 {
  const [firstError] = attemptStateErrors(value);
  if (firstError) throw new Error(firstError);
}

export function assertCompatiblePriorState(
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
  if (baseType === "boolean") {
    if (typeof value === "boolean") return true;
    if (typeof value === "string") return parseXmlBoolean(value) !== undefined;
    return false;
  }
  if (baseType === "point") return isPoint(String(value));
  if (baseType === "pair" || baseType === "directedPair") return isPair(String(value));
  if (baseType === "identifier")
    return typeof value === "string" && value.trim().length > 0 && !/\s/.test(value);
  return typeof value === "string";
}

function isAttemptStatus(value: string): value is QtiAttemptStatus {
  return (
    value === "initialized" ||
    value === "interacting" ||
    value === "suspended" ||
    value === "completed"
  );
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
  if (typeof value.status !== "string" || !isAttemptStatus(value.status)) {
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

function isQtiValueRecord(value: unknown): value is Record<string, QtiValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isQtiValue);
}

function isPortableCustomStateRecord(
  value: unknown,
): value is Record<string, QtiPortableCustomStateValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isQtiPortableCustomStateValue);
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
