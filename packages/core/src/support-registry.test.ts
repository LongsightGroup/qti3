import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import {
  interactionRegistryDiagnostics,
  interactionRegistryStatus,
  deprecatedInteractionSupport,
  interactionSupport,
  itemMetadataSupport,
  processingSupport,
} from "./support.js";
import {
  coreIntegrationTest,
  coreSessionStateTest,
  interactionSupportFixtures,
  interactionSupportTests,
  processingMappingTest,
  processingBrowserEvidence,
  processingOperatorsTest,
  processingResponseTest,
  processingTemplateTest,
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
    for (const [qtiName, browserTests] of Object.entries(processingBrowserEvidence)) {
      const support = processingSupport.find((entry) => entry.qtiName === qtiName);
      expect(support?.tests.slice(1)).toEqual(browserTests);
    }

    const variable = processingSupport.find((entry) => entry.qtiName === "qti-variable");
    expect(variable?.tests).toEqual([processingResponseTest]);
  });

  it("declares processing evidence ownership at canonical support entries", () => {
    for (const [qtiName, coreTest] of [
      ["qti-template-if", processingTemplateTest],
      ["qti-response-if", processingResponseTest],
      ["qti-map-response", processingMappingTest],
      ["qti-sum", processingOperatorsTest],
    ]) {
      expect(processingSupport.find((entry) => entry.qtiName === qtiName)?.tests[0]).toBe(coreTest);
    }
  });

  it("points support evidence at existing test suites with assertions", () => {
    for (const support of [
      ...interactionSupport,
      ...deprecatedInteractionSupport,
      ...processingSupport,
      ...itemMetadataSupport,
    ]) {
      for (const path of support.tests) {
        expect(existsSync(path), `${support.qtiName} evidence must exist: ${path}`).toBe(true);
      }
    }

    const splitCoreTests = [
      coreIntegrationTest,
      coreSessionStateTest,
      processingResponseTest,
      processingTemplateTest,
      processingOperatorsTest,
      processingMappingTest,
    ];
    for (const coreTest of splitCoreTests) {
      expect(existsSync(coreTest), `core evidence must exist: ${coreTest}`).toBe(true);
      expect(readFileSync(coreTest, "utf8"), `${coreTest} must contain assertions`).toMatch(
        /\b(?:it|test)\(/,
      );
    }

    for (const support of processingSupport) {
      const coreTest = support.tests[0];
      expect(coreTest).toMatch(/^packages\/core\/src\/.+\.test\.ts$/);
      if (!coreTest) continue;
      expect(splitCoreTests).toContain(coreTest);
    }
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
