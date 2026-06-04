import { createItemSession, parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  adaptiveFixtures,
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  canonicalFixtures,
  interactionFixtures,
  processingFixtures,
} from "./index.js";

describe("@longsightgroup/qti3-fixtures", () => {
  it("has one reference fixture for every target interaction", () => {
    expect(interactionFixtures).toHaveLength(21);
    expect(new Set(interactionFixtures.map((fixture) => fixture.interactionType)).size).toBe(21);
    expect(interactionFixtures.some((fixture) => fixture.interactionType === "custom")).toBe(false);
  });

  it("includes canonical processing and adaptive reference fixtures", () => {
    expect(processingFixtures.map((fixture) => fixture.id)).toEqual([
      "mapping-processing-reference",
      "generic-match-processing-reference",
      "template-processing-reference",
      "template-content-reference",
      "advanced-processing-reference",
    ]);
    expect(adaptiveFixtures.map((fixture) => fixture.id)).toEqual(["adaptive-feedback-reference"]);
    expect(canonicalFixtures).toHaveLength(
      interactionFixtures.length + processingFixtures.length + adaptiveFixtures.length,
    );
  });

  it("keeps Basic item-player fixtures as explicit supplemental evidence", () => {
    expect(basicItemPlayerFixtures.map((fixture) => fixture.id)).toEqual([
      "basic-html-subset",
      "basic-template-response-processing",
      "basic-composite-item",
      "basic-mathml",
      "basic-shared-vocabulary",
      "basic-alt-text",
    ]);
    expect(canonicalFixtures.map((fixture) => fixture.id)).not.toEqual(
      expect.arrayContaining(basicItemPlayerFixtures.map((fixture) => fixture.id)),
    );
    expect(basicItemPlayerToleranceFixtures.map((fixture) => fixture.id)).toEqual([
      "basic-extra-item-feature-tolerance",
      "basic-modal-feedback-tolerance",
    ]);
    expect(canonicalFixtures.map((fixture) => fixture.id)).not.toEqual(
      expect.arrayContaining(basicItemPlayerToleranceFixtures.map((fixture) => fixture.id)),
    );
  });

  it("keeps shared-vocabulary evidence broader than label classes", () => {
    const fixture = basicItemPlayerFixtures.find((item) => item.id === "basic-shared-vocabulary");
    expect(fixture?.xml).toContain("qti-labels-decimal");
    expect(fixture?.xml).toContain("qti-layout-row");
    expect(fixture?.xml).toContain("qti-layout-col6");
    expect(fixture?.xml).toContain("qti-align-center qti-text-indent-2");
    expect(fixture?.xml).toContain("qti-list-style-type-square");
    expect(fixture?.xml).toContain("qti-writing-mode-vertical-rl");
    expect(fixture?.xml).toContain("qti-orientation-horizontal");
    expect(fixture?.xml).toContain("qti-choices-stacking-3 qti-orientation-vertical");
    expect(fixture?.xml).toContain("qti-input-control-hidden qti-labels-cjk-ideographic");
    expect(fixture?.xml).toContain("qti-writing-orientation-vertical-rl");
    expect(fixture?.xml).toContain("qti-hottext-interaction");
    expect(fixture?.xml).toContain("qti-input-control-hidden qti-unselected-hidden");
    expect(fixture?.xml).toContain("qti-order-interaction");
    expect(fixture?.xml).toContain("qti-choices-top qti-labels-decimal");
    expect(fixture?.xml).toContain("qti-match-interaction");
    expect(fixture?.xml).toContain('class="qti-choices-right"');
    expect(fixture?.xml).toContain('class="qti-match-tabular" data-first-column-header="Source"');
    expect(fixture?.xml).toContain("qti-gap-match-interaction");
    expect(fixture?.xml).toContain(
      'class="qti-gap-placement qti-choices-left" data-choices-container-width="160"',
    );
    expect(fixture?.xml).toContain('class="qti-input-width-10"');
    expect(fixture?.xml).not.toContain('orientation="horizontal"');
    expect(fixture?.xml).not.toContain('orientation="vertical"');
  });

  it("parses, validates, scores, and serializes Basic item-player fixture attempts", () => {
    for (const fixture of [...basicItemPlayerFixtures, ...basicItemPlayerToleranceFixtures]) {
      const parsed = parseQtiXml(fixture.xml);
      expect(parsed.ok, fixture.id).toBe(true);
      expect(parsed.document, fixture.id).toBeDefined();
      if (!parsed.document) continue;

      const validation = validateAssessmentItem(parsed.document);
      expect(
        validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
        fixture.id,
      ).toEqual([]);

      for (const attempt of fixture.attempts) {
        const session = createItemSession(parsed.document);
        for (const [identifier, value] of Object.entries(attempt.responses)) {
          session.respond(identifier, value);
        }

        const scored = session.score();
        expect(
          scored.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
          `${fixture.id}/${attempt.name}`,
        ).toEqual([]);
        for (const [identifier, expected] of Object.entries(attempt.expectedOutcomes)) {
          expect(scored.outcomes[identifier], `${fixture.id}/${attempt.name}`).toEqual(expected);
        }
        const state = scored.state;
        expect(state.schema, `${fixture.id}/${attempt.name}`).toBe("qti3.attempt-state.v1");
        expect(state.itemIdentifier, `${fixture.id}/${attempt.name}`).toBe(fixture.id);
        for (const [identifier, expected] of Object.entries(attempt.expectedResponses ?? {})) {
          expect(state.responses[identifier], `${fixture.id}/${attempt.name}`).toEqual(expected);
        }
      }
    }
  });
});
