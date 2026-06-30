import type { QtiAttemptStateV1, QtiDiagnostic, QtiDocument } from "@longsightgroup/qti3-core";
import { validateQtiResponseVariables } from "@longsightgroup/qti3-core";

export {
  matchMaxDiagnostics,
  maximumResponseDiagnostic,
  minimumRequiredResponses,
  requiredResponseDiagnostic,
  responseCount,
  responseIsEmpty,
  responseValidationPolicy,
} from "@longsightgroup/qti3-core";

export function errorView(message: string): HTMLElement {
  const element = document.createElement("p");
  element.role = "alert";
  element.textContent = message;
  return element;
}

export function validationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("p");
  element.className = "qti3-validation-message";
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

export function inlineValidationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "qti3-validation-message qti3-validation-message-inline";
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

export function validationMessageId(responseIdentifier: string): string {
  return `qti3-validation-${responseIdentifier}`;
}

export function cloneDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ? { ...diagnostic.source } : undefined,
  }));
}

export function validateItemResponses(
  document: QtiDocument,
  state: QtiAttemptStateV1,
  options: { responseIdentifiers?: Iterable<string> } = {},
): QtiDiagnostic[] {
  return validateQtiResponseVariables({
    item: document.item,
    responses: state.responses,
    responseIdentifiers: options.responseIdentifiers,
  }).diagnostics;
}
