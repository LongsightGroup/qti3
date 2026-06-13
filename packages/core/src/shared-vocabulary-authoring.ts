import { SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS } from "./shared-vocabulary-generated-families.js";
import {
  SHARED_VOCABULARY_CHOICE_AND_ORDER_INTERACTIONS,
  SHARED_VOCABULARY_CHOICES_LAYOUT_INTERACTIONS,
  SHARED_VOCABULARY_MEDIA_INTERACTIONS,
  SHARED_VOCABULARY_SELECTION_PRESENTATION_INTERACTIONS,
} from "./shared-vocabulary-interaction-sets.js";
import {
  SHARED_VOCABULARY_CHOICES_POSITIONS,
  SHARED_VOCABULARY_CHOICES_STACKING,
  SHARED_VOCABULARY_LABEL_STYLES,
  SHARED_VOCABULARY_LABEL_SUFFIXES,
  SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS,
  SHARED_VOCABULARY_ORIENTATIONS,
  SHARED_VOCABULARY_SELECTION_TONES,
} from "./shared-vocabulary.js";
import type { QtiInteractionType } from "./types.js";

export type QtiSharedVocabularyFieldValue = string | number;

export type QtiSharedVocabularyStateValue =
  | QtiSharedVocabularyFieldValue
  | boolean
  | readonly string[]
  | undefined;

export type QtiSharedVocabularyState = Record<string, QtiSharedVocabularyStateValue>;

export type QtiSharedVocabularyAttributeValueType = "string" | "number" | "token-list";

export function parsePositiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export type QtiSharedVocabularyField =
  | {
      kind: "class-value";
      id: string;
      classPrefix: string;
      values: readonly QtiSharedVocabularyFieldValue[];
      interactions: readonly QtiInteractionType[];
      precedence: "value-order" | "class-order";
    }
  | {
      kind: "class-fixed";
      id: string;
      className: string;
      interactions: readonly QtiInteractionType[];
    }
  | {
      kind: "attribute";
      id: string;
      attributeName: string;
      interactions: readonly QtiInteractionType[];
      values?: readonly string[] | undefined;
      valueType?: QtiSharedVocabularyAttributeValueType | undefined;
      numberMinimum?: number | undefined;
      numberExclusiveMinimum?: number | undefined;
    };

const choiceAndOrder = SHARED_VOCABULARY_CHOICE_AND_ORDER_INTERACTIONS;
const choicesLayoutInteractions = SHARED_VOCABULARY_CHOICES_LAYOUT_INTERACTIONS;
const selectionPresentationInteractions = SHARED_VOCABULARY_SELECTION_PRESENTATION_INTERACTIONS;
const mediaInteraction = SHARED_VOCABULARY_MEDIA_INTERACTIONS;

export const sharedVocabularyInteractionFields: readonly QtiSharedVocabularyField[] = [
  {
    kind: "class-value",
    id: "labels-style",
    classPrefix: "qti-labels-",
    values: SHARED_VOCABULARY_LABEL_STYLES,
    interactions: choiceAndOrder,
    precedence: "value-order",
  },
  {
    kind: "class-value",
    id: "labels-suffix",
    classPrefix: "qti-labels-suffix-",
    values: SHARED_VOCABULARY_LABEL_SUFFIXES,
    interactions: choiceAndOrder,
    precedence: "value-order",
  },
  {
    kind: "class-value",
    id: "orientation",
    classPrefix: "qti-orientation-",
    values: SHARED_VOCABULARY_ORIENTATIONS,
    interactions: choiceAndOrder,
    precedence: "value-order",
  },
  {
    kind: "class-value",
    id: "choices-stacking",
    classPrefix: "qti-choices-stacking-",
    values: SHARED_VOCABULARY_CHOICES_STACKING,
    interactions: ["choice"],
    precedence: "class-order",
  },
  {
    kind: "class-value",
    id: "choices-position",
    classPrefix: "qti-choices-",
    values: SHARED_VOCABULARY_CHOICES_POSITIONS,
    interactions: choicesLayoutInteractions,
    precedence: "class-order",
  },
  {
    kind: "class-value",
    id: "selections-tone",
    classPrefix: "qti-selections-",
    values: SHARED_VOCABULARY_SELECTION_TONES,
    interactions: selectionPresentationInteractions,
    precedence: "value-order",
  },
  {
    kind: "class-value",
    id: "writing-orientation",
    classPrefix: "qti-writing-orientation-",
    values: SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS,
    interactions: ["choice", "inlineChoice"],
    precedence: "value-order",
  },
  {
    kind: "class-fixed",
    id: "input-control-hidden",
    className: "qti-input-control-hidden",
    interactions: ["choice", "hottext"],
  },
  {
    kind: "class-fixed",
    id: "unselected-hidden",
    className: "qti-unselected-hidden",
    interactions: selectionPresentationInteractions,
  },
  {
    kind: "class-fixed",
    id: "match-tabular",
    className: "qti-match-tabular",
    interactions: ["match"],
  },
  {
    kind: "class-fixed",
    id: "header-hidden",
    className: "qti-header-hidden",
    interactions: ["match"],
  },
  {
    kind: "class-fixed",
    id: "gap-placement",
    className: "qti-gap-placement",
    interactions: ["gapMatch"],
  },
  {
    kind: "attribute",
    id: "choices-container-width",
    attributeName: "data-choices-container-width",
    valueType: "number",
    numberExclusiveMinimum: 0,
    interactions: choicesLayoutInteractions,
  },
  {
    kind: "attribute",
    id: "first-column-header",
    attributeName: "data-first-column-header",
    interactions: ["match"],
  },
  {
    kind: "attribute",
    id: "media-player-controls",
    attributeName: "data-qti-media-player-controls",
    values: SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS,
    valueType: "token-list",
    interactions: mediaInteraction,
  },
  {
    kind: "attribute",
    id: "media-player-pause-delay",
    attributeName: "data-qti-media-player-pause-delay",
    valueType: "number",
    numberMinimum: 0,
    interactions: mediaInteraction,
  },
  {
    kind: "attribute",
    id: "media-player-pause-duration",
    attributeName: "data-qti-media-player-pause-duration",
    valueType: "number",
    numberMinimum: 0,
    interactions: mediaInteraction,
  },
];

export function sharedVocabularyFieldsForInteraction(
  interaction: QtiInteractionType,
): readonly QtiSharedVocabularyField[] {
  return sharedVocabularyInteractionFields.filter((field) =>
    field.interactions.includes(interaction),
  );
}

export function sharedVocabularyFieldById(id: string): QtiSharedVocabularyField | undefined {
  return sharedVocabularyInteractionFields.find((field) => field.id === id);
}

export function sharedVocabularyFixedClassName(fieldId: string): string | undefined {
  const field = sharedVocabularyFieldById(fieldId);
  return field?.kind === "class-fixed" ? field.className : undefined;
}

export function parseSharedVocabularyClasses(
  className: string,
  interaction?: QtiInteractionType,
): QtiSharedVocabularyState {
  const classNames = className.split(/\s+/).filter(Boolean);
  const classNameSet = new Set(classNames);
  const state: QtiSharedVocabularyState = {};

  for (const field of fieldsForInteractionFilter(interaction)) {
    if (field.kind === "attribute") continue;
    if (field.kind === "class-fixed") {
      if (classNameSet.has(field.className)) state[field.id] = true;
      continue;
    }

    const value = parseClassValueField(field, classNames);
    if (value !== undefined) state[field.id] = value;
  }

  return state;
}

export function serializeSharedVocabularyClassNames(
  state: QtiSharedVocabularyState,
  interaction?: QtiInteractionType,
): string[] {
  const classNames: string[] = [];

  for (const field of fieldsForInteractionFilter(interaction)) {
    if (field.kind === "attribute") continue;
    const value = state[field.id];
    if (field.kind === "class-fixed") {
      if (value === true) classNames.push(field.className);
      continue;
    }
    if (isOmittedStateValue(value)) continue;
    if (!isAllowedFieldValue(field.values, value)) continue;
    classNames.push(`${field.classPrefix}${String(value)}`);
  }

  return classNames;
}

export function parseSharedVocabularyAttributes(
  attrs: Record<string, string | undefined>,
  interaction?: QtiInteractionType,
): QtiSharedVocabularyState {
  const state: QtiSharedVocabularyState = {};

  for (const field of fieldsForInteractionFilter(interaction)) {
    if (field.kind !== "attribute") continue;
    const value = attrs[field.attributeName];
    if (value === undefined || value === "") continue;
    const parsed = parseAttributeValue(field, value);
    if (parsed !== undefined) state[field.id] = parsed;
  }

  return state;
}

export function serializeSharedVocabularyAttributes(
  state: QtiSharedVocabularyState,
  interaction?: QtiInteractionType,
): Record<string, string> {
  const attrs: Record<string, string> = {};

  for (const field of fieldsForInteractionFilter(interaction)) {
    if (field.kind !== "attribute") continue;
    const value = state[field.id];
    if (isOmittedStateValue(value)) continue;
    const serialized = serializeAttributeValue(field, value);
    if (serialized !== undefined) attrs[field.attributeName] = serialized;
  }

  return attrs;
}

function fieldsForInteractionFilter(
  interaction: QtiInteractionType | undefined,
): readonly QtiSharedVocabularyField[] {
  return interaction === undefined
    ? sharedVocabularyInteractionFields
    : sharedVocabularyFieldsForInteraction(interaction);
}

export function sharedVocabularyClassNamesForField(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
): string[] {
  return field.values.map((value) => `${field.classPrefix}${String(value)}`);
}

export function matchedSharedVocabularyClassNames(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  classNames: readonly string[],
): string[] {
  const matched: string[] = [];
  for (const className of classNames) {
    if (parseClassValue(field, className) !== undefined) matched.push(className);
  }
  return matched;
}

export function describeSharedVocabularyPrecedence(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  matchedClassNames: readonly string[],
): string {
  const matched = new Set(matchedClassNames);
  if (field.precedence === "class-order") {
    const ordered = matchedClassNames.filter((className) => matched.has(className));
    if (ordered.length < 2) return `${ordered[0] ?? "The first matching class"} takes precedence`;
    const [first, ...rest] = ordered;
    return `${first} takes precedence over ${rest.join(", then ")}`;
  }

  const ordered = sharedVocabularyClassNamesForField(field).filter((className) =>
    matched.has(className),
  );
  if (ordered.length < 2) return `${ordered[0] ?? "The first matching class"} takes precedence`;
  const [first, ...rest] = ordered;
  return `${first} takes precedence over ${rest.join(", then ")}`;
}

export function formatSharedVocabularyClassValueRange(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
): string {
  const classNames = sharedVocabularyClassNamesForField(field);
  if (classNames.length <= 1) return classNames[0] ?? "";
  return `${classNames[0]} through ${classNames[classNames.length - 1]}`;
}

function parseClassValueField(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  classNames: string[],
): QtiSharedVocabularyFieldValue | undefined {
  if (field.precedence === "class-order") {
    for (const className of classNames) {
      const value = parseClassValue(field, className);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  for (const value of field.values) {
    const className = `${field.classPrefix}${String(value)}`;
    if (classNames.includes(className)) return value;
  }
  return undefined;
}

export function parseClassValue(
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  className: string,
): QtiSharedVocabularyFieldValue | undefined {
  if (!className.startsWith(field.classPrefix)) return undefined;
  const suffix = className.slice(field.classPrefix.length);
  for (const value of field.values) {
    if (String(value) === suffix) return value;
  }
  return undefined;
}

function parseAttributeValue(
  field: Extract<QtiSharedVocabularyField, { kind: "attribute" }>,
  value: string,
): QtiSharedVocabularyStateValue {
  if (field.valueType === "token-list") {
    const allowed = new Set(field.values ?? []);
    const tokens = value.split(/\s+/).filter((token) => allowed.has(token));
    return tokens.length > 0 ? [...new Set(tokens)] : undefined;
  }

  if (field.valueType === "number") {
    const parsed = Number(value);
    return isValidRegistryNumber(field, parsed) ? parsed : undefined;
  }

  if (field.values !== undefined && !field.values.includes(value)) return undefined;
  return value;
}

function serializeAttributeValue(
  field: Extract<QtiSharedVocabularyField, { kind: "attribute" }>,
  value: QtiSharedVocabularyStateValue,
): string | undefined {
  if (field.valueType === "token-list") {
    const values = Array.isArray(value) ? value : String(value).split(/\s+/);
    const allowed = new Set(field.values ?? []);
    const tokens = values.filter((token): token is string => allowed.has(String(token)));
    return tokens.length > 0 ? [...new Set(tokens)].join(" ") : undefined;
  }

  if (field.valueType === "number") {
    if (typeof value !== "number") return undefined;
    return isValidRegistryNumber(field, value) ? String(value) : undefined;
  }

  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const serialized = String(value);
  if (field.values !== undefined && !field.values.includes(serialized)) return undefined;
  return serialized;
}

function isValidRegistryNumber(
  field: Extract<QtiSharedVocabularyField, { kind: "attribute" }>,
  value: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  const minimum = field.numberMinimum ?? Number.NEGATIVE_INFINITY;
  const exclusiveMinimum = field.numberExclusiveMinimum;
  return value >= minimum && (exclusiveMinimum === undefined || value > exclusiveMinimum);
}

function isAllowedFieldValue(
  values: readonly QtiSharedVocabularyFieldValue[],
  value: QtiSharedVocabularyStateValue,
): value is QtiSharedVocabularyFieldValue {
  return values.some((allowed) => allowed === value);
}

function isOmittedStateValue(value: QtiSharedVocabularyStateValue): boolean {
  return (
    value === undefined ||
    value === false ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
