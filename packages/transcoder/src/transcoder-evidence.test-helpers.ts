import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";
import { expect } from "vitest";

import { transcodeQti3Item, type QtiTranscodeProfileId } from "./index.js";
import { fixtureXml } from "./transcoder.test-helpers.js";

export const transcodeEvidenceInteractionTypes = [
  ...interactionSupport,
  ...deprecatedInteractionSupport,
].map((entry) => entry.interactionType);

export function expectTranscodeEvidenceCase(
  profile: QtiTranscodeProfileId,
  interactionType: QtiInteractionType,
): void {
  const result = transcodeQti3Item(
    {
      kind: "xml",
      xml: fixtureXml(interactionType),
      sourcePath: `${interactionType}.xml`,
    },
    { profile },
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.profile).toBe(profile);
  expect(result.report.fidelity).toBe(result.fidelity);
  expect(result.report.mappings.length).toBeGreaterThanOrEqual(1);
  for (const [index, mapping] of result.report.mappings.entries()) {
    expect(mapping).toMatchObject({
      index,
      sourceInteraction: interactionType,
      emittedInteraction: expect.any(String),
      affectedPaths: expect.any(Array),
      diagnosticCodes: expect.any(Array),
    });
    expect(mapping.emittedInteraction.length).toBeGreaterThan(0);
    expect(["exact", "normalized", "lossy"]).toContain(mapping.fidelity);
    expect(["automatic", "manual", "unscored"]).toContain(mapping.scoring);
  }
  expect(result.report.diagnosticCodes).toEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
  );
  expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(result.assets).toEqual([]);
  expect(result.xml).not.toContain("qti-portable-custom-interaction");

  if (profile === "moodle-xml@1") {
    expect(result.xml).toContain("<quiz>");
    expect(result.xml).toContain("<question ");
  } else if (
    profile === "qti12-standard@1" ||
    profile === "canvas-classic-quizzes@1" ||
    profile === "canvas-new-quizzes@1"
  ) {
    expect(result.xml).toContain("<questestinterop");
  } else {
    expect(result.xml).toContain("<assessmentItem");
  }

  expect({
    diagnostics: result.diagnostics,
    report: result.report,
    xml: result.xml,
  }).toMatchSnapshot();
}
