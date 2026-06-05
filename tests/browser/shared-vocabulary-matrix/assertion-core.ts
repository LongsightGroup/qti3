import type { NumericComparison, SharedVocabularyAssertion } from "./types.js";

export function assertionLabel(assertion: SharedVocabularyAssertion): string {
  switch (assertion.type) {
    case "aria-snapshot-contains":
      return `${assertion.selector} accessible text contains "${assertion.text}"`;
    case "attribute":
      return `${assertion.selector} has ${assertion.name}="${assertion.value}"`;
    case "attribute-absent":
      return `${assertion.selector} does not have ${assertion.name}`;
    case "class-preserved":
      return `${assertion.selector} preserves .${assertion.className}`;
    case "click":
      return `click ${assertion.selector}`;
    case "computed-style":
      return `${assertion.selector} ${assertion.property} is ${assertion.value}`;
    case "computed-style-differs":
      return `${assertion.firstSelector} ${assertion.property} differs from ${assertion.secondSelector}`;
    case "computed-style-same":
      return `${assertion.firstSelector} ${assertion.property} equals ${assertion.secondSelector}`;
    case "computed-style-not":
      return `${assertion.selector} ${assertion.property} is not ${assertion.value}`;
    case "computed-style-number":
      return `${assertion.selector} ${assertion.property} ${assertion.comparison} ${assertion.value}`;
    case "dom-order":
      return `${assertion.firstSelector} is ${assertion.order} ${assertion.secondSelector}`;
    case "element-count":
      return `${assertion.selector} count is ${assertion.count}`;
    case "focus":
      return `focus ${assertion.selector}`;
    case "forced-colors-active":
      return "forced colors media query is active";
    case "hidden-focusable-input":
      return `${assertion.selector} is visually clipped and focusable`;
    case "inline-style":
      return `${assertion.selector} inline style ${assertion.property} is ${assertion.value || "(empty)"}`;
    case "key":
      return `press ${assertion.key}`;
    case "layout-same-row":
      return `${assertion.firstSelector} and ${assertion.secondSelector} share a row`;
    case "layout-width":
      return `${assertion.selector} width is ${assertion.expected}px +/- ${assertion.tolerance}px`;
    case "layout-width-ratio":
      return `${assertion.firstSelector} width ratio is ${assertion.ratio}`;
    case "position":
      return `${assertion.firstSelector} ${assertion.axis} is ${assertion.relation} ${assertion.secondSelector}`;
    case "set-attribute":
      return `set ${assertion.selector} ${assertion.name}="${assertion.value}"`;
    case "text":
      return `${assertion.selector} text is "${assertion.value}"`;
    default:
      return assertNever(assertion);
  }
}

/** Assertions the gallery cannot run without Playwright media emulation. */
export function isGalleryRunnable(assertion: SharedVocabularyAssertion): boolean {
  return assertion.type !== "forced-colors-active";
}

export async function runAssertionInRoot(
  root: ParentNode,
  assertion: SharedVocabularyAssertion,
): Promise<void> {
  switch (assertion.type) {
    case "aria-snapshot-contains": {
      const element = requiredElement(root, assertion.selector);
      const hiddenAncestor = element.closest("[aria-hidden='true'], [hidden]");
      if (hiddenAncestor) throw new Error("target is hidden from assistive output");
      if (!elementText(element).includes(assertion.text)) {
        throw new Error(`text "${assertion.text}" was not found`);
      }
      return;
    }
    case "attribute": {
      const value = requiredElement(root, assertion.selector).getAttribute(assertion.name);
      if (value !== assertion.value) {
        throw new Error(`received ${formatValue(value)}`);
      }
      return;
    }
    case "attribute-absent": {
      const value = requiredElement(root, assertion.selector).getAttribute(assertion.name);
      if (value !== null) throw new Error(`received ${formatValue(value)}`);
      return;
    }
    case "class-preserved": {
      assertClassPreserved(requiredElement(root, assertion.selector), assertion.className);
      return;
    }
    case "click":
      requiredHtmlElement(root, assertion.selector).click();
      await settle();
      return;
    case "computed-style": {
      const value = computedStyle(root, assertion.selector, assertion.property);
      if (value !== assertion.value) throw new Error(`received ${value}`);
      return;
    }
    case "computed-style-differs": {
      const first = computedStyle(root, assertion.firstSelector, assertion.property);
      const second = computedStyle(root, assertion.secondSelector, assertion.property);
      if (first === second) throw new Error(`both values are ${first}`);
      return;
    }
    case "computed-style-same": {
      const first = computedStyle(root, assertion.firstSelector, assertion.property);
      const second = computedStyle(root, assertion.secondSelector, assertion.property);
      if (first !== second) throw new Error(`${first} differs from ${second}`);
      return;
    }
    case "computed-style-not": {
      const value = computedStyle(root, assertion.selector, assertion.property);
      if (value === assertion.value) throw new Error(`received ${value}`);
      return;
    }
    case "computed-style-number": {
      const rawValue = computedStyle(root, assertion.selector, assertion.property);
      const actual = Number.parseFloat(rawValue);
      if (!Number.isFinite(actual)) throw new Error(`received ${rawValue}`);
      expectNumericComparison(actual, assertion.comparison, assertion.value);
      return;
    }
    case "dom-order": {
      const first = requiredElement(root, assertion.firstSelector);
      const second = requiredElement(root, assertion.secondSelector);
      if (!documentOrderMatches(first, second, assertion.order)) {
        throw new Error("document order did not match");
      }
      return;
    }
    case "element-count": {
      const count = root.querySelectorAll(assertion.selector).length;
      if (count !== assertion.count) throw new Error(`received ${count}`);
      return;
    }
    case "focus": {
      const element = requiredHtmlElement(root, assertion.selector);
      element.focus();
      await settle();
      if (document.activeElement !== element) throw new Error("element did not receive focus");
      return;
    }
    case "forced-colors-active":
      if (!window.matchMedia("(forced-colors: active)").matches) {
        throw new Error("open with forced colors emulation or an active system setting");
      }
      return;
    case "hidden-focusable-input": {
      const element = requiredHtmlElement(root, assertion.selector);
      const style = getComputedStyle(element);
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      if (style.position !== "absolute") throw new Error(`position is ${style.position}`);
      if (style.clipPath !== "inset(50%)") throw new Error(`clip-path is ${style.clipPath}`);
      if (width > 1 || height > 1) throw new Error(`size is ${width}x${height}`);
      element.focus();
      await settle();
      if (document.activeElement !== element) throw new Error("input did not receive focus");
      return;
    }
    case "inline-style": {
      const value = requiredHtmlElement(root, assertion.selector).style.getPropertyValue(
        assertion.property,
      );
      if (value !== assertion.value) throw new Error(`received ${formatValue(value)}`);
      return;
    }
    case "key":
      await pressKey(assertion.key);
      return;
    case "layout-same-row": {
      const first = requiredElement(root, assertion.firstSelector).getBoundingClientRect();
      const second = requiredElement(root, assertion.secondSelector).getBoundingClientRect();
      const delta = Math.abs(first.y - second.y);
      if (delta > assertion.tolerance) throw new Error(`row delta is ${delta}px`);
      return;
    }
    case "layout-width": {
      const width = requiredElement(root, assertion.selector).getBoundingClientRect().width;
      const delta = Math.abs(width - assertion.expected);
      if (delta > assertion.tolerance) throw new Error(`width is ${width}px`);
      return;
    }
    case "layout-width-ratio": {
      const first = requiredElement(root, assertion.firstSelector).getBoundingClientRect();
      const second = requiredElement(root, assertion.secondSelector).getBoundingClientRect();
      const ratio = first.width / second.width;
      if (Math.abs(ratio - assertion.ratio) > assertion.tolerance) {
        throw new Error(`ratio is ${ratio.toFixed(3)}`);
      }
      return;
    }
    case "position": {
      const first = requiredElement(root, assertion.firstSelector).getBoundingClientRect();
      const second = requiredElement(root, assertion.secondSelector).getBoundingClientRect();
      const firstValue = assertion.axis === "x" ? first.x : first.y;
      const secondValue = assertion.axis === "x" ? second.x : second.y;
      if (assertion.relation === "less-than" && firstValue >= secondValue) {
        throw new Error(`${firstValue} is not less than ${secondValue}`);
      }
      if (assertion.relation === "greater-than" && firstValue <= secondValue) {
        throw new Error(`${firstValue} is not greater than ${secondValue}`);
      }
      return;
    }
    case "set-attribute": {
      requiredElement(root, assertion.selector).setAttribute(assertion.name, assertion.value);
      await settle();
      return;
    }
    case "text": {
      const text = elementText(requiredElement(root, assertion.selector));
      if (text !== assertion.value) throw new Error(`received "${text}"`);
      return;
    }
    default:
      return assertNever(assertion);
  }
}

function documentOrderMatches(first: Element, second: Element, order: "before" | "after"): boolean {
  const relation = first.compareDocumentPosition(second);
  const secondFollowsFirst = (relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  return order === "before" ? secondFollowsFirst : !secondFollowsFirst;
}

function assertClassPreserved(element: Element, className: string): void {
  const classes = element.getAttribute("class") ?? "";
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(className)}(\\s|$)`);
  if (!pattern.test(classes)) {
    throw new Error(`classes are "${classes}"`);
  }
}

function elementText(element: Element): string {
  return (element as HTMLElement).innerText.replace(/\s+/g, " ").trim();
}

function requiredElement(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`missing selector ${selector}`);
  return element;
}

function requiredHtmlElement(root: ParentNode, selector: string): HTMLElement {
  const element = requiredElement(root, selector);
  if (!(element instanceof HTMLElement)) throw new Error(`${selector} is not an HTMLElement`);
  return element;
}

function computedStyle(root: ParentNode, selector: string, property: string): string {
  return getComputedStyle(requiredElement(root, selector)).getPropertyValue(property);
}

async function pressKey(key: string): Promise<void> {
  if (key === "Tab") {
    focusNextElement();
    await settle();
    return;
  }

  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    throw new Error(`no focused element for key ${key}`);
  }
  active.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  if (key === " " || key === "Space" || key === "Enter") {
    active.click();
  }
  active.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  await settle();
}

function focusNextElement(): void {
  const focusable = [
    ...document.querySelectorAll<HTMLElement>(
      ["button", "input", "select", "textarea", "a[href]", '[tabindex]:not([tabindex="-1"])'].join(
        ", ",
      ),
    ),
  ].filter((element) => !element.hasAttribute("disabled"));
  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  focusable[Math.min(currentIndex + 1, focusable.length - 1)]?.focus();
}

export function expectNumericComparison(
  actual: number,
  comparison: NumericComparison,
  expected: number,
): void {
  if (comparison === "less-than" && actual >= expected) {
    throw new Error(`${actual} is not less than ${expected}`);
  }
  if (comparison === "greater-than" && actual <= expected) {
    throw new Error(`${actual} is not greater than ${expected}`);
  }
  if (comparison === "less-than-or-equal" && actual > expected) {
    throw new Error(`${actual} is greater than ${expected}`);
  }
  if (comparison === "greater-than-or-equal" && actual < expected) {
    throw new Error(`${actual} is less than ${expected}`);
  }
}

function formatValue(value: string | null): string {
  return value === null ? "null" : `"${value}"`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function assertNever(value: never): never {
  throw new Error(`Unhandled shared vocabulary assertion: ${JSON.stringify(value)}`);
}
