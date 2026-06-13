import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import type { QtiDiagnostic } from "./types.js";
import { validateRegistrySharedVocabularyClasses } from "./shared-vocabulary-registry-validation.js";

function interaction(
  type: Parameters<typeof testInteraction>[0]["type"],
  attributes: Record<string, string> = {},
) {
  return testInteraction({ type, attributes });
}

describe("shared vocabulary registry validation", () => {
  it("diagnoses registry-driven class-value conflicts", () => {
    const diagnostics: QtiDiagnostic[] = [];
    const classNames = [
      "qti-labels-none",
      "qti-labels-decimal",
      "qti-orientation-horizontal",
      "qti-orientation-vertical",
      "qti-choices-stacking-2",
      "qti-choices-stacking-4",
      "qti-choices-stacking-6",
    ];

    validateRegistrySharedVocabularyClasses(
      interaction("choice", { class: classNames.join(" ") }),
      classNames,
      diagnostics,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "interaction.sharedVocabulary.labelsConflict",
        "interaction.sharedVocabulary.orientationConflict",
        "interaction.sharedVocabulary.stackingConflict",
        "interaction.sharedVocabulary.stackingInvalid",
      ]),
    );
  });

  it("diagnoses registry class-value conflicts for uncovered class-value fields", () => {
    const diagnostics: QtiDiagnostic[] = [];
    validateRegistrySharedVocabularyClasses(
      interaction("choice", { class: "qti-selections-dark qti-selections-light" }),
      ["qti-selections-dark", "qti-selections-light"],
      diagnostics,
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "interaction.sharedVocabulary.selectionsToneConflict",
        message: expect.stringContaining("qti-selections-light takes precedence"),
      }),
    ]);
  });
});
