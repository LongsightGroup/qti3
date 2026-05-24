/**
 * @vitest-environment happy-dom
 */
import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  interactionRegistry,
  matchInteractionRegistryEntry,
  renderInteractionResponse,
  type InteractionResponseContext,
} from "./interaction-registry.js";

function interaction(
  overrides: Partial<QtiInteraction> & { type: QtiInteraction["type"] },
): QtiInteraction {
  return {
    qtiName: "qti-interaction",
    responseIdentifier: "RESPONSE",
    responseCardinality: "single",
    responseBaseType: "identifier",
    choices: [],
    attributes: {},
    childElements: [],
    text: "",
    source: { line: 1, column: 1, offset: 0, path: "item" },
    ...overrides,
  } as QtiInteraction;
}

function renderContext(overrides: Partial<InteractionResponseContext> = {}): InteractionResponseContext {
  const baseInteraction = interaction({ type: "choice" });
  return {
    interaction: baseInteraction,
    update: () => {},
    currentValue: null,
    messages: {} as InteractionResponseContext["messages"],
    isCompleted: () => false,
    endAttempt: () => {},
    renderPortableCustom: () => document.createElement("div"),
    ...overrides,
  };
}

describe("interaction registry ordering", () => {
  it("keeps a stable registry order for every supported renderer id", () => {
    expect(interactionRegistry.map((entry) => entry.id)).toEqual([
      "graphicOrder",
      "ordered",
      "gapMatch",
      "graphicAssociate",
      "match",
      "pair",
      "hotspot",
      "hottext",
      "choice",
      "inlineChoice",
      "extendedText",
      "selectPoint",
      "positionObject",
      "drawing",
      "portableCustom",
      "textEntry",
      "slider",
      "upload",
      "endAttempt",
      "media",
    ]);
  });

  it("prefers graphicOrder over ordered cardinality", () => {
    expect(
      matchInteractionRegistryEntry(
        interaction({ type: "graphicOrder", responseCardinality: "ordered" }),
      )?.id,
    ).toBe("graphicOrder");
  });

  it("prefers match over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        interaction({ type: "match", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("match");
  });

  it("prefers graphicAssociate over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        interaction({ type: "graphicAssociate", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("graphicAssociate");
  });

  it("prefers gapMatch over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        interaction({ type: "gapMatch", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("gapMatch");
  });

  it("routes associate and custom directedPair interactions to pair", () => {
    expect(matchInteractionRegistryEntry(interaction({ type: "associate" }))?.id).toBe("pair");
    expect(
      matchInteractionRegistryEntry(
        interaction({ type: "customUnknown" as QtiInteraction["type"], responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("pair");
  });

  it("requires an object for hotspot rendering", () => {
    expect(matchInteractionRegistryEntry(interaction({ type: "hotspot" }))).toBeUndefined();
    expect(
      matchInteractionRegistryEntry(
        interaction({
          type: "hotspot",
          object: {
            data: "x",
            type: "image/png",
            text: "",
            width: "100",
            height: "100",
            sources: [],
            tracks: [],
            attributes: {},
          },
        }),
      )?.id,
    ).toBe("hotspot");
  });
});

describe("renderInteractionResponse", () => {
  it("renders unsupported interactions as alerts", () => {
    const element = renderInteractionResponse(
      renderContext({
        interaction: interaction({ type: "customUnknown" as QtiInteraction["type"] }),
      }),
    );
    expect(element.getAttribute("role")).toBe("alert");
    expect(element.textContent).toContain("customUnknown");
  });

  it("renders upload interactions through the upload renderer", () => {
    const element = renderInteractionResponse(
      renderContext({
        interaction: interaction({ type: "upload" }),
      }),
    );
    expect(element.className).toBe("qti3-upload-input");
    expect(element.getAttribute("type")).toBe("file");
  });

  it("renders endAttempt interactions through the end attempt renderer", () => {
    const element = renderInteractionResponse(
      renderContext({
        interaction: interaction({ type: "endAttempt", attributes: { title: "Finish" } }),
      }),
    );
    expect(element.className).toBe("qti3-end-attempt-button");
    expect(element.textContent).toBe("Finish");
  });
});
