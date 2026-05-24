/**
 * @vitest-environment happy-dom
 */
import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it, vi } from "vitest";
import {
  portableCustomValidityDiagnostic,
  renderPortableCustomResponse,
} from "./portable-custom-interaction.js";

function interaction(overrides: Partial<QtiInteraction> = {}): QtiInteraction {
  return {
    type: "portableCustom",
    qtiName: "qti-portable-custom-interaction",
    responseIdentifier: "RESPONSE",
    responseCardinality: "single",
    responseBaseType: "string",
    prompt: "Custom prompt",
    choices: [],
    attributes: {
      "custom-interaction-type-identifier": "urn:qti3:fixture:portable-custom",
      module: "fixture-portable-custom",
    },
    childElements: [],
    text: "",
    source: { line: 1, column: 1, offset: 0, path: "item" },
    portableCustom: {
      responseIdentifier: "RESPONSE",
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      module: "fixture-portable-custom",
      interactionMarkup: [{ kind: "text", text: "Markup" }],
      templateVariables: [],
      contextVariables: [],
      stylesheets: [],
      dataAttributes: {},
      attributes: {},
      source: { line: 1, column: 1, offset: 0, path: "item" },
    },
    ...overrides,
  } as QtiInteraction;
}

describe("portable-custom-interaction", () => {
  it("renders a host with markup and dispatches mount details", async () => {
    const onMount = vi.fn();
    const element = renderPortableCustomResponse({
      interaction: interaction(),
      update: () => {},
      currentValue: "A",
      currentState: { count: 1 },
      renderMarkup: (nodes) =>
        nodes.flatMap((node) => (node.kind === "text" ? [document.createTextNode(node.text)] : [])),
      setInteractionState: () => {},
      setValidity: () => {},
      emitStateChange: () => {},
      onMount,
    });

    const host = element.querySelector(".qti3-portable-custom-host");
    expect(host).not.toBeNull();
    expect(host?.getAttribute("data-type-identifier")).toBe("urn:qti3:fixture:portable-custom");
    expect(host?.querySelector(".qti3-portable-custom-markup")?.textContent).toBe("Markup");
    expect(element.querySelector<HTMLInputElement>(".qti3-portable-custom-response")?.value).toBe(
      "A",
    );

    await Promise.resolve();
    expect(onMount).toHaveBeenCalledWith(
      expect.objectContaining({
        responseIdentifier: "RESPONSE",
        value: "A",
        state: { count: 1 },
      }),
    );
  });

  it("forwards response, state, and validity events", () => {
    const update = vi.fn();
    const setInteractionState = vi.fn();
    const setValidity = vi.fn();
    const emitStateChange = vi.fn();
    const element = renderPortableCustomResponse({
      interaction: interaction(),
      update,
      currentValue: null,
      renderMarkup: () => [],
      setInteractionState,
      setValidity,
      emitStateChange,
      onMount: () => {},
    });
    const host = element.querySelector(".qti3-portable-custom-host");
    if (!host) throw new Error("Missing portable custom host.");

    host.dispatchEvent(
      new CustomEvent("qti3-portable-custom-state", { detail: { state: { ok: true } } }),
    );
    expect(setInteractionState).toHaveBeenCalledWith("RESPONSE", { ok: true });
    expect(emitStateChange).toHaveBeenCalled();

    host.dispatchEvent(
      new CustomEvent("qti3-portable-custom-response", { detail: { value: "B" } }),
    );
    expect(update).toHaveBeenCalledWith("B");

    host.dispatchEvent(
      new CustomEvent("qti3-portable-custom-validity", {
        detail: { valid: false, message: "Invalid" },
      }),
    );
    expect(setValidity).toHaveBeenCalledWith("RESPONSE", false, "Invalid");
    expect(emitStateChange).toHaveBeenCalledTimes(2);
  });

  it("builds validity diagnostics for invalid PCI responses", () => {
    expect(portableCustomValidityDiagnostic("RESPONSE", true, "ignored")).toBeUndefined();
    expect(portableCustomValidityDiagnostic("RESPONSE", false, "Invalid")?.code).toBe(
      "response.portableCustom.validity",
    );
    expect(portableCustomValidityDiagnostic("RESPONSE", false, undefined)?.message).toBe(
      "RESPONSE is not valid.",
    );
  });
});
