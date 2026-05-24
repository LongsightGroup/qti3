/**
 * @vitest-environment happy-dom
 */
import type { QtiContentNode, QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  renderContentNode,
  renderContentNodes,
  type PlayerContentContext,
} from "./content-renderer.js";

function context(overrides: Partial<PlayerContentContext> = {}): PlayerContentContext {
  return {
    interactionAt: () => undefined,
    renderBlockInteraction: (interaction) => {
      const section = document.createElement("section");
      section.className = "block";
      section.dataset.interactionType = interaction.type;
      return section;
    },
    renderEmbeddedInteraction: (interaction) => {
      const span = document.createElement("span");
      span.className = "embedded";
      span.dataset.interactionType = interaction.type;
      return span;
    },
    currentVariableValue: () => 42,
    mathTemplateValue: () => undefined,
    isFeedbackVisible: () => true,
    isTemplateContentVisible: () => true,
    ...overrides,
  };
}

describe("content-renderer", () => {
  it("renders text nodes", () => {
    const nodes = renderContentNodes([{ kind: "text", text: "Hello" }], context());
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.textContent).toBe("Hello");
  });

  it("renders printed variables with formatted values", () => {
    const nodes = renderContentNode(
      { kind: "printedVariable", identifier: "SCORE", format: "%.1f", attributes: {} },
      context({ currentVariableValue: () => 3.14 }),
    );
    const output = nodes[0] as HTMLOutputElement;
    expect(output.tagName).toBe("OUTPUT");
    expect(output.value).toBe("3.1");
  });

  it("renders block interactions through the block delegate", () => {
    const interaction = { type: "choice" } as QtiInteraction;
    const nodes = renderContentNode(
      { kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" },
      context({
        interactionAt: () => interaction,
      }),
    );
    expect((nodes[0] as HTMLElement).className).toBe("block");
    expect((nodes[0] as HTMLElement).dataset.interactionType).toBe("choice");
  });

  it("embeds inline interactions through the context delegate", () => {
    const interaction = { type: "inlineChoice" } as QtiInteraction;
    const nodes = renderContentNode(
      { kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" },
      context({
        interactionAt: () => interaction,
      }),
    );
    expect((nodes[0] as HTMLElement).dataset.interactionType).toBe("inlineChoice");
  });

  it("hides feedback content when the context says it is not visible", () => {
    const nodes = renderContentNode(
      {
        kind: "feedback",
        feedbackType: "inline",
        identifier: "FB1",
        outcomeIdentifier: "OUTCOME",
        showHide: "show",
        children: [{ kind: "text", text: "Shown" }],
      } as QtiContentNode,
      context({ isFeedbackVisible: () => false }),
    );
    expect((nodes[0] as HTMLElement).hidden).toBe(true);
  });
});
