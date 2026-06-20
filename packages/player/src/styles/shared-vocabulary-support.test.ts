import { sharedVocabularyClassSupport } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { PLAYER_STYLES } from "../player-styles.js";

function authoredSharedVocabularyClasses(css: string): string[] {
  return [...css.matchAll(/\.((?:qti-(?!3)[A-Za-z0-9_-]+))/g)]
    .map((match) => match[1])
    .filter((className): className is string => className !== undefined);
}

describe("shared vocabulary support metadata", () => {
  it("covers authored qti-* classes shipped in player CSS", () => {
    const supportedClassNames = new Set(
      sharedVocabularyClassSupport.map((support) => support.className),
    );
    const cssClassNames = [...new Set(authoredSharedVocabularyClasses(PLAYER_STYLES))].toSorted();

    expect(cssClassNames.length).toBeGreaterThan(0);
    expect([...supportedClassNames].toSorted()).toEqual(expect.arrayContaining(cssClassNames));
  });
});
