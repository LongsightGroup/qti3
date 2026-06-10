import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);

export interface AxeRunResult {
  violations: unknown[];
}

declare global {
  interface Window {
    axe?: {
      run: (context: Element | null) => Promise<AxeRunResult>;
    };
  }
}

let cachedAxeSource: string | undefined;

async function axeSource(): Promise<string> {
  cachedAxeSource ??= await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  return cachedAxeSource;
}

export async function installAxe(page: Page): Promise<void> {
  const installed = await page.evaluate(() => Boolean(window.axe));
  if (installed) return;
  await page.addScriptTag({ content: await axeSource() });
}

export async function runAxeOnPlayer(page: Page): Promise<AxeRunResult> {
  await installAxe(page);
  return page.evaluate(async () => {
    if (!window.axe) throw new Error("axe-core is not installed on the page.");
    return window.axe.run(document.querySelector("qti-assessment-item-player"));
  });
}

export async function expectNoAxeViolationsOnPlayer(page: Page, label?: string): Promise<void> {
  const result = await runAxeOnPlayer(page);
  expect(result.violations, label).toEqual([]);
}

export async function expectQuestionItemRendered(page: Page): Promise<void> {
  await expect(
    page
      .locator(
        "qti-assessment-item-player .qti3-item-body, qti-assessment-item-player .qti3-interaction",
      )
      .first(),
  ).toBeVisible();
}
