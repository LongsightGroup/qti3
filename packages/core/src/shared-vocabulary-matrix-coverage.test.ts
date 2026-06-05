import { describe, expect, it } from "vitest";
import {
  matrixCoverageFamilyForClass,
  SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS,
  SHARED_VOCABULARY_CONTENT_ALIGNMENTS,
  SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES,
  SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES,
  SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES,
  SHARED_VOCABULARY_CONTENT_VALIGNS,
  SHARED_VOCABULARY_CONTENT_WRITING_MODES,
  SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT,
  SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT,
  sharedVocabularyMatrixCoverageFamilies,
} from "./shared-vocabulary-generated-families.js";
import { sharedVocabularyClassSupport } from "./shared-vocabulary-support.js";
import { isEnforcedSharedVocabularyLevel } from "./shared-vocabulary-levels.js";

describe("shared vocabulary matrix coverage families", () => {
  it("uses unique family ids", () => {
    const ids = sharedVocabularyMatrixCoverageFamilies.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches each enforced stylesheet class with at most one family at that level", () => {
    const enforcedStylesheetClasses = sharedVocabularyClassSupport
      .filter((support) => isEnforcedSharedVocabularyLevel(support.level))
      .map((support) => ({ className: support.className, level: support.level }));

    for (const { className, level } of enforcedStylesheetClasses) {
      const matches = sharedVocabularyMatrixCoverageFamilies.filter(
        (family) => family.levels.includes(level) && family.matches(className),
      );
      expect(matches.length, className).toBeLessThanOrEqual(1);
    }
  });

  it("resolves generated stylesheet classes through the family registry", () => {
    expect(matrixCoverageFamilyForClass("qti-layout-col3", "stylesheet")?.id).toBe(
      "content-layout-generated-column-variants",
    );
    expect(matrixCoverageFamilyForClass("qti-text-indent-8", "stylesheet")?.id).toBe(
      "content-text-indent-generated-variants",
    );
    expect(matrixCoverageFamilyForClass("qti-underline", "stylesheet")).toBeUndefined();
  });

  it("matches every generated layout column class", () => {
    for (let span = 1; span <= SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT; span += 1) {
      for (const className of [`qti-layout-col${span}`, `qti-layout-col-${span}`]) {
        expect(matrixCoverageFamilyForClass(className, "stylesheet")?.id).toBe(
          "content-layout-generated-column-variants",
        );
      }
    }
  });

  it("matches every generated layout offset class", () => {
    for (let offset = 1; offset <= SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT; offset += 1) {
      for (const className of [`qti-layout-offset${offset}`, `qti-layout-offset-${offset}`]) {
        expect(matrixCoverageFamilyForClass(className, "stylesheet")?.id).toBe(
          "content-layout-generated-offset-variants",
        );
      }
    }
  });

  it("matches every generated text-indent and list-style class", () => {
    for (const suffix of SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES) {
      expect(matrixCoverageFamilyForClass(`qti-text-indent-${suffix}`, "stylesheet")?.id).toBe(
        "content-text-indent-generated-variants",
      );
    }
    for (const styleType of SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES) {
      expect(
        matrixCoverageFamilyForClass(`qti-list-style-type-${styleType}`, "stylesheet")?.id,
      ).toBe("content-list-style-generated-variants");
    }
  });

  it("matches every generated alignment, writing-mode, float, and choice-orientation class", () => {
    for (const alignment of SHARED_VOCABULARY_CONTENT_ALIGNMENTS) {
      expect(matrixCoverageFamilyForClass(`qti-align-${alignment}`, "stylesheet")?.id).toBe(
        "content-alignment-variants",
      );
    }
    for (const alignment of SHARED_VOCABULARY_CONTENT_VALIGNS) {
      expect(matrixCoverageFamilyForClass(`qti-valign-${alignment}`, "stylesheet")?.id).toBe(
        "content-alignment-variants",
      );
    }
    for (const mode of SHARED_VOCABULARY_CONTENT_WRITING_MODES) {
      expect(matrixCoverageFamilyForClass(`qti-writing-mode-${mode}`, "stylesheet")?.id).toBe(
        "content-writing-mode-generated-variants",
      );
    }
    for (const floatClass of SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES) {
      expect(matrixCoverageFamilyForClass(`qti-float-${floatClass}`, "stylesheet")?.id).toBe(
        "content-float-generated-variants",
      );
    }
    for (const orientation of SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS) {
      expect(
        matrixCoverageFamilyForClass(`qti-writing-orientation-${orientation}`, "stylesheet")?.id,
      ).toBe("choice-writing-orientation-generated-variants");
    }
  });
});
