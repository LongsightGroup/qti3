import { describe, expect, it } from "vitest";
import { sharedVocabularyClassSupport } from "@longsightgroup/qti3-core";
import { findSharedVocabularyCoverageViolations } from "./coverage-policy.js";
import { sharedVocabularyManifest } from "./manifest.js";
import { isEnforcedSharedVocabularyLevel } from "./types.js";

const matrixTestPath = "tests/browser/player-shared-vocabulary.spec.ts";

function classNames(className: string | string[]): string[] {
  return Array.isArray(className) ? className : [className];
}

describe("shared vocabulary matrix coverage policy", () => {
  it("re-exports the core policy implementation", async () => {
    const corePolicy =
      await import("../../../packages/core/src/shared-vocabulary-coverage-policy.js");
    expect(findSharedVocabularyCoverageViolations).toBe(
      corePolicy.findSharedVocabularyCoverageViolations,
    );
  });

  it("reports no violations for the current manifest and support metadata", () => {
    const matrixClasses = new Set(
      sharedVocabularyManifest
        .filter((entry) => isEnforcedSharedVocabularyLevel(entry.supportLevel))
        .flatMap((entry) => classNames(entry.className)),
    );
    const violations = findSharedVocabularyCoverageViolations({
      matrixClasses,
      support: sharedVocabularyClassSupport,
      matrixTestPath,
    });
    expect(violations).toEqual([]);
  });
});
