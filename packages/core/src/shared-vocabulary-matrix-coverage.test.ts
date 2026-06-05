import { describe, expect, it } from "vitest";
import {
  matrixCoverageFamilyForClass,
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
});
