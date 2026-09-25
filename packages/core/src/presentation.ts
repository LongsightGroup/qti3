import { parseQtiPresentationDefinition } from "./presentation-definition.js";
import { seededRandom } from "./processing-random.js";
import { qtiValueToString } from "./value-format.js";
import type {
  QtiAssessmentItem,
  QtiChoice,
  QtiDiagnostic,
  QtiInteraction,
  QtiValue,
} from "./types.js";

/** Resolved presentation orders, independent of responses and processing RNG state. */
export interface QtiPresentationStateV1 {
  readonly schema: "qti3.presentation.v1";
  readonly orders: Readonly<Record<string, readonly string[]>>;
}

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
  const value = templateValues[template] ?? null;
  const contains = Array.isArray(value)
    ? value.map(String).includes(choice.identifier)
    : qtiValueToString(value) === choice.identifier;
  return choice.attributes["show-hide"] === "hide" ? !contains : contains;
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
  const interactions = item.interactions.map((interaction, interactionIndex) => {
    const definition = parseQtiPresentationDefinition(interaction);
    if (!definition.ok) {
      diagnostics.push(...definition.diagnostics);
      return interaction;
    }
    let projectedChoices = interaction.choices.filter((choice) =>
      visibleChoice(choice, templateValues),
    );
    const visibleIdentifiers = new Set(projectedChoices.map((choice) => choice.identifier));
    // Hidden hottext retains its passage text, but cannot be selected.
    const hottextSegments = interaction.hottextSegments?.map((segment) =>
      segment.kind === "hottext" && !visibleIdentifiers.has(segment.identifier)
        ? { kind: "text" as const, text: segment.text }
        : segment,
    );
    for (const group of definition.groups) {
      const key = `${interactionIndex}:${interaction.type}:${interaction.responseIdentifier ?? ""}:${group.name}`;
      const choices = group.choices.filter((choice) => visibleChoice(choice, templateValues));
      const byIdentifier = new Map(choices.map((choice) => [choice.identifier, choice]));
      const fail = (message: string) =>
        diagnostics.push({
          code: "presentation.order.invalid",
          severity: "error",
          message,
          source: interaction.source,
          path: interaction.source?.path,
        });
      let order: readonly string[];
      if (input.kind === "restore") {
        const saved = restored?.orders[key];
        if (!saved) {
          fail(`Missing saved presentation order for ${key}.`);
          continue;
        }
        order = saved;
      } else {
        if (input.seed === undefined) {
          fail(`A presentationSeed is required to shuffle ${key}.`);
          continue;
        }
        if (typeof input.seed === "number" && !Number.isFinite(input.seed)) {
          fail("presentationSeed must be finite.");
          continue;
        }
        // Each group owns a stream; render order and processing cannot consume it.
        order = shuffled(choices, group.fixedIdentifiers, seededRandom(`${input.seed}:${key}`));
      }
      if (
        byIdentifier.size !== choices.length ||
        order.length !== choices.length ||
        new Set(order).size !== order.length ||
        order.some((identifier) => !byIdentifier.has(identifier)) ||
        choices.some(
          (choice, index) =>
            group.fixedIdentifiers.has(choice.identifier) && order[index] !== choice.identifier,
        )
      ) {
        fail(`Saved or authored choices do not form a valid presentation permutation for ${key}.`);
        continue;
      }
      orders[key] = [...order];
      const ordered = order.flatMap((identifier) => {
        const choice = byIdentifier.get(identifier);
        return choice ? [choice] : [];
      });
      const groupIdentifiers = new Set(group.choices.map((choice) => choice.identifier));
      let index = 0;
      projectedChoices = projectedChoices.flatMap((choice) => {
        if (!groupIdentifiers.has(choice.identifier)) return [choice];
        const next = ordered[index++];
        return next ? [next] : [];
      });
    }
    return { ...interaction, choices: projectedChoices, hottextSegments };
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
