import { interactionSupport } from "@qti3/core";
import { describe, expect, it } from "vitest";
import {
  a11yContracts,
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "./index.js";

describe("@qti3/a11y", () => {
  it("defines an accessibility contract for every target interaction", () => {
    expect(a11yContracts.map((contract) => contract.interactionType).sort()).toEqual(
      interactionSupport.map((support) => support.interactionType).sort(),
    );
  });

  it("defines concrete semantics, focus behavior, keyboard behavior, and states", () => {
    for (const contract of a11yContracts) {
      expect(contract.primaryRole, contract.interactionType).not.toHaveLength(0);
      expect(contract.focusStrategy, contract.interactionType).not.toHaveLength(0);
      expect(contract.keyboardModel.length, contract.interactionType).toBeGreaterThan(0);
      expect(contract.requiredStates.length, contract.interactionType).toBeGreaterThan(0);
    }
  });

  it("defines manual assistive technology scripts covering every target interaction", () => {
    expect(
      manualAssistiveTechnologyScripts.map((script) => script.assistiveTechnology).sort(),
    ).toEqual(["JAWS", "NVDA", "VoiceOver"]);

    for (const script of manualAssistiveTechnologyScripts) {
      expect(script.setup.length, script.assistiveTechnology).toBeGreaterThan(0);
      expect(script.procedure.length, script.assistiveTechnology).toBeGreaterThan(0);
      expect(script.expectedResults.length, script.assistiveTechnology).toBeGreaterThan(0);
      expect(script.appliesTo.sort(), script.assistiveTechnology).toEqual(
        interactionSupport.map((support) => support.interactionType).sort(),
      );
    }
  });

  it("defines a proof matrix for every target interaction", () => {
    expect(accessibilityProofMatrix.map((entry) => entry.interactionType).sort()).toEqual(
      interactionSupport.map((support) => support.interactionType).sort(),
    );

    for (const entry of accessibilityProofMatrix) {
      expect(entry.proof.automated, entry.interactionType).toEqual(
        expect.arrayContaining([
          "accessibility contract unit coverage in @qti3/a11y",
          "manual harness reference fixture renders without axe-core violations",
          "response serialization and fixture scoring coverage",
          "forced-colors, reduced-motion, and narrow viewport browser checks",
        ]),
      );
      expect(entry.proof.manual, entry.interactionType).toEqual(
        expect.arrayContaining([
          "VoiceOver manual script",
          "NVDA manual script",
          "JAWS manual script",
          "focus order inspection",
        ]),
      );
    }
  });

  it("matches rich interaction keyboard contracts to rendered controls", () => {
    const byType = new Map(a11yContracts.map((contract) => [contract.interactionType, contract]));
    expect(byType.get("order")?.keyboardModel).toContain(
      "Arrow Up, Arrow Down, Arrow Left, or Arrow Right reorders the focused item handle.",
    );
    expect(byType.get("associate")?.keyboardModel).toContain(
      "Remove buttons delete selected pairs.",
    );
    expect(byType.get("gapMatch")?.keyboardModel).toContain(
      "Enter or Space on a target gap assigns the selected source.",
    );
    expect(byType.get("drawing")?.keyboardModel).toContain("Pointer input draws freehand strokes.");
  });
});
