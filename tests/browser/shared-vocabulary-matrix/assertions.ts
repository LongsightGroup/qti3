import { expect, type Page } from "@playwright/test";
import { SV_ASSERTION_CORE_URL } from "./evaluate-url.js";
import type { SharedVocabularyAssertion } from "./types.js";

export async function assertSvCase(
  page: Page,
  assertions: SharedVocabularyAssertion[],
): Promise<void> {
  for (const assertion of assertions) {
    await assertSvAssertion(page, assertion);
  }
}

async function assertSvAssertion(page: Page, assertion: SharedVocabularyAssertion): Promise<void> {
  switch (assertion.type) {
    case "aria-snapshot-contains": {
      const snapshot = await page.locator(assertion.selector).ariaSnapshot();
      expect(snapshot).toContain(assertion.text);
      return;
    }
    case "click":
      await page.locator(assertion.selector).click();
      return;
    case "focus":
      await page.locator(assertion.selector).focus();
      await expect(page.locator(assertion.selector)).toBeFocused();
      return;
    case "forced-colors-active":
      await expect
        .poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches))
        .toBe(true);
      return;
    case "key":
      await page.keyboard.press(assertion.key);
      return;
    case "attribute":
    case "attribute-absent":
    case "class-preserved":
    case "computed-style":
    case "computed-style-differs":
    case "computed-style-not":
    case "computed-style-number":
    case "computed-style-same":
    case "dom-order":
    case "element-count":
    case "hidden-focusable-input":
    case "inline-style":
    case "layout-not-clipped":
    case "layout-same-row":
    case "layout-width":
    case "layout-width-ratio":
    case "position":
    case "set-attribute":
    case "text":
    case "validation-message":
      await runDelegatedAssertion(page, assertion);
      return;
  }
}

async function runDelegatedAssertion(
  page: Page,
  assertion: SharedVocabularyAssertion,
): Promise<void> {
  await page.evaluate(
    async ({ assertion: item, coreUrl }) => {
      const { runAssertionInRoot: run } = await import(coreUrl);
      await run(document, item);
    },
    { assertion, coreUrl: SV_ASSERTION_CORE_URL },
  );
}
