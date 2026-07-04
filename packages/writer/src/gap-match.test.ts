import { describe, expect, it } from "vitest";

import {
  buildQti3GapMatchItem,
  qti3TrustedXmlFragment,
  validateQti3GapMatchItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer gap match", () => {
  it("writes gap match items with choices, body gaps, mappings, bounds, and vocabulary", () => {
    const xml = buildQti3GapMatchItem({
      identifier: "gap-match-1",
      title: "Gap Match",
      promptHtml: qti3TrustedXmlFragment("Complete the sentence."),
      bodyHtml: qti3TrustedXmlFragment(
        '<div><p><qti-gap identifier="G1" class="qti-input-width-10"/> then <qti-gap identifier="G2"/>.</p></div>',
      ),
      choices: [
        { identifier: "A", kind: "text", text: "Alpha", matchMax: 1, fixed: true },
        { identifier: "B", kind: "text", contentHtml: qti3TrustedXmlFragment("<em>Beta</em>") },
      ],
      targets: [{ identifier: "G1" }, { identifier: "G2" }],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "G1" },
        { sourceIdentifier: "B", targetIdentifier: "G2" },
      ],
      scoring: "map_response",
      shuffle: true,
      minAssociations: 1,
      maxAssociations: 2,
      minAssociationsMessage: "Fill at least one",
      maxAssociationsMessage: "Only two",
      classNames: ["writer-gap"],
      sharedVocabulary: { "gap-placement": true, "choices-position": "left" },
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: ["A G1", "B G2"],
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A G1", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "B G2", mappedValue: 1 }),
    ]);
    expect(interaction).toMatchObject({
      type: "gapMatch",
      responseIdentifier: "RESPONSE",
      responseCardinality: "multiple",
      responseBaseType: "directedPair",
      prompt: "Complete the sentence.",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-gap qti-choices-left qti-gap-placement",
      shuffle: "true",
      "min-associations": "1",
      "max-associations": "2",
      "data-min-selections-message": "Fill at least one",
      "data-max-selections-message": "Only two",
    });
    expect(interaction.choices.slice(0, 2).map((choice) => choice.identifier)).toEqual(["A", "B"]);
    expect(interaction.choices.slice(0, 2).map((choice) => choice.text)).toEqual(["Alpha", "Beta"]);
    expect(interaction.choices[0]?.attributes).toMatchObject({
      "match-max": "1",
      fixed: "true",
    });
    expect(interaction.gapMatchSegments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "gap",
          identifier: "G1",
          attributes: expect.objectContaining({ class: "qti-input-width-10" }),
        }),
        expect.objectContaining({ kind: "gap", identifier: "G2" }),
      ]),
    );
  });

  it("writes image gap choices and match_correct response processing", () => {
    const xml = buildQti3GapMatchItem({
      identifier: "gap-match-image",
      title: "Gap Match Image",
      bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
      choices: [
        {
          identifier: "IMG",
          kind: "image",
          object: { data: "choice.png", alt: "Choice image" },
        },
      ],
      targets: [{ identifier: "G1" }],
      correctResponse: [{ sourceIdentifier: "IMG", targetIdentifier: "G1" }],
      scoring: "match_correct",
    });

    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.choices[0]?.qtiName).toBe("qti-gap-img");
    expect(item.responseProcessing?.template).toContain("rptemplates/match_correct");
  });

  it("supports the unified writer API", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "gapMatch",
      identifier: "gap-match-unified",
      title: "Gap Match Unified",
      bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
      choices: [{ identifier: "A", kind: "text", text: "A" }],
      targets: [{ identifier: "G1" }],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "G1" }],
    };

    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));
    expect(parsed.interactions[0]?.qtiName).toBe("qti-gap-match-interaction");
  });

  it("rejects invalid gap match authoring inputs", () => {
    const diagnostics = validateQti3GapMatchItem({
      identifier: "bad gap",
      title: "",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-gap/><qti-gap identifier="UNKNOWN"/><qti-gap identifier="UNKNOWN"/></p>',
      ),
      choices: [
        { identifier: "A", kind: "text", text: "", matchMax: 1 },
        { identifier: "A", kind: "text", text: "Duplicate" },
      ],
      targets: [{ identifier: "G1" }],
      correctResponse: [
        { sourceIdentifier: "B", targetIdentifier: "G2" },
        { sourceIdentifier: "A", targetIdentifier: "G1" },
        { sourceIdentifier: "A", targetIdentifier: "G2" },
      ],
      minAssociations: 3,
      maxAssociations: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "duplicate_identifier",
        "empty_gap_match_choice",
        "invalid_gap_match_bounds",
        "missing_gap_match_gap_identifier",
        "duplicate_identifier",
        "unknown_gap_match_body_gap",
        "missing_gap_match_body_gap",
        "unknown_gap_match_choice_reference",
        "unknown_gap_match_target_reference",
      ]),
    );
    expect(
      validateQti3GapMatchItem({
        identifier: "gap-match-missing-correct",
        title: "Gap Match",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
        choices: [{ identifier: "A", kind: "text", text: "A" }],
        targets: [{ identifier: "G1" }],
        correctResponse: [],
      }).map((diagnostic) => diagnostic.code),
    ).toContain("missing_gap_match_correct_response");
    expect(() =>
      buildQti3GapMatchItem({
        identifier: "gap-match-missing-correct",
        title: "Gap Match",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
        choices: [{ identifier: "A", kind: "text", text: "A" }],
        targets: [{ identifier: "G1" }],
        correctResponse: [],
      }),
    ).toThrow("at least one correct pair");
  });

  it("rejects correct responses that exceed choice matchMax", () => {
    const diagnostics = validateQti3GapMatchItem({
      identifier: "gap-match-match-max",
      title: "Gap Match",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-gap identifier="G1"/> <qti-gap identifier="G2"/></p>',
      ),
      choices: [{ identifier: "A", kind: "text", text: "A", matchMax: 1 }],
      targets: [{ identifier: "G1" }, { identifier: "G2" }],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "G1" },
        { sourceIdentifier: "A", targetIdentifier: "G2" },
      ],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "gap_match_match_max_exceeded",
    );
  });

  it("rejects cross-pool duplicate identifiers and duplicate correct pairs", () => {
    const diagnostics = validateQti3GapMatchItem({
      identifier: "gap-match-duplicates",
      title: "Gap Match",
      bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="A"/></p>'),
      choices: [{ identifier: "A", kind: "text", text: "A" }],
      targets: [{ identifier: "A" }],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "A" },
        { sourceIdentifier: "A", targetIdentifier: "A" },
      ],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["duplicate_identifier", "duplicate_identifier"]),
    );
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "duplicate_identifier")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "choices|targets" }),
        expect.objectContaining({ path: "correctResponse" }),
      ]),
    );
  });
});
