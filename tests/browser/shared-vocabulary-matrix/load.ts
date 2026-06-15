import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, type Page } from "@playwright/test";
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
  const player = page.locator("qti-assessment-item-player");
  await expect(player).toBeVisible();
  await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
  await player.evaluate(async (element, itemXml) => {
    await (element as HTMLElement & { loadXml(xml: string): Promise<void> }).loadXml(itemXml);
  }, xml);
  await expect(player.locator(".qti3-item-body, .qti3-interaction").first()).toBeVisible();
}
