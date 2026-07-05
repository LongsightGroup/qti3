import {
  describeSharedVocabularyPrecedence,
  formatSharedVocabularyClassValueRange,
  matchedSharedVocabularyClassNames,
  parseClassValue,
  parseSharedVocabularyAttributes,
  sharedVocabularyFieldById,
  sharedVocabularyFieldsForInteraction,
  sharedVocabularyFixedClassName,
  type QtiSharedVocabularyField,
} from "./shared-vocabulary-authoring.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";

const LEGACY_CLASS_VALUE_CONFLICT_CODES: Record<string, string> = {
  "labels-style": "interaction.sharedVocabulary.labelsConflict",
  "labels-suffix": "interaction.sharedVocabulary.labelSuffixConflict",
  orientation: "interaction.sharedVocabulary.orientationConflict",
  "choices-stacking": "interaction.sharedVocabulary.stackingConflict",
  "choices-position": "interaction.sharedVocabulary.orderChoicesPositionConflict",
};

const LEGACY_CLASS_VALUE_INVALID_CODES: Record<string, string> = {
  "choices-stacking": "interaction.sharedVocabulary.stackingInvalid",
};

export function validateRegistrySharedVocabularyClasses(
  interaction: QtiInteraction,
  classNames: string[],
  diagnostics: QtiDiagnostic[],
): void {
  for (const field of sharedVocabularyFieldsForInteraction(interaction.type)) {
    if (field.kind !== "class-value") continue;
    validateClassValueFieldConflicts(interaction, field, classNames, diagnostics);
    validateUnsupportedClassValueClasses(interaction, field, classNames, diagnostics);
  }
}

function validateClassValueFieldConflicts(
  interaction: QtiInteraction,
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  classNames: string[],
  diagnostics: QtiDiagnostic[],
): void {
  const matched = matchedSharedVocabularyClassNames(field, classNames);
  if (new Set(matched).size <= 1) return;

  diagnostics.push({
    code: classValueConflictCode(field.id),
    severity: "warning",
    message: conflictMessage(interaction, field, matched),
    path: interaction.source?.path,
    source: interaction.source,
  });
}

function classValueConflictCode(fieldId: string): string {
  return (
    LEGACY_CLASS_VALUE_CONFLICT_CODES[fieldId] ??
    `interaction.sharedVocabulary.${fieldIdToDiagnosticSuffix(fieldId)}Conflict`
  );
}

function classValueInvalidCode(fieldId: string): string {
  return (
    LEGACY_CLASS_VALUE_INVALID_CODES[fieldId] ??
    `interaction.sharedVocabulary.${fieldIdToDiagnosticSuffix(fieldId)}Invalid`
  );
}

function fieldIdToDiagnosticSuffix(fieldId: string): string {
  return fieldId.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function conflictMessage(
  interaction: QtiInteraction,
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  matchedClassNames: string[],
): string {
  const uniqueMatched = [...new Set(matchedClassNames)];
  const precedence = describeSharedVocabularyPrecedence(field, uniqueMatched);

  switch (field.id) {
    case "labels-style":
      return `${interaction.qtiName} should not include multiple qti-labels-* style classes: ${uniqueMatched.join(", ")}. ${precedence} at runtime.`;
    case "labels-suffix":
      return `${interaction.qtiName} should not include multiple qti-labels-suffix-* classes: ${uniqueMatched.join(", ")}. ${precedence} at runtime.`;
    case "orientation":
      return `${interaction.qtiName} should not include both qti-orientation-horizontal and qti-orientation-vertical; ${precedence} at runtime.`;
    case "choices-stacking":
      return `qti-choice-interaction should not include multiple qti-choices-stacking-* classes: ${uniqueMatched.join(", ")}. The first valid stacking class in class attribute order takes precedence at runtime.`;
    case "choices-position":
      return `${interaction.qtiName} should not include multiple qti-choices-* position classes: ${uniqueMatched.join(", ")}. The first position class in class attribute order takes precedence at runtime.`;
    default:
      return `${interaction.qtiName} should not include multiple ${field.classPrefix}* classes: ${uniqueMatched.join(", ")}. ${precedence} at runtime.`;
  }
}

function validateUnsupportedClassValueClasses(
  interaction: QtiInteraction,
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  classNames: string[],
  diagnostics: QtiDiagnostic[],
): void {
  const classValueFields = sharedVocabularyFieldsForInteraction(interaction.type).filter(
    (candidate): candidate is Extract<QtiSharedVocabularyField, { kind: "class-value" }> =>
      candidate.kind === "class-value",
  );
  for (const className of classNames) {
    if (!className.startsWith(field.classPrefix)) continue;
    if (parseClassValue(field, className) !== undefined) continue;
    if (isSupportedBySiblingClassValueField(classValueFields, field, className)) continue;
    diagnostics.push({
      code: classValueInvalidCode(field.id),
      severity: "warning",
      message: unsupportedClassValueMessage(interaction, field, className),
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
}

function isSupportedBySiblingClassValueField(
  fields: readonly Extract<QtiSharedVocabularyField, { kind: "class-value" }>[],
  currentField: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  className: string,
): boolean {
  return fields.some(
    (field) => field.id !== currentField.id && parseClassValue(field, className) !== undefined,
  );
}

function unsupportedClassValueMessage(
  interaction: QtiInteraction,
  field: Extract<QtiSharedVocabularyField, { kind: "class-value" }>,
  className: string,
): string {
  if (field.id === "choices-stacking") {
    return `qti-choice-interaction shared vocabulary class ${className} is not supported; expected ${formatSharedVocabularyClassValueRange(field)}.`;
  }
  return `${interaction.qtiName} shared vocabulary class ${className} is not supported; expected ${formatSharedVocabularyClassValueRange(field)}.`;
}

export function validateChoicesContainerWidthSharedVocabulary(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  const width = interaction.attributes["data-choices-container-width"];
  if (width === undefined) return;
  const parsed = parseSharedVocabularyAttributes(
    { "data-choices-container-width": width },
    interaction.type,
  )["choices-container-width"];
  if (parsed !== undefined) return;
  diagnostics.push({
    code: "interaction.sharedVocabulary.orderChoicesContainerWidth",
    severity: "warning",
    message: `${interaction.qtiName} data-choices-container-width must be a positive pixel value; the invalid value is ignored at runtime.`,
    path: interaction.source?.path,
    source: interaction.source,
  });
}

export function validateMatchInteractionSharedVocabulary(
  interaction: QtiInteraction,
  classNames: string[],
  diagnostics: QtiDiagnostic[],
): void {
  const matchTabularClass = sharedVocabularyFixedClassName("match-tabular");
  const headerHiddenClass = sharedVocabularyFixedClassName("header-hidden");
  const hasTabular =
    matchTabularClass === undefined ? false : classNames.includes(matchTabularClass);
  const hasHeaderHidden =
    headerHiddenClass === undefined ? false : classNames.includes(headerHiddenClass);
  const firstColumnHeader = interaction.attributes["data-first-column-header"];
  if (!hasTabular && (hasHeaderHidden || firstColumnHeader !== undefined)) {
    diagnostics.push({
      code: "interaction.sharedVocabulary.matchTabularContext",
      severity: "warning",
      message:
        "qti-match-interaction shared vocabulary class qti-header-hidden and data-first-column-header are only relevant when qti-match-tabular is specified; they are ignored at runtime.",
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
  if (hasTabular && hasHeaderHidden && firstColumnHeader !== undefined) {
    diagnostics.push({
      code: "interaction.sharedVocabulary.matchTabularHeaderHidden",
      severity: "warning",
      message:
        "qti-match-interaction data-first-column-header is ignored when qti-header-hidden suppresses the tabular header row.",
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
  if (!hasTabular) return;

  const choicesPositionField = sharedVocabularyFieldById("choices-position");
  const choicesPositionClasses =
    choicesPositionField?.kind === "class-value"
      ? matchedSharedVocabularyClassNames(choicesPositionField, classNames)
      : [];
  if (
    choicesPositionClasses.length > 0 ||
    interaction.attributes["data-choices-container-width"] !== undefined
  ) {
    diagnostics.push({
      code: "interaction.sharedVocabulary.matchTabularChoicesConflict",
      severity: "warning",
      message:
        "qti-match-interaction qti-match-tabular uses a matrix layout; qti-choices-* position classes and data-choices-container-width are ignored at runtime.",
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
  if (!hasHeaderHidden && (firstColumnHeader === undefined || firstColumnHeader === "")) {
    diagnostics.push({
      code: "interaction.sharedVocabulary.matchTabularFirstColumnHeader",
      severity: "warning",
      message:
        "qti-match-interaction with qti-match-tabular should specify data-first-column-header for the top-left table header when the tabular header row is shown.",
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
}
