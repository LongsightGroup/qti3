import { interactionSupport } from "@qti3/core";
import { describe, expect, it } from "vitest";
import { a11yContracts, manualAssistiveTechnologyScripts } from "./index.js";

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
});
