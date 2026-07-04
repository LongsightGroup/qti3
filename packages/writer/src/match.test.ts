import { describe, expect, it } from "vitest";

import { buildQti3MatchItem, qti3TrustedXmlFragment } from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer match", () => {
  it("writes match items with directed pairs and shared vocabulary attributes", () => {
    const xml = buildQti3MatchItem({
      identifier: "match-1",
      title: "Match",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Match"),
      sources: [{ identifier: "A", text: "Dog", matchMax: 1 }],
      targets: [{ identifier: "T1", text: "Barks", matchMax: 1 }],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
      minAssociations: 1,
      maxAssociations: 0,
      shuffle: false,
      sharedVocabulary: {
        "match-tabular": true,
        "first-column-header": "Terms",
      },
      classNames: ["writer-match"],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: ["A T1"],
    });
    expect(item.interactions[0]).toMatchObject({
      type: "match",
      responseIdentifier: "RESPONSE",
      responseCardinality: "multiple",
      responseBaseType: "directedPair",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "writer-match qti-match-tabular",
      "data-first-column-header": "Terms",
      "min-associations": "1",
      "max-associations": "0",
      shuffle: "false",
    });
    expect(item.interactions[0]?.choices.map((choice) => [choice.role, choice.identifier])).toEqual(
      [
        ["matchSource", "A"],
        ["matchTarget", "T1"],
      ],
    );
  });

  it("rejects match correct responses that reference missing choices", () => {
    expect(() =>
      buildQti3MatchItem({
        interactionType: "match",
        identifier: "match-missing-reference",
        title: "Match",
        sources: [{ identifier: "A", text: "A" }],
        targets: [{ identifier: "T1", text: "T1" }],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T2" }],
      }),
    ).toThrow('unknown target "T2"');
  });
});
