import { interactionSupport } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  a11yContracts,
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "./index.js";

describe("@longsightgroup/qti3-a11y", () => {
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
          "accessibility contract unit coverage in @longsightgroup/qti3-a11y",
          "manual harness reference fixture renders without axe-core violations",
          "operable fixture controls use standard tab order in Playwright",
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
      "Default order layout: Arrow Up, Arrow Down, Arrow Left, or Arrow Right reorders the focused item handle.",
    );
    expect(byType.get("order")?.keyboardModel).toContain(
      "Shared-vocabulary split layout: Enter or Space on a choices-bank button adds the choice to the next available order target.",
    );
    expect(byType.get("order")?.keyboardModel).toContain(
      "Adjacent moves are announced directionally in a polite live region; larger jumps announce the new position.",
    );
    expect(byType.get("graphicOrder")?.focusStrategy).toContain(
      "the selection summary is a live region, not a tab stop",
    );
    expect(byType.get("graphicOrder")?.keyboardModel).toContain(
      "On hotspot buttons, Arrow Up, Arrow Down, Arrow Left, or Arrow Right moves focus between hotspots.",
    );
    expect(byType.get("graphicOrder")?.keyboardModel).toContain(
      "On ordered-list controls, Arrow Up, Arrow Down, Arrow Left, or Arrow Right reorders the focused region.",
    );
    expect(byType.get("associate")?.keyboardModel).toContain(
      "Remove buttons delete selected pairs.",
    );
    expect(byType.get("match")?.keyboardModel).toContain(
      "Tabular layout: Enter or Space toggles the focused source-target cell.",
    );
    expect(byType.get("choice")?.keyboardModel).toContain(
      "Shared-vocabulary hidden input-control presentation keeps controls keyboard focusable and projects focus indication onto the visible option.",
    );
    expect(byType.get("hottext")?.keyboardModel).toContain(
      "Shared-vocabulary hidden input-control presentation keeps controls keyboard focusable and projects focus indication onto the visible option.",
    );
    expect(byType.get("gapMatch")?.keyboardModel).toContain(
      "Enter or Space on a target gap assigns the selected source.",
    );
    expect(byType.get("graphicGapMatch")?.keyboardModel).toContain(
      "Pointer drag from a source token to a target gap is a progressive enhancement.",
    );
    expect(byType.get("drawing")?.keyboardModel).toContain("Pointer input draws freehand strokes.");
    expect(byType.get("drawing")?.keyboardModel).toContain(
      "A native pen color input selects the active stroke color.",
    );
    expect(byType.get("drawing")?.keyboardModel).toContain(
      "The live drawing surface uses a light canvas so strokes stay visible when the page is in dark mode.",
    );
    expect(byType.get("drawing")?.focusStrategy).toContain(
      "the live canvas renders as a light surface independent of page color scheme",
    );
  });

  it("documents image-backed graphic gap match accessibility proof", () => {
    const proof = accessibilityProofMatrix.find(
      (entry) => entry.interactionType === "graphicGapMatch",
    )?.proof.automated;

    expect(proof).toContain(
      "image-backed gap choice keyboard, pointer, forced-colors, and narrow reflow browser coverage",
    );
  });

  it("documents PCI accessibility as a host-runtime contract", () => {
    const contract = a11yContracts.find((entry) => entry.interactionType === "portableCustom");
    expect(contract?.focusStrategy).toContain("host-provided PCI runtime");
    expect(contract?.keyboardModel.join(" ")).toContain(
      "The host-provided PCI runtime must expose keyboard-operable response controls.",
    );
    expect(contract?.keyboardModel.join(" ")).not.toContain("fallback text input");
    expect(contract?.requiredStates).toEqual(
      expect.arrayContaining([
        "host metadata",
        "host accessible name",
        "runtime accessible name, role, and state",
        "runtime validation bridge",
      ]),
    );
  });
});
