import { describe, expect, it } from "vitest";
import { buildQtiDeliverySafeXml, parseQtiXml, processQtiAdaptiveItemTurn } from "./index.js";
import {
  adaptiveChoiceItemXml,
  adaptiveTemplatePresentationItemXml,
  adaptiveTemplateItemXml,
  noScoreProcessingItemXml,
} from "./trusted-item.fixtures.js";

describe("adaptive QTI item turns", () => {
  it("materializes the first adaptive candidate view without running scoring", () => {
    const result = processQtiAdaptiveItemTurn({ itemXml: adaptiveChoiceItemXml() });

    expect(result.ok).toBe(true);
    expect(result.state?.status).toBe("initialized");
    expect(result.completionStatus).toBe("not_attempted");
    expect(result.candidateSafeXml).toBeDefined();
    expect(result.candidateSafeXml).not.toMatch(/<qti-correct-response\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-response-processing\b/);
    expect(result.candidateSafeXml).toContain("Start feedback.");
    expect(result.candidateSafeXml).not.toContain("Try again.");

    const parsed = parseQtiXml(result.candidateSafeXml!);
    expect(parsed.ok).toBe(true);
    expect(parsed.document?.item.responseProcessing).toBeUndefined();
  });

  it("uses prior state to preserve adaptive outcomes across submitted turns", () => {
    const first = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      trustedResponses: { RESPONSE: "B" },
    });
    expect(first.ok).toBe(true);
    expect(first.outcomes).toMatchObject({
      SCORE: 0,
      TRACE: "wrong-first",
      completionStatus: "unknown",
    });
    expect(first.candidateSafeXml).toContain("Try again.");
    expect(first.candidateSafeXml).toContain("Inline retry.");
    expect(first.candidateSafeXml).toContain("Modal retry.");
    expect(first.candidateSafeXml).not.toContain("Start feedback.");
    expect(first.candidateSafeXml).not.toContain("Hidden retry.");
    expect(first.state?.status).toBe("interacting");

    const second = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      priorState: first.state,
      trustedResponses: { RESPONSE: "A" },
    });
    expect(second.ok).toBe(true);
    expect(second.outcomes).toMatchObject({
      SCORE: 1,
      TRACE: "wrong-first",
      completionStatus: "completed",
    });
    expect(second.state?.status).toBe("completed");
  });

  it("restores prior state for refresh without replaying response processing", () => {
    const submitted = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      trustedResponses: { RESPONSE: "B" },
    });
    expect(submitted.ok).toBe(true);

    const refreshed = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      priorState: submitted.state,
    });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.state).toEqual(submitted.state);
    expect(refreshed.outcomes).toMatchObject({
      SCORE: 0,
      TRACE: "wrong-first",
      completionStatus: "unknown",
    });
  });

  it("returns diagnostics for invalid prior state", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      priorState: { schema: "not-qti3" },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.state.value", severity: "error" }),
    );
  });

  it("ignores forged browser outcome variables during adaptive scoring", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      trustedResponses: {
        RESPONSE: "B",
        SCORE: 1,
        MAXSCORE: 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBe(0);
    expect(result.outcomes.SCORE).toBe(0);
    expect(result.candidateSafeXml).toContain("Try again.");
    expect(result.candidateSafeXml).not.toContain("Start feedback.");
    expect(result.state?.responses).not.toHaveProperty("SCORE");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.response.ignored", severity: "warning" }),
    );
  });

  it("does not materialize feedback from undeclared forged outcome input", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: adaptiveChoiceItemXml(),
      trustedResponses: {
        TRACE: "wrong-first",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.outcomes.TRACE).toBe("start");
    expect(result.candidateSafeXml).toContain("Start feedback.");
    expect(result.candidateSafeXml).not.toContain("Try again.");
    expect(result.candidateSafeXml).not.toContain("Inline retry.");
    expect(result.candidateSafeXml).not.toContain("Modal retry.");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.response.ignored", severity: "warning" }),
    );
  });

  it("fails when adaptive turn scoring does not produce a numeric SCORE", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: noScoreProcessingItemXml(),
      trustedResponses: { RESPONSE: "A" },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.score.missing", severity: "error" }),
    );
  });

  it("keeps static delivery redaction blocking adaptive processing but allows turn materialization", () => {
    const staticDelivery = buildQtiDeliverySafeXml(adaptiveChoiceItemXml());
    expect(staticDelivery.ok).toBe(false);
    expect(staticDelivery.diagnostics).toContainEqual(
      expect.objectContaining({ code: "delivery.unsupportedAdaptiveResponseProcessing" }),
    );

    const adaptiveTurn = processQtiAdaptiveItemTurn({ itemXml: adaptiveChoiceItemXml() });
    expect(adaptiveTurn.ok).toBe(true);
    expect(adaptiveTurn.candidateSafeXml).not.toMatch(/<qti-response-processing\b/);

    const staticTemplateDelivery = buildQtiDeliverySafeXml(adaptiveTemplatePresentationItemXml());
    expect(staticTemplateDelivery.ok).toBe(false);
    expect(staticTemplateDelivery.diagnostics).toContainEqual(
      expect.objectContaining({ code: "delivery.unsupportedSecureDelivery" }),
    );
  });

  it("materializes adaptive template presentation from authoritative session state", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: adaptiveTemplatePresentationItemXml(),
    });

    expect(result.ok).toBe(true);
    expect(result.state?.templateValues).toMatchObject({
      PROMPT_VALUE: 7,
      PATH: "visible",
    });
    expect(result.candidateSafeXml).toContain("Generated value: 7.");
    expect(result.candidateSafeXml).toContain("Initial score: 0.");
    expect(result.candidateSafeXml).toContain("Visible template path 7.");
    expect(result.candidateSafeXml).not.toContain("Hidden template path.");
    expect(result.candidateSafeXml).not.toMatch(/<qti-template-processing\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-set-correct-response\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-correct-response\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-response-processing\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-mapping\b/);
    expect(result.candidateSafeXml).not.toMatch(/<qti-match-table\b/);
  });

  it("preserves adaptive template presentation across submitted turns and refreshes", () => {
    const submitted = processQtiAdaptiveItemTurn({
      itemXml: adaptiveTemplatePresentationItemXml(),
      trustedResponses: { RESPONSE: "A" },
    });
    expect(submitted.ok).toBe(true);
    expect(submitted.score).toBe(1);
    expect(submitted.state?.templateValues).toMatchObject({
      PROMPT_VALUE: 7,
      PATH: "visible",
    });
    expect(submitted.candidateSafeXml).toContain("Generated value: 7.");
    expect(submitted.candidateSafeXml).toContain("Initial score: 1.");
    expect(submitted.candidateSafeXml).toContain("Visible template path 7.");

    const refreshed = processQtiAdaptiveItemTurn({
      itemXml: adaptiveTemplatePresentationItemXml(),
      priorState: submitted.state,
    });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.state).toEqual(submitted.state);
    expect(refreshed.candidateSafeXml).toContain("Generated value: 7.");
    expect(refreshed.candidateSafeXml).toContain("Initial score: 1.");
    expect(refreshed.candidateSafeXml).toContain("Visible template path 7.");
  });

  it("ignores forged template and outcome inputs during adaptive template materialization", () => {
    const result = processQtiAdaptiveItemTurn({
      itemXml: adaptiveTemplatePresentationItemXml(),
      trustedResponses: {
        RESPONSE: "B",
        PROMPT_VALUE: 99,
        PATH: "hidden",
        SCORE: 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBe(0);
    expect(result.state?.templateValues).toMatchObject({
      PROMPT_VALUE: 7,
      PATH: "visible",
    });
    expect(result.candidateSafeXml).toContain("Generated value: 7.");
    expect(result.candidateSafeXml).toContain("Initial score: 0.");
    expect(result.candidateSafeXml).toContain("Visible template path 7.");
    expect(result.candidateSafeXml).not.toContain("Generated value: 99.");
    expect(result.candidateSafeXml).not.toContain("Hidden template path.");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.response.ignored", severity: "warning" }),
    );
  });

  it("fails closed when adaptive turn candidate XML cannot be safely materialized", () => {
    const result = processQtiAdaptiveItemTurn({ itemXml: adaptiveTemplateItemXml() });

    expect(result.ok).toBe(false);
    expect(result.state).toBeDefined();
    expect(result.candidateSafeXml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.materialization.unsupported" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.delivery.materialization" }),
    );
  });
});
