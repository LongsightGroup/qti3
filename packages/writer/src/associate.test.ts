import { describe, expect, it } from "vitest";

import {
  buildQti3AssociateItem,
  qti3TrustedXmlFragment,
  validateQti3AssociateItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer associate", () => {
  it("writes associate items with pair responses, mapping, limits, and choices", () => {
    const xml = buildQti3AssociateItem({
      identifier: "associate-1",
      title: "Associate",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Connect related items"),
      choices: [
        { identifier: "A", text: "Sun", matchMax: 1, fixed: true },
        { identifier: "B", text: "Moon", matchMax: 1 },
        { identifier: "C", contentHtml: qti3TrustedXmlFragment("<em>Day</em>"), matchMax: 1 },
        { identifier: "D", text: "Night", matchMax: 1 },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "C" },
        { sourceIdentifier: "B", targetIdentifier: "D" },
      ],
      scoring: "map_response",
      shuffle: true,
      minAssociations: 1,
      maxAssociations: 2,
      classNames: ["writer-associate"],
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "pair",
      correctResponse: ["A C", "B D"],
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A C", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "B D", mappedValue: 1 }),
    ]);
    expect(interaction).toMatchObject({
      type: "associate",
      responseIdentifier: "RESPONSE",
      responseCardinality: "multiple",
      responseBaseType: "pair",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-associate",
      shuffle: "true",
      "min-associations": "1",
      "max-associations": "2",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B", "C", "D"]);
    expect(interaction.choices[0]?.attributes).toMatchObject({
      "match-max": "1",
      fixed: "true",
    });
    expect(interaction.choices[2]?.text).toBe("Day");
    expect(item.responseProcessing?.template).toContain("rptemplates/map_response");
  });

  it("writes associate items through the unified writer", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "associate",
      identifier: "associate-unified",
      title: "Associate",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
      ],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
    };
    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));

    expect(parsed.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "pair",
      correctResponse: ["A B"],
    });
    expect(parsed.interactions[0]?.qtiName).toBe("qti-associate-interaction");
  });

  it("omits mapping when associate scoring defaults to match_correct", () => {
    const xml = buildQti3AssociateItem({
      identifier: "associate-match-correct",
      title: "Associate",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
      ],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
    });

    expect(xml).not.toContain("<qti-mapping");
    expect(xml).toContain("rptemplates/match_correct");
  });

  it("rejects invalid associate authoring inputs", () => {
    const diagnostics = validateQti3AssociateItem({
      identifier: "bad associate",
      title: "",
      choices: [
        { identifier: "A", text: "", matchMax: -1 },
        { identifier: "A", text: "Duplicate" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "A" },
        { sourceIdentifier: "A", targetIdentifier: "B" },
        { sourceIdentifier: "B", targetIdentifier: "A" },
      ],
      minAssociations: 2,
      maxAssociations: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "duplicate_identifier",
        "empty_associate_choice",
        "invalid_associate_match_max",
        "invalid_associate_bounds",
        "invalid_associate_self_pair",
        "unknown_associate_reference",
        "duplicate_identifier",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    expect(() =>
      buildQti3AssociateItem({
        identifier: "associate-missing-pair",
        title: "Associate",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: [],
      }),
    ).toThrow("at least one correct pair");
  });

  it("rejects associate correct responses that exceed a choice matchMax", () => {
    const diagnostics = validateQti3AssociateItem({
      identifier: "associate-match-max",
      title: "Associate",
      choices: [
        { identifier: "A", text: "A", matchMax: 1 },
        { identifier: "B", text: "B" },
        { identifier: "C", text: "C" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "B" },
        { sourceIdentifier: "A", targetIdentifier: "C" },
      ],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "associate_match_max_exceeded",
        path: "correctResponse",
        value: { identifier: "A", useCount: 2, matchMax: 1 },
      }),
    );
  });
});
