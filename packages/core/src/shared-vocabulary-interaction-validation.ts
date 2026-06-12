import {
  validateChoicesContainerWidthSharedVocabulary,
  validateMatchInteractionSharedVocabulary,
  validateRegistrySharedVocabularyClasses,
} from "./shared-vocabulary-registry-validation.js";
import {
  validateSharedVocabularyExtendedText,
  validateSharedVocabularyInputWidth,
  validateSharedVocabularyMediaPlayerControls,
} from "./shared-vocabulary-validation.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";

const SHARED_VOCABULARY_INTERACTION_TYPES = new Set<QtiInteraction["type"]>([
  "choice",
  "match",
  "gapMatch",
  "graphicGapMatch",
  "inlineChoice",
  "textEntry",
  "extendedText",
  "media",
  "order",
]);

export function validateInteractionSharedVocabulary(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  if (!SHARED_VOCABULARY_INTERACTION_TYPES.has(interaction.type)) return;

  const classNames = sharedClassNames(interaction.attributes);
  if (interaction.type === "media") {
    validateMediaInteractionSharedVocabulary(interaction, diagnostics);
    return;
  }

  if (interaction.type === "inlineChoice" || interaction.type === "textEntry") {
    validateInteractionInputWidthSharedVocabulary(interaction, classNames, diagnostics);
    return;
  }

  if (interaction.type === "extendedText") {
    diagnostics.push(
      ...validateSharedVocabularyExtendedText({
        classNames,
        subjectQtiName: interaction.qtiName,
        expectedLength: interaction.attributes["expected-length"],
        path: interaction.source?.path,
        source: interaction.source,
      }),
    );
    return;
  }

  if (
    interaction.type === "match" ||
    interaction.type === "gapMatch" ||
    interaction.type === "graphicGapMatch"
  ) {
    if (interaction.type === "match") {
      validateMatchInteractionSharedVocabulary(interaction, classNames, diagnostics);
    }
    validateRegistrySharedVocabularyClasses(interaction, classNames, diagnostics);
    validateChoicesContainerWidthSharedVocabulary(interaction, diagnostics);
    if (interaction.type === "gapMatch") {
      validateGapInputWidthSharedVocabulary(interaction, diagnostics);
    }
    return;
  }

  if (interaction.type === "order") {
    validateRegistrySharedVocabularyClasses(interaction, classNames, diagnostics);
    validateChoicesContainerWidthSharedVocabulary(interaction, diagnostics);
    return;
  }

  if (interaction.type === "choice") {
    validateRegistrySharedVocabularyClasses(interaction, classNames, diagnostics);
  }
}

function validateGapInputWidthSharedVocabulary(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  for (const gap of interaction.choices.filter((choice) => choice.qtiName === "qti-gap")) {
    diagnostics.push(
      ...validateSharedVocabularyInputWidth({
        classNames: sharedClassNames(gap.attributes),
        subjectQtiName: "qti-gap",
        path: gap.source?.path ?? interaction.source?.path,
        source: gap.source ?? interaction.source,
        conflictCode: "interaction.sharedVocabulary.gapInputWidthConflict",
        invalidCode: "interaction.sharedVocabulary.gapInputWidthInvalid",
      }),
    );
  }
}

function validateInteractionInputWidthSharedVocabulary(
  interaction: QtiInteraction,
  classNames: string[],
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push(
    ...validateSharedVocabularyInputWidth({
      classNames,
      subjectQtiName: interaction.qtiName,
      path: interaction.source?.path,
      source: interaction.source,
      conflictCode: "interaction.sharedVocabulary.inputWidthConflict",
      invalidCode: "interaction.sharedVocabulary.inputWidthInvalid",
    }),
  );
}

function validateMediaInteractionSharedVocabulary(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push(
    ...validateSharedVocabularyMediaPlayerControls({
      value: interaction.attributes["data-qti-media-player-controls"],
      subjectQtiName: interaction.qtiName,
      path: interaction.source?.path,
      source: interaction.source,
    }),
  );

  if (!interaction.object) return;
  diagnostics.push(
    ...validateSharedVocabularyMediaPlayerControls({
      value: interaction.object.attributes["data-qti-media-player-controls"],
      subjectQtiName: `${interaction.qtiName} media object`,
      path: interaction.object.source?.path ?? interaction.source?.path,
      source: interaction.object.source ?? interaction.source,
    }),
  );
}

function sharedClassNames(attributes: Record<string, string>): string[] {
  return (attributes.class ?? "").split(/\s+/).filter(Boolean);
}
