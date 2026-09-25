import { cloneQtiPresentationState } from "./presentation.js";
import type {
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiPortableCustomStateValue,
  QtiValue,
} from "./types.js";
import { ATTEMPT_STATE_SCHEMA } from "./attempt-state-constants.js";
import { isRecordValue } from "./value-guards.js";

/** Snapshot session state without retaining mutable records owned by the session. */
export function serialize(state: Omit<QtiAttemptStateV1, "schema">): QtiAttemptStateV1 {
  const {
    itemIdentifier,
    status,
    responses,
    outcomes,
    templateValues = {},
    interactionStates = {},
    validationMessages,
    builtInVariables,
    presentation,
    templateProcessing,
  } = state;
  return {
    schema: ATTEMPT_STATE_SCHEMA,
    ...(templateProcessing === undefined
      ? {}
      : {
          templateProcessing: {
            schema: templateProcessing.schema,
            seed: templateProcessing.seed,
            environment: {
              numAttempts: templateProcessing.environment.numAttempts,
              duration: templateProcessing.environment.duration,
              context: { ...templateProcessing.environment.context },
            },
          },
        }),
    ...(presentation === undefined
      ? {}
      : { presentation: cloneQtiPresentationState(presentation) }),
    ...(builtInVariables === undefined
      ? {}
      : { builtInVariables: { ...builtInVariables, context: { ...builtInVariables.context } } }),
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
