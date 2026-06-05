import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { pasteXml } from "../player-helpers.js";
import type { SharedVocabularyManifestEntry } from "./types.js";

export async function loadSvMatrixItem(
  page: Page,
  entry: SharedVocabularyManifestEntry,
): Promise<void> {
  await page.emulateMedia({ forcedColors: entry.forcedColors ? "active" : "none" });
  await page.goto("/");
  const fixturePath = isAbsolute(entry.fixturePath)
    ? entry.fixturePath
    : join(process.cwd(), entry.fixturePath);
  const xml = await readFile(fixturePath, "utf8").catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Missing shared vocabulary fixture for ${entry.id}: ${entry.fixturePath}. ${message}`,
    );
  });
  await pasteXml(page, xml);
  await expect(page.locator("qti-assessment-item-player .qti3-item-body")).toBeVisible();
}
