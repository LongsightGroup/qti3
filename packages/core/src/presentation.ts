import {
  type QtiPresentationGroupDefinition,
  parseQtiPresentationDefinition,
} from "./presentation-definition.js";
import { seededRandom } from "./processing-random.js";
import { identifierIsVisible } from "./identifier-visibility.js";
import type {
  QtiPresentationStateV1,
  QtiAssessmentItem,
  QtiChoice,
  QtiDiagnostic,
  QtiInteraction,
  QtiValue,
} from "./types.js";

/** Presentation initialization either succeeds completely or reports typed failures. */
export type QtiPresentationResult =
  | {
      readonly ok: true;
      readonly state: QtiPresentationStateV1;
      readonly interactions: readonly QtiInteraction[];
    }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Fresh sessions require an explicit seed when shuffling; restore requires saved orders. */
export type QtiPresentationInput =
  | { readonly kind: "new"; readonly seed: string | number | undefined }
  | { readonly kind: "restore"; readonly state: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks the JSON shape; item-specific permutation checks happen during preparation. */
export function isQtiPresentationStateV1(value: unknown): value is QtiPresentationStateV1 {
  return (
    isRecord(value) &&
    value.schema === "qti3.presentation.v1" &&
    isRecord(value.orders) &&
    Object.values(value.orders).every(
      (order) =>
        Array.isArray(order) && order.every((identifier) => typeof identifier === "string"),
    )
  );
}

/** Copies every order so callers cannot mutate a session through serialized state. */
export function cloneQtiPresentationState(state: QtiPresentationStateV1): QtiPresentationStateV1 {
  return {
    schema: state.schema,
    orders: Object.fromEntries(
      Object.entries(state.orders).map(([key, order]) => [key, [...order]]),
    ),
  };
}

function visibleChoice(
  choice: QtiChoice,
  templateValues: Readonly<Record<string, QtiValue>>,
): boolean {
  const template = choice.attributes["template-identifier"];
  if (!template) return true;
  return identifierIsVisible(
    choice.identifier,
    templateValues[template] ?? null,
    choice.attributes["show-hide"],
  );
}

function shuffled(
  choices: readonly QtiChoice[],
  fixed: ReadonlySet<string>,
  random: () => number,
): string[] {
  const movable = choices
    .filter((choice) => !fixed.has(choice.identifier))
    .map((choice) => choice.identifier);
  for (let index = movable.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const left = movable[index];
    const right = movable[other];
    if (left !== undefined && right !== undefined) {
      movable[index] = right;
      movable[other] = left;
    }
  }
  let index = 0;
  return choices.map((choice) =>
    fixed.has(choice.identifier) ? choice.identifier : (movable[index++] ?? choice.identifier),
  );
}

/** Builds immutable-in-session orders after template processing, without touching scoring data. */
export function prepareQtiPresentation(
  item: QtiAssessmentItem,
  templateValues: Readonly<Record<string, QtiValue>>,
  input: QtiPresentationInput,
): QtiPresentationResult {
  const diagnostics: QtiDiagnostic[] = [];
  const orders: Record<string, readonly string[]> = {};
  const restored =
    input.kind === "restore" && isQtiPresentationStateV1(input.state) ? input.state : undefined;
  if (input.kind === "restore" && input.state !== undefined && !restored) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "presentation.state.invalid",
          severity: "error",
          message: "Invalid QTI presentation state.",
        },
      ],
    };
  }
  const definitions = item.interactions.map(parseQtiPresentationDefinition);
  const needsShuffle = definitions.some(
    (definition) => definition.ok && definition.groups.length > 0,
  );
  if (
    input.kind === "new" &&
    needsShuffle &&
    (input.seed === undefined || (typeof input.seed === "number" && !Number.isFinite(input.seed)))
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "presentation.order.invalid",
          severity: "error",
          message:
            input.seed === undefined
              ? "A presentationSeed is required to shuffle choices."
              : "presentationSeed must be finite.",
        },
      ],
    };
  }
  const interactions = item.interactions.map((interaction, interactionIndex) => {
    const definition = definitions[interactionIndex];
    if (!definition) return interaction;
    if (!definition.ok) {
      diagnostics.push(...definition.diagnostics);
      return interaction;
    }
    let projected = projectVisibleChoices(interaction, templateValues);
    for (const group of definition.groups) {
      const key = `${interactionIndex}:${interaction.type}:${interaction.responseIdentifier ?? ""}:${group.name}`;
      const choices = group.choices.filter((choice) => visibleChoice(choice, templateValues));
      const resolved = resolveGroupOrder(group, choices, key, input, restored);
      if (!resolved.ok) {
        diagnostics.push({
          code: "presentation.order.invalid",
          severity: "error",
          message: resolved.message,
          source: interaction.source,
          path: interaction.source?.path,
        });
        continue;
      }
      const order = resolved.order;
      orders[key] = [...order];
      projected = applyGroupOrder(projected, group, order);
    }
    return projected;
  });
  if (restored && Object.keys(restored.orders).some((key) => !Object.hasOwn(orders, key))) {
    diagnostics.push({
      code: "presentation.state.incompatible",
      severity: "error",
      message: "Saved presentation contains an unknown or incompatible choice group.",
    });
  }
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, state: { schema: "qti3.presentation.v1", orders }, interactions };
}

function projectVisibleChoices(
  interaction: QtiInteraction,
  templateValues: Readonly<Record<string, QtiValue>>,
): QtiInteraction {
  const projectedChoices = interaction.choices.filter((choice) =>
    visibleChoice(choice, templateValues),
  );
  const visibleIdentifiers = new Set(projectedChoices.map((choice) => choice.identifier));
  // Hidden hottext retains its passage text, but cannot be selected.
  const hottextSegments = interaction.hottextSegments?.map((segment) =>
    segment.kind === "hottext" && !visibleIdentifiers.has(segment.identifier)
      ? { kind: "text" as const, text: segment.text }
      : segment,
  );

  return { ...interaction, choices: projectedChoices, hottextSegments };
}

function resolveGroupOrder(
  group: QtiPresentationGroupDefinition,
  choices: readonly QtiChoice[],
  key: string,
  input: QtiPresentationInput,
  restored: QtiPresentationStateV1 | undefined,
): { ok: true; order: readonly string[] } | { ok: false; message: string } {
  // Each group owns a stream; rendering and scoring cannot consume it.
  const order =
    input.kind === "restore"
      ? restored?.orders[key]
      : shuffled(choices, group.fixedIdentifiers, seededRandom(`${input.seed}:${key}`));
  if (!order) return { ok: false, message: `Missing saved presentation order for ${key}.` };
  const identifiers = new Set(choices.map((choice) => choice.identifier));
  if (
    identifiers.size !== choices.length ||
    order.length !== choices.length ||
    new Set(order).size !== order.length ||
    order.some((identifier) => !identifiers.has(identifier)) ||
    choices.some(
      (choice, index) =>
        group.fixedIdentifiers.has(choice.identifier) && order[index] !== choice.identifier,
    )
  ) {
    return {
      ok: false,
      message: `Saved or authored choices do not form a valid presentation permutation for ${key}.`,
    };
  }
  return { ok: true, order };
}

function applyGroupOrder(
  interaction: QtiInteraction,
  group: QtiPresentationGroupDefinition,
  order: readonly string[],
): QtiInteraction {
  const byIdentifier = new Map(interaction.choices.map((choice) => [choice.identifier, choice]));
  const groupIdentifiers = new Set(group.choices.map((choice) => choice.identifier));
  let index = 0;
  const choices = interaction.choices.flatMap((choice) => {
    if (!groupIdentifiers.has(choice.identifier)) return [choice];
    const identifier = order[index++];
    const next = identifier === undefined ? undefined : byIdentifier.get(identifier);
    return next ? [next] : [];
  });
  return { ...interaction, choices };
}
