import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { assertSvCase } from "./shared-vocabulary-matrix/assertions.js";
import { loadSvMatrixItem } from "./shared-vocabulary-matrix/load.js";
import {
  sharedVocabularyManifest,
  SV_MATRIX_FIXTURE_ROOT,
} from "./shared-vocabulary-matrix/manifest.js";

const matrixEntries = sharedVocabularyManifest.filter(
  (entry) => entry.supportLevel !== "pass-through",
);

test.describe("shared vocabulary matrix", () => {
  test("has executable coverage for every non-pass-through manifest entry", async () => {
    const ids = matrixEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    const fixtureDirectory = join(process.cwd(), SV_MATRIX_FIXTURE_ROOT);
    const fixtureFiles = (await readdir(fixtureDirectory))
      .filter((name) => name.endsWith(".xml"))
      .map((name) => name.slice(0, -".xml".length))
      .sort();
    const manifestIds = [...ids].sort();
    expect(manifestIds).toEqual(fixtureFiles);

    for (const entry of matrixEntries) {
      expect(entry.fixturePath, entry.id).toBe(`${SV_MATRIX_FIXTURE_ROOT}/${entry.id}.xml`);
      expect(entry.assertions.length, entry.id).toBeGreaterThan(0);
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
});
