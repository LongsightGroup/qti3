/** One named response variable in record or array wire form. */
export interface QtiNamedResponseInput {
  identifier: string;
  value: unknown;
}

export type QtiNamedResponsesInput =
  | Record<string, unknown>
  | readonly QtiNamedResponseInput[]
  | undefined;

/** Normalize record or array response payloads into a stable entry list. */
export function listNamedResponseInputs(
  responses: QtiNamedResponsesInput,
): readonly QtiNamedResponseInput[] {
  if (!responses) return [];
  if (Array.isArray(responses)) return responses;
  return Object.entries(responses).map(([identifier, value]) => ({ identifier, value }));
}
