import { interactionSupport } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  a11yContracts,
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "./index.js";

// Metadata integrity only. Accessibility behavior is exercised in Playwright and manual runs.
describe("@longsightgroup/qti3-a11y", () => {
  it("defines an accessibility contract for every target interaction", () => {
    expect(a11yContracts.map((contract) => contract.interactionType).toSorted()).toEqual(
      interactionSupport.map((support) => support.interactionType).toSorted(),
    );
  });

  it.each(a11yContracts)(
    "requires nonempty accessibility contract fields for $interactionType",
    (contract) => {
      expect(contract.primaryRole).not.toHaveLength(0);
      expect(contract.focusStrategy).not.toHaveLength(0);
      expect(contract.keyboardModel.length).toBeGreaterThan(0);
      expect(contract.requiredStates.length).toBeGreaterThan(0);
    },
  );

  it.each(manualAssistiveTechnologyScripts)(
    "defines a manual assistive technology script for $assistiveTechnology",
    (script) => {
      expect(script.setup.length).toBeGreaterThan(0);
      expect(script.procedure.length).toBeGreaterThan(0);
      expect(script.expectedResults.length).toBeGreaterThan(0);
      expect(script.appliesTo.toSorted()).toEqual(
        interactionSupport.map((support) => support.interactionType).toSorted(),
      );
    },
  );

  it("defines manual assistive technology scripts covering every target interaction", () => {
    expect(
      manualAssistiveTechnologyScripts.map((script) => script.assistiveTechnology).toSorted(),
    ).toEqual(["JAWS", "NVDA", "VoiceOver"]);
  });

  it("defines a proof matrix for every target interaction", () => {
    expect(accessibilityProofMatrix.map((entry) => entry.interactionType).toSorted()).toEqual(
      interactionSupport.map((support) => support.interactionType).toSorted(),
    );

    expect(
      accessibilityProofMatrix
        .find((entry) => entry.interactionType === "extendedText")
        ?.variants?.map((variant) => variant.name),
    ).toContain("format=xhtml");
  });
});
