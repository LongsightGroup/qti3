import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { isEnforcedSharedVocabularyLevel } from "../../packages/core/src/shared-vocabulary-levels.js";
import { allQuestionItemFixtures } from "../../packages/fixtures/src/index.js";
import {
  expectNoAxeViolationsOnPlayer,
  expectQuestionItemRendered,
  installAxe,
} from "./axe-helpers.js";
import { expectResponse, loadFixture, pasteXml } from "./player-helpers.js";
import { loadSvMatrixItem } from "./shared-vocabulary-matrix/load.js";
import { sharedVocabularyManifest } from "./shared-vocabulary-matrix/manifest.js";

const sharedVocabularyMatrixEntries = sharedVocabularyManifest.filter((entry) =>
  isEnforcedSharedVocabularyLevel(entry.supportLevel),
);

test.describe("player axe accessibility", () => {
  test.describe("canonical question item fixtures", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await installAxe(page);
    });

    for (const fixture of allQuestionItemFixtures) {
      test(fixture.id, async ({ page }) => {
        await pasteXml(page, fixture.xml);
        await expectQuestionItemRendered(page);
        await expectNoAxeViolationsOnPlayer(page, fixture.id);
      });
    }
  });

  test.describe("extended text XHTML matrix item", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await installAxe(page);
    });

    test("extended-text-xhtml", async ({ page }) => {
      const xml = await readFile(
        join(process.cwd(), "packages/fixtures/packages/sv-matrix/items/extended-text-xhtml.xml"),
        "utf8",
      );
      await pasteXml(page, xml);
      await expectQuestionItemRendered(page);
      await expectNoAxeViolationsOnPlayer(page, "extended-text-xhtml");
    });
  });

  test.describe("shared vocabulary matrix items", () => {
    for (const entry of sharedVocabularyMatrixEntries) {
      test(entry.id, async ({ page }) => {
        await loadSvMatrixItem(page, entry);
        await expectNoAxeViolationsOnPlayer(page, entry.id);
      });
    }
  });

  test("covers every packaged question item fixture", () => {
    expect(allQuestionItemFixtures.map((fixture) => fixture.id)).toEqual([
      ...new Set(allQuestionItemFixtures.map((fixture) => fixture.id)),
    ]);
    expect(allQuestionItemFixtures.length).toBeGreaterThan(0);
  });

  test("covers every enforced shared vocabulary matrix item", () => {
    const ids = sharedVocabularyMatrixEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });
  test("renders under forced colors and reduced motion preferences", async ({ page }) => {
    await page.emulateMedia({
      colorScheme: "dark",
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await page.goto("/");
    await installAxe(page);
    await loadFixture(page, "choice");

    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    );
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await expectResponse(page, "A");

    await expectNoAxeViolationsOnPlayer(page);
  });
});
