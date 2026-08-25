import { describe, expect, it } from "vitest";
import { mapChoice, mapMatch, mapTextEntryItem } from "./qti2-interactions-basic.js";
import type { Qti2Context } from "./qti2-context.js";
import { resolveOptions } from "./options.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  parseXml,
  type XmlElement,
} from "./xml.js";

describe("basic QTI 2 interaction mapping", () => {
  it("maps a single-cardinality choice and its scoring disposition", () => {
    const context = qti2Context(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse><value>A</value></correctResponse>
      </responseDeclaration>
      <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
        <prompt>Choose one.</prompt>
        <simpleChoice identifier="A">Alpha</simpleChoice>
        <simpleChoice identifier="B">Beta</simpleChoice>
      </choiceInteraction></itemBody>
    `);
    const mapped = mapChoice(interaction(context, "choiceinteraction"), context);

    expect(mapped).toMatchObject({
      interactionType: "choice",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      correctResponse: ["A"],
      shuffle: true,
      maxChoices: 1,
      scoring: "match_correct",
    });
    expect(mapped?.choices.map((choice) => choice.text)).toEqual(["Alpha", "Beta"]);
    expect(context.diagnostics).toEqual([]);
  });

  it("maps match source/target sets and pair values", () => {
    const context = qti2Context(`
      <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
        <correctResponse><value>S1 T1</value></correctResponse>
      </responseDeclaration>
      <itemBody><matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="2">
        <simpleMatchSet><simpleAssociableChoice identifier="S1">Source</simpleAssociableChoice></simpleMatchSet>
        <simpleMatchSet><simpleAssociableChoice identifier="T1">Target</simpleAssociableChoice></simpleMatchSet>
      </matchInteraction></itemBody>
    `);
    const mapped = mapMatch(interaction(context, "matchinteraction"), context);

    expect(mapped).toMatchObject({
      interactionType: "match",
      responseIdentifier: "RESPONSE",
      sources: [expect.objectContaining({ identifier: "S1", text: "Source" })],
      targets: [expect.objectContaining({ identifier: "T1", text: "Target" })],
      correctResponse: [{ sourceIdentifier: "S1", targetIdentifier: "T1" }],
      shuffle: false,
      maxAssociations: 2,
    });
  });

  it("maps text-entry slots through the item-level branch", () => {
    const context = qti2Context(`
      <responseDeclaration identifier="WORD" cardinality="single" baseType="string">
        <correctResponse><value>estuary</value></correctResponse>
      </responseDeclaration>
      <itemBody><p>A river meets the ocean at an <textEntryInteraction responseIdentifier="WORD"/>.</p></itemBody>
    `);
    const mapped = mapTextEntryItem(context);

    expect(mapped).toMatchObject({
      interactionType: "textEntry",
      identifier: "ITEM",
      responses: [
        {
          responseIdentifier: "WORD",
          answers: [{ value: "estuary", score: 1, caseSensitive: false }],
        },
      ],
    });
    expect(String(mapped?.bodyHtml)).toContain(
      'qti-text-entry-interaction response-identifier="WORD"',
    );
    expect(context.blocked).toBeUndefined();
  });
});

function qti2Context(children: string): Qti2Context {
  const document = parseXml(
    `<assessmentItem identifier="ITEM" title="Synthetic item">${children}</assessmentItem>`,
    "qti2-basic-interactions-test",
  );
  const responseDecls = findAllDescendantsByLocalName(
    document.documentElement,
    "responsedeclaration",
  );
  const body = findDescendantByLocalName(document.documentElement, "itembody");
  if (!body) throw new Error("Expected synthetic item body.");
  return {
    identifier: "ITEM",
    title: "Synthetic item",
    body,
    responseDecls,
    responseDeclMap: new Map(
      responseDecls.map((declaration) => [attr(declaration, "identifier") ?? "", declaration]),
    ),
    sourceFormat: "qti22",
    path: "synthetic.xml",
    options: resolveOptions(),
    diagnostics: [],
  };
}

function interaction(context: Qti2Context, localName: string): XmlElement {
  const found = findDescendantByLocalName(context.body, localName);
  if (!found) throw new Error(`Expected ${localName}.`);
  return found;
}
