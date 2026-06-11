import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { isInteractionSupported } from "./interaction-registry.js";
import {
  collectEmbeddedInteractionDiagnostics,
  collectInteractionRenderDiagnostics,
  interactionMissingChoiceDiagnostics,
  interactionUnsupportedDiagnostics,
} from "./interaction-diagnostics.js";

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

describe("interaction-dispatch support", () => {
  it("recognizes supported interaction types", () => {
    expect(
      isInteractionSupported(
        interaction({
          type: "choice",
          choices: [
            {
              identifier: "A",
              text: "A",
              role: "simpleChoice",
              qtiName: "qti-simple-choice",
              attributes: {},
              source: { line: 1, column: 1, offset: 0, path: "choice" },
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isInteractionSupported(
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
      ),
    ).toBe(true);
    expect(isInteractionSupported(interaction({ type: "hotspot" }))).toBe(false);
    expect(
      isInteractionSupported(interaction({ type: "customUnknown" as QtiInteraction["type"] })),
    ).toBe(false);
  });
});

describe("interaction-diagnostics", () => {
  it("reports unsupported interactions", () => {
    const diagnostics = interactionUnsupportedDiagnostics(
      interaction({ type: "customUnknown" as QtiInteraction["type"] }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.unsupported");
  });

  it("reports missing choices for choice interactions", () => {
    const diagnostics = interactionMissingChoiceDiagnostics(interaction({ type: "choice" }));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.choices.missing");
  });

  it("reports missing sources or targets for match interactions", () => {
    const diagnostics = interactionMissingChoiceDiagnostics(interaction({ type: "match" }));
    expect(diagnostics).toHaveLength(1);
  });

  it("collects render diagnostics for all interactions", () => {
    const diagnostics = collectInteractionRenderDiagnostics([
      interaction({ type: "choice" }),
      interaction({ type: "customUnknown" as QtiInteraction["type"] }),
    ]);
    expect(diagnostics.some((entry) => entry.code === "interaction.choices.missing")).toBe(true);
    expect(diagnostics.some((entry) => entry.code === "interaction.unsupported")).toBe(true);
  });

  it("does not report block-level interaction references as embedded", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [{ kind: "interaction", interactionIndex: 0 }],
      interactions: [interaction({ type: "choice" })],
    } as never);
    expect(diagnostics).toHaveLength(0);
  });

  it("reports non-embeddable interactions nested in inline flow", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [
        {
          kind: "element",
          qtiName: "p",
          attributes: {},
          children: [{ kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" }],
          source: { line: 1, column: 1, offset: 0, path: "p" },
        },
      ],
      interactions: [interaction({ type: "choice" })],
    } as never);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.embed.unsupported");
  });

  it("allows end-attempt interactions nested in inline flow", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [
        {
          kind: "element",
          qtiName: "p",
          attributes: {},
          children: [{ kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" }],
          source: { line: 1, column: 1, offset: 0, path: "p" },
        },
      ],
      interactions: [interaction({ type: "endAttempt", responseBaseType: "boolean" })],
    } as never);
    expect(diagnostics).toHaveLength(0);
  });

  it("does not report deprecated custom interactions as invalid inline embedding", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [
        {
          kind: "element",
          qtiName: "p",
          attributes: {},
          children: [{ kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" }],
          source: { line: 1, column: 1, offset: 0, path: "p" },
        },
      ],
      interactions: [interaction({ type: "custom" })],
    } as never);
    expect(diagnostics).toHaveLength(0);
  });

  it("reports portable custom interactions nested in inline flow", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [
        {
          kind: "element",
          qtiName: "p",
          attributes: {},
          children: [{ kind: "interaction", interactionIndex: 0, qtiName: "qti-interaction" }],
          source: { line: 1, column: 1, offset: 0, path: "p" },
        },
      ],
      interactions: [interaction({ type: "portableCustom" })],
    } as never);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.embed.unsupported");
  });
});
