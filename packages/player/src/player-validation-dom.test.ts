/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { syncValidationMessages } from "./player-validation-dom.js";

describe("player-validation-dom", () => {
  it("shows and hides per-response validation messages", () => {
    const root = document.createElement("div");
    const section = document.createElement("section");
    section.dataset.responseIdentifier = "RESPONSE";
    const message = document.createElement("p");
    message.id = "qti3-validation-RESPONSE";
    message.dataset.validationFor = "RESPONSE";
    message.hidden = true;
    const input = document.createElement("input");
    section.append(message, input);
    root.append(section);

    syncValidationMessages(root, [
      {
        code: "interaction.choices.missing",
        severity: "error",
        message: "No choices are defined.",
        path: "RESPONSE",
      },
    ]);
    expect(message.hidden).toBe(false);
    expect(message.textContent).toBe("No choices are defined.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("qti3-validation-RESPONSE");

    syncValidationMessages(root, []);
    expect(message.hidden).toBe(true);
    expect(message.textContent).toBe("");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
});
