import { expect, type Locator, type Page } from "@playwright/test";
import type { NumericComparison, SharedVocabularyAssertion } from "./types.js";

export async function assertSvCase(
  page: Page,
  assertions: SharedVocabularyAssertion[],
): Promise<void> {
  for (const assertion of assertions) {
    await assertSvAssertion(page, assertion);
  }
}

async function probeComputedStyle(locator: Locator, property: string): Promise<string> {
  return locator.first().evaluate((element, cssProperty) => {
    return getComputedStyle(element).getPropertyValue(cssProperty);
  }, property);
}

async function assertClassPreserved(section: Locator, className: string): Promise<void> {
  await expect(section).toHaveClass(new RegExp(`(^|\\s)${escapeRegExp(className)}(\\s|$)`));
}

async function snapshotLayoutMetrics(
  locator: Locator,
): Promise<{ width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Missing layout metrics target.");
  return { width: box.width, height: box.height };
}

async function assertSvAssertion(page: Page, assertion: SharedVocabularyAssertion): Promise<void> {
  switch (assertion.type) {
    case "aria-snapshot-contains": {
      const snapshot = await page.locator(assertion.selector).ariaSnapshot();
      expect(snapshot).toContain(assertion.text);
      return;
    }
    case "attribute":
      await expect(page.locator(assertion.selector)).toHaveAttribute(
        assertion.name,
        assertion.value,
      );
      return;
    case "class-preserved":
      await assertClassPreserved(page.locator(assertion.selector), assertion.className);
      return;
    case "click":
      await page.locator(assertion.selector).click();
      return;
    case "computed-style":
      expect(await probeComputedStyle(page.locator(assertion.selector), assertion.property)).toBe(
        assertion.value,
      );
      return;
    case "computed-style-differs": {
      const first = await probeComputedStyle(
        page.locator(assertion.firstSelector),
        assertion.property,
      );
      const second = await probeComputedStyle(
        page.locator(assertion.secondSelector),
        assertion.property,
      );
      expect(first).not.toBe(second);
      return;
    }
    case "computed-style-not":
      expect(
        await probeComputedStyle(page.locator(assertion.selector), assertion.property),
      ).not.toBe(assertion.value);
      return;
    case "computed-style-number": {
      const rawValue = await probeComputedStyle(
        page.locator(assertion.selector),
        assertion.property,
      );
      const actual = Number.parseFloat(rawValue);
      expect(Number.isFinite(actual), `${assertion.property}=${rawValue}`).toBe(true);
      expectNumericComparison(actual, assertion.comparison, assertion.value);
      return;
    }
    case "dom-order": {
      const first = page.locator(assertion.firstSelector);
      const second = page.locator(assertion.secondSelector);
      const relation = await first.evaluate(
        (firstElement, secondElement) => {
          return firstElement.compareDocumentPosition(secondElement);
        },
        await second.elementHandle(),
      );
      const follows = (relation & 4) !== 0;
      expect(
        follows,
        `${assertion.firstSelector} should be before ${assertion.secondSelector}`,
      ).toBe(assertion.order === "before");
      return;
    }
    case "focus":
      await page.locator(assertion.selector).focus();
      await expect(page.locator(assertion.selector)).toBeFocused();
      return;
    case "forced-colors-active":
      await expect
        .poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches))
        .toBe(true);
      return;
    case "hidden-focusable-input": {
      const input = page.locator(assertion.selector);
      await expect(input).toHaveCSS("position", "absolute");
      await expect(input).toHaveCSS("clip-path", "inset(50%)");
      expect(Number.parseFloat(await probeComputedStyle(input, "width"))).toBeLessThanOrEqual(1);
      expect(Number.parseFloat(await probeComputedStyle(input, "height"))).toBeLessThanOrEqual(1);
      await input.focus();
      await expect(input).toBeFocused();
      return;
    }
    case "key":
      await page.keyboard.press(assertion.key);
      return;
    case "layout-same-row": {
      const first = await boundingBox(page.locator(assertion.firstSelector));
      const second = await boundingBox(page.locator(assertion.secondSelector));
      expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(assertion.tolerance);
      return;
    }
    case "layout-width": {
      const metrics = await snapshotLayoutMetrics(page.locator(assertion.selector));
      expect(Math.abs(metrics.width - assertion.expected)).toBeLessThanOrEqual(assertion.tolerance);
      return;
    }
    case "layout-width-ratio": {
      const first = await boundingBox(page.locator(assertion.firstSelector));
      const second = await boundingBox(page.locator(assertion.secondSelector));
      expect(Math.abs(first.width / second.width - assertion.ratio)).toBeLessThanOrEqual(
        assertion.tolerance,
      );
      return;
    }
    case "position": {
      const first = await boundingBox(page.locator(assertion.firstSelector));
      const second = await boundingBox(page.locator(assertion.secondSelector));
      const firstValue = assertion.axis === "x" ? first.x : first.y;
      const secondValue = assertion.axis === "x" ? second.x : second.y;
      if (assertion.relation === "less-than") {
        expect(firstValue).toBeLessThan(secondValue);
      } else {
        expect(firstValue).toBeGreaterThan(secondValue);
      }
      return;
    }
    case "text":
      await expect(page.locator(assertion.selector)).toHaveText(assertion.value);
      return;
    default:
      return assertNever(assertion);
  }
}

async function boundingBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Missing bounding box target.");
  return box;
}

function expectNumericComparison(
  actual: number,
  comparison: NumericComparison,
  expected: number,
): void {
  if (comparison === "less-than") expect(actual).toBeLessThan(expected);
  else if (comparison === "greater-than") expect(actual).toBeGreaterThan(expected);
  else if (comparison === "less-than-or-equal") expect(actual).toBeLessThanOrEqual(expected);
  else expect(actual).toBeGreaterThanOrEqual(expected);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled shared vocabulary assertion: ${JSON.stringify(value)}`);
}
