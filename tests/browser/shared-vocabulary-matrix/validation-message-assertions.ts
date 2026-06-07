import { QtiAssessmentItemPlayer } from "../../../packages/player/src/player-element.js";

export interface ValidationMessageExpectation {
  responseIdentifier: string;
  controlSelector: string;
  message: string;
  /** When true (default), the control must expose aria-invalid="true". */
  expectInvalid?: boolean;
}

export function validationMessageSelector(responseIdentifier: string): string {
  return `[data-validation-for="${responseIdentifier}"]`;
}

export async function assertValidationMessageInRoot(
  root: ParentNode,
  expectation: ValidationMessageExpectation,
  settle: () => Promise<void>,
): Promise<void> {
  const control = requiredHtmlElement(root, expectation.controlSelector);
  const expectInvalid = expectation.expectInvalid ?? true;

  if (!expectInvalid) {
    if (control.getAttribute("aria-invalid") === "true") {
      throw new Error("aria-invalid is still true");
    }
    return;
  }

  const playerElement = requiredElement(root, "qti-assessment-item-player");
  if (!(playerElement instanceof QtiAssessmentItemPlayer)) {
    throw new Error("qti-assessment-item-player is not a QtiAssessmentItemPlayer");
  }

  const messageElement = requiredHtmlElement(
    root,
    validationMessageSelector(expectation.responseIdentifier),
  );
  if (messageElement.hidden || elementText(messageElement) !== expectation.message) {
    playerElement.scoreAttempt();
    await settle();
  }
  if (messageElement.hidden) throw new Error("validation message is hidden");
  const text = elementText(messageElement);
  if (text !== expectation.message) throw new Error(`received "${text}"`);
  if (!messageElement.id) throw new Error("validation message has no id");

  if (control.getAttribute("aria-invalid") !== "true") {
    throw new Error(`aria-invalid is ${formatValue(control.getAttribute("aria-invalid"))}`);
  }

  const describedBy = control.getAttribute("aria-describedby") ?? "";
  const describedByIds = describedBy.split(/\s+/).filter(Boolean);
  if (!describedByIds.includes(messageElement.id)) {
    throw new Error(`aria-describedby is ${formatValue(describedBy)}`);
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

function formatValue(value: string | null): string {
  return value === null ? "null" : `"${value}"`;
}
