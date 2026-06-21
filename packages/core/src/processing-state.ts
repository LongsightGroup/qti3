import type {
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiDiagnostic,
  QtiPortableCustomStateValue,
  QtiValue,
} from "./types.js";
import { ATTEMPT_STATE_SCHEMA } from "./attempt-state-constants.js";
import { isRecordValue } from "./processing-values.js";

export function serialize(
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

export function cloneValueRecord(record: Record<string, QtiValue>): Record<string, QtiValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]));
}

export function clonePortableCustomStateRecord(
  record: Record<string, QtiPortableCustomStateValue>,
): Record<string, QtiPortableCustomStateValue> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, clonePortableCustomState(value)]),
  );
}

export function cloneValue(value: QtiValue): QtiValue {
  if (Array.isArray(value)) return [...value];
  if (isRecordValue(value)) return cloneValueRecord(value);
  return value;
}

export function clonePortableCustomState(
  value: QtiPortableCustomStateValue,
): QtiPortableCustomStateValue {
  if (Array.isArray(value)) return value.map(clonePortableCustomState);
  if (isPortableCustomStateObject(value)) return clonePortableCustomStateRecord(value);
  return value;
}

function isPortableCustomStateObject(
  value: QtiPortableCustomStateValue,
): value is { [key: string]: QtiPortableCustomStateValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ? { ...diagnostic.source } : undefined,
  }));
}
