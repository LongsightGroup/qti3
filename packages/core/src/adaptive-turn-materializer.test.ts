import { describe, expect, it } from "vitest";
import { materializeAdaptiveCandidateView } from "./adaptive-turn-materializer.js";
import { adaptiveChoiceItemXml, adaptiveTemplateItemXml } from "./trusted-item.fixtures.js";

describe("adaptive candidate materialization", () => {
  it("preserves start feedback and strips secrets for the initial turn", () => {
    const result = materializeAdaptiveCandidateView({
      itemXml: adaptiveChoiceItemXml(),
      outcomes: { TRACE: "start", completionStatus: "not_attempted" },
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toBeDefined();
    expect(result.xml).not.toMatch(/<qti-response-processing\b/);
    expect(result.xml).not.toMatch(/<qti-correct-response\b/);
    expect(result.xml).toContain("Start feedback.");
    expect(result.xml).not.toContain("Try again.");
    expect(result.xml).not.toContain("Hidden retry.");
  });

  it("preserves outcome-visible feedback for the active turn", () => {
    const result = materializeAdaptiveCandidateView({
      itemXml: adaptiveChoiceItemXml(),
      outcomes: { TRACE: "wrong-first", completionStatus: "unknown" },
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toContain("Try again.");
    expect(result.xml).toContain("Inline retry.");
    expect(result.xml).toContain("Modal retry.");
    expect(result.xml).not.toContain("Start feedback.");
    expect(result.xml).not.toContain("Hidden retry.");
  });

  it("fails closed for unsupported template-processing items", () => {
    const result = materializeAdaptiveCandidateView({
      itemXml: adaptiveTemplateItemXml(),
      outcomes: { completionStatus: "not_attempted" },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.materialization.unsupported" }),
    );
  });
});
