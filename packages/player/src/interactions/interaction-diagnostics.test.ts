import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { testInteraction } from "../interaction-test-fixtures.js";
import { isInteractionSupported } from "./interaction-registry.js";
import {
  collectEmbeddedInteractionDiagnostics,
  collectInteractionRenderDiagnostics,
  interactionMissingChoiceDiagnostics,
  interactionUnsupportedDiagnostics,
} from "./interaction-diagnostics.js";

describe("interaction registry support", () => {
  it("recognizes supported interaction types", () => {
    expect(
      isInteractionSupported(
        testInteraction({
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
        testInteraction({
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
    expect(isInteractionSupported(testInteraction({ type: "hotspot" }))).toBe(false);
    expect(
      isInteractionSupported(testInteraction({ type: "customUnknown" as QtiInteraction["type"] })),
    ).toBe(false);
  });
});

describe("interaction-diagnostics", () => {
  it("reports unsupported interactions", () => {
    const diagnostics = interactionUnsupportedDiagnostics(
      testInteraction({
        type: "customUnknown" as QtiInteraction["type"],
        qtiName: "qti-unsupported-interaction",
        registryStatus: "unsupported",
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.unsupported");
    expect(diagnostics[0]?.message).toContain("not in the QTI support registry");
  });

  it("reports deprecated unrenderable interactions as unsupported by the player", () => {
    const diagnostics = interactionUnsupportedDiagnostics(
      testInteraction({
        type: "custom",
        qtiName: "qti-custom-interaction",
        registryStatus: "deprecated",
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.unsupported");
    expect(diagnostics[0]?.severity).toBe("error");
    expect(diagnostics[0]?.message).toContain("deprecated");
    expect(diagnostics[0]?.message).toContain("not supported by this player");
  });

  it("reports missing choices for choice interactions", () => {
    const diagnostics = interactionMissingChoiceDiagnostics(testInteraction({ type: "choice" }));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.choices.missing");
  });

  it("reports missing sources or targets for match interactions", () => {
    const diagnostics = interactionMissingChoiceDiagnostics(testInteraction({ type: "match" }));
    expect(diagnostics).toHaveLength(1);
  });

  it("collects render diagnostics for all interactions", () => {
    const diagnostics = collectInteractionRenderDiagnostics([
      testInteraction({ type: "choice" }),
      testInteraction({
        type: "customUnknown" as QtiInteraction["type"],
        qtiName: "qti-unsupported-interaction",
        registryStatus: "unsupported",
      }),
    ]);
    expect(diagnostics.some((entry) => entry.code === "interaction.choices.missing")).toBe(true);
    expect(diagnostics.some((entry) => entry.code === "interaction.unsupported")).toBe(true);
  });

  it("does not report block-level interaction references as embedded", () => {
    const diagnostics = collectEmbeddedInteractionDiagnostics({
      identifier: "item",
      body: [{ kind: "interaction", interactionIndex: 0 }],
      interactions: [testInteraction({ type: "choice" })],
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
      interactions: [testInteraction({ type: "choice" })],
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
      interactions: [testInteraction({ type: "endAttempt", responseBaseType: "boolean" })],
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
      interactions: [
        testInteraction({
          type: "custom",
          qtiName: "qti-custom-interaction",
          registryStatus: "deprecated",
        }),
      ],
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
      interactions: [testInteraction({ type: "portableCustom" })],
    } as never);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("interaction.embed.unsupported");
  });
});
