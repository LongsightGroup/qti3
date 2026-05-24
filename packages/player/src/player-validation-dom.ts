import type { QtiDiagnostic } from "@longsightgroup/qti3-core";

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
    const controls = section.querySelectorAll<HTMLElement>("input, select, textarea, button");
    if (message && messageElement) {
      messageElement.textContent = message.message;
      messageElement.hidden = false;
      for (const control of controls) {
        control.setAttribute("aria-invalid", "true");
        control.setAttribute("aria-describedby", messageElement.id);
      }
    } else if (messageElement) {
      messageElement.textContent = "";
      messageElement.hidden = true;
      for (const control of controls) {
        control.removeAttribute("aria-invalid");
        control.removeAttribute("aria-describedby");
      }
    }
  }
}
