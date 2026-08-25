import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import {
  interactionRegistryDiagnostics,
  interactionRegistryStatus,
  interactionSupport,
  itemMetadataSupport,
  processingSupport,
} from "./support.js";
import {
  interactionSupportFixtures,
  interactionSupportTests,
  processingBrowserEvidence,
  processingSupportTests,
} from "./support-evidence.js";

describe("support registry helpers", () => {
  it("reports supported status for registered current interactions", () => {
    expect(interactionRegistryStatus("qti-choice-interaction")).toBe("supported");
    expect(
      interactionRegistryDiagnostics("qti-choice-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "choice",
      }),
    ).toEqual([]);
  });

  it("reports deprecated status and diagnostics for deprecated interactions", () => {
    expect(interactionRegistryStatus("qti-custom-interaction")).toBe("deprecated");
    expect(
      interactionRegistryDiagnostics("qti-custom-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "custom",
      }),
    ).toEqual([
      expect.objectContaining({
        code: "interaction.deprecated",
        severity: "warning",
      }),
    ]);
  });

  it("reports unsupported status and diagnostics for unknown interactions", () => {
    expect(interactionRegistryStatus("qti-unsupported-interaction")).toBe("unsupported");
    expect(
      interactionRegistryDiagnostics("qti-unsupported-interaction", {
        line: 1,
        column: 1,
        offset: 0,
        path: "unsupported",
      }),
    ).toEqual([
      expect.objectContaining({
        code: "interaction.unsupported",
        severity: "warning",
      }),
    ]);
  });

  it("derives fixture QTI names from the canonical interaction registry", () => {
    expect(testInteraction({ type: "extendedText" })).toMatchObject({
      qtiName: "qti-extended-text-interaction",
      registryStatus: "supported",
    });
    expect(testInteraction({ type: "portableCustom" })).toMatchObject({
      qtiName: "qti-portable-custom-interaction",
      registryStatus: "supported",
    });
  });

  it("derives supported interaction evidence from the internal support-evidence registry", () => {
    for (const support of interactionSupport) {
      expect(support.fixtures).toEqual(interactionSupportFixtures(support.interactionType));
      expect(support.tests).toEqual(interactionSupportTests(support.interactionType));
    }
  });

  it("exposes processing browser evidence on parent constructs only", () => {
    for (const qtiName of Object.keys(processingBrowserEvidence)) {
      const support = processingSupport.find((entry) => entry.qtiName === qtiName);
      expect(support?.tests).toEqual(processingSupportTests(qtiName));
    }

    const variable = processingSupport.find((entry) => entry.qtiName === "qti-variable");
    expect(variable?.tests).toEqual(processingSupportTests("qti-variable"));
  });

  it("requires browser evidence for rendered item metadata", () => {
    for (const support of itemMetadataSupport.filter((entry) => entry.render)) {
      expect(support.tests).toEqual(
        expect.arrayContaining([expect.stringMatching(/^tests\/browser\/.+\.spec\.ts$/)]),
      );
    }

    expect(
      itemMetadataSupport.find((entry) => entry.qtiName === "qti-modal-feedback"),
    ).toMatchObject({
      support: "rendered",
      parse: true,
      validate: true,
      render: true,
      process: true,
      tests: expect.arrayContaining(["tests/browser/player-feedback.spec.ts"]),
    });
  });
});
