import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { sharedVocabularyClassSupport } from "../../packages/core/src/shared-vocabulary-support.js";
import { isEnforcedSharedVocabularyLevel } from "../../packages/core/src/shared-vocabulary-levels.js";
import { assertSvCase } from "./shared-vocabulary-matrix/assertions.js";
import { findSharedVocabularyCoverageViolations } from "./shared-vocabulary-matrix/coverage-policy.js";
import { loadSvMatrixItem } from "./shared-vocabulary-matrix/load.js";
import { scorePlayerAttempt } from "./player-test-api.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import {
  sharedVocabularyManifest,
  SV_MATRIX_FIXTURE_ROOT,
} from "./shared-vocabulary-matrix/manifest.js";

const matrixEntries = sharedVocabularyManifest.filter((entry) =>
  isEnforcedSharedVocabularyLevel(entry.supportLevel),
);
const matrixTestPath = "tests/browser/player-shared-vocabulary.spec.ts";

function classNames(className: string | string[]): string[] {
  return Array.isArray(className) ? className : [className];
}

test.describe("shared vocabulary matrix", () => {
  test("covers every gated shared vocabulary support class", () => {
    const matrixClasses = new Set(matrixEntries.flatMap((entry) => classNames(entry.className)));
    const violations = findSharedVocabularyCoverageViolations({
      matrixClasses,
      support: sharedVocabularyClassSupport,
      matrixTestPath,
    });
    expect(violations.map((violation) => violation.message)).toEqual([]);
  });

  test("has executable coverage for every non-pass-through manifest entry", async () => {
    const ids = matrixEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    const fixtureDirectory = join(process.cwd(), SV_MATRIX_FIXTURE_ROOT);
    const fixtureFiles = (await readdir(fixtureDirectory))
      .filter((name) => name.endsWith(".xml"))
      .map((name) => name.slice(0, -".xml".length))
      .toSorted();
    const manifestIds = [...ids].toSorted();
    expect(manifestIds).toEqual(fixtureFiles);

    for (const entry of matrixEntries) {
      expect(entry.fixturePath, entry.id).toBe(`${SV_MATRIX_FIXTURE_ROOT}/${entry.id}.xml`);
      expect(entry.assertions.length, entry.id).toBeGreaterThan(0);
      const xml = await readFile(join(process.cwd(), entry.fixturePath), "utf8");
      for (const className of classNames(entry.className)) {
        expect(xml, `${entry.id} fixture should author ${className}`).toContain(className);
      }
      if (entry.forcedColors) {
        expect(
          entry.assertions.some((assertion) => assertion.type === "forced-colors-active"),
          entry.id,
        ).toBe(true);
      }
    }
  });

  for (const entry of matrixEntries) {
    test(entry.id, async ({ page }) => {
      await loadSvMatrixItem(page, entry);
      await assertSvCase(page, entry.assertions);
    });
  }

  test("width 5 renders at five character units and accepts a longer response", async ({
    page,
  }) => {
    const entry = matrixEntries.find((item) => item.id === "interaction-input-width-five");
    if (!entry) throw new Error("Missing width-5 matrix fixture");
    await loadSvMatrixItem(page, entry);
    const input = page.locator('[data-response-identifier="RESPONSE"] input');
    const widths = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      const reference = document.createElement("span");
      reference.style.font = style.font;
      reference.style.position = "absolute";
      reference.style.inlineSize = "5ch";
      document.body.append(reference);
      const fiveCharacters = reference.getBoundingClientRect().width;
      reference.remove();
      return { actual: element.getBoundingClientRect().width, fiveCharacters };
    });
    expect(Math.abs(widths.actual - widths.fiveCharacters)).toBeLessThan(1);
    await expect(input).not.toHaveAttribute("maxlength");
    await input.focus();
    await page.keyboard.type("planet");
    await page.keyboard.press("Tab");
    await expect(input).toHaveValue("planet");
    const scored = await scorePlayerAttempt(page);
    expect(scored?.diagnostics).toEqual([]);
    expect(scored?.state.responses.RESPONSE).toBe("planet");
    expect(scored?.outcomes.SCORE).toBe(1);
    await expectNoAxeViolationsOnPlayer(page);
  });

  test("gallery exposes every non-pass-through manifest entry", async ({ page }) => {
    await page.goto("/sv-gallery");
    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-item-body, .qti3-interaction").first()).toBeVisible();

    for (const entry of matrixEntries) {
      await expect(page.locator(`[data-case-id="${entry.id}"]`)).toHaveCount(1);
    }

    for (const entry of matrixEntries.filter((item) => !item.forcedColors)) {
      await page.goto(`/sv-gallery?case=${encodeURIComponent(entry.id)}`);
      const caseRoot = page.locator(".main");
      await expect(caseRoot).toHaveAttribute("data-selected-case-id", entry.id, {
        timeout: 15_000,
      });
      await expect(caseRoot).toHaveAttribute("data-case-status", "ready", { timeout: 15_000 });
      await expect(page.locator("#case-title")).toHaveText(entry.id);
      await expect(player.locator(".qti3-item-body, .qti3-interaction").first()).toBeVisible();
      await expect(page.locator(".assertion-row")).toHaveCount(entry.assertions.length);
      await expect(page.locator(".status").filter({ hasText: "Running" })).toHaveCount(0, {
        timeout: 15_000,
      });
    }
  });
});
