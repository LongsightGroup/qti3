import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import { CONTROL_VALIDATION_INVALID, syncControlAriaInvalid } from "./dom/control-invalid-state.js";
import { mergeTokenAttribute, removeTokenAttribute } from "./dom/token-attribute.js";
import { validationMessageId } from "./player-validation.js";

const VALIDATION_CONTROL_SELECTOR =
  "input, select, textarea, button, [tabindex]:not([tabindex='-1']), [contenteditable='true']";

export function syncValidationMessages(root: ParentNode, messages: QtiDiagnostic[]): void {
  const messagesByIdentifier = new Map(
    messages.filter((message) => message.path).map((message) => [message.path!, message]),
  );
  for (const section of root.querySelectorAll<HTMLElement>("[data-response-identifier]")) {
    const responseIdentifier = section.dataset.responseIdentifier;
    if (!responseIdentifier) continue;
    const message = messagesByIdentifier.get(responseIdentifier);
    const messageElement = section.querySelector<HTMLElement>(
      `[data-validation-for="${responseIdentifier}"]`,
    );
    const controls = section.querySelectorAll<HTMLElement>(VALIDATION_CONTROL_SELECTOR);
    const validationMessageToken = validationMessageId(responseIdentifier);
    if (message && messageElement) {
      messageElement.textContent = message.message;
      messageElement.hidden = false;
      for (const control of controls) {
        control.dataset[CONTROL_VALIDATION_INVALID] = "true";
        mergeTokenAttribute(control, "aria-describedby", validationMessageToken);
        syncControlAriaInvalid(control);
      }
    } else if (messageElement) {
      messageElement.textContent = "";
      messageElement.hidden = true;
      for (const control of controls) {
        delete control.dataset[CONTROL_VALIDATION_INVALID];
        removeTokenAttribute(control, "aria-describedby", validationMessageToken);
        syncControlAriaInvalid(control);
      }
    }
  }
}
