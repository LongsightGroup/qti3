import { parseQtiXml, type QtiDocument } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { compareImportedItem } from "./item-import-preservation.js";

const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="synthetic" title="Synthetic preservation" time-dependent="false">
<qti-response-declaration identifier="R" cardinality="single" base-type="identifier"/>
<qti-response-declaration identifier="T" cardinality="single" base-type="string"/>
<qti-item-body><p><img src="one.png" alt="One &amp; two"/><img src="two.png" alt="Three"/></p>
<qti-choice-interaction response-identifier="R" min-choices="0" max-choices="1" class="qti-labels-decimal"><qti-simple-choice identifier="A">One</qti-simple-choice><qti-simple-choice identifier="B">Two</qti-simple-choice></qti-choice-interaction>
<p><qti-text-entry-interaction response-identifier="T" expected-length="6" pattern-mask="[0-9]+" data-patternmask-message="Digits only"/></p>
</qti-item-body><qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml"/></qti-assessment-item>`;

function document(): QtiDocument {
  const parsed = parseQtiXml(xml);
  if (!parsed.document) throw new Error("Expected synthetic document");
  return parsed.document;
}

describe("imported item preservation", () => {
  it("records exact authored and imported values", () => {
    const evidence = compareImportedItem(xml, document());
    expect(evidence.diagnostics).toEqual([]);
    expect(evidence.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "interactions[0].choices.identifiers",
          expected: ["A", "B"],
          actual: ["A", "B"],
          ok: true,
        }),
        expect.objectContaining({
          field: "interactions[1].attributes.expected-length",
          expected: "6",
          actual: "6",
          ok: true,
        }),
        expect.objectContaining({
          field: "images[0].alt",
          expected: "One & two",
          actual: "One & two",
          ok: true,
        }),
      ]),
    );
  });

  const mutations: readonly [string, (value: QtiDocument) => void][] = [
    [
      "cardinality",
      (value) => {
        const declaration = value.item.responseDeclarations[0];
        if (declaration) declaration.cardinality = "multiple";
      },
    ],
    [
      "choice identifiers",
      (value) => {
        const choice = value.item.interactions[0]?.choices[0];
        if (choice) choice.identifier = "WRONG";
      },
    ],
    [
      "min/max choices",
      (value) => {
        const interaction = value.item.interactions[0];
        if (interaction) interaction.attributes["max-choices"] = "3";
      },
    ],
    [
      "shared vocabulary",
      (value) => {
        const interaction = value.item.interactions[0];
        if (interaction) interaction.attributes.class = "qti-labels-none";
      },
    ],
    ...["expected-length", "pattern-mask", "data-patternmask-message"].map(
      (name): [string, (value: QtiDocument) => void] => [
        name,
        (value) => {
          const interaction = value.item.interactions[1];
          if (interaction) interaction.attributes[name] = "wrong";
        },
      ],
    ),
    [
      "image association",
      (value) => {
        const paragraph = value.item.body.find((node) => node.kind === "element");
        const image = paragraph?.children.find(
          (node) => node.kind === "element" && node.qtiName === "img",
        );
        if (image?.kind === "element") image.attributes.src = "two.png";
      },
    ],
    [
      "alt text",
      (value) => {
        const paragraph = value.item.body.find((node) => node.kind === "element");
        const image = paragraph?.children.find(
          (node) => node.kind === "element" && node.qtiName === "img",
        );
        if (image?.kind === "element") image.attributes.alt = "wrong";
      },
    ],
    [
      "fixed template",
      (value) => {
        if (value.item.responseProcessing) value.item.responseProcessing.template = "map_response";
      },
    ],
  ];
  it.each(mutations)(
    "rejects a model that lost %s while the input XML remains intact",
    (_label, mutate) => {
      const imported = document();
      mutate(imported);
      const evidence = compareImportedItem(xml, imported);
      expect(evidence.diagnostics.length).toBeGreaterThan(0);
      expect(evidence.observations.some((entry) => !entry.ok)).toBe(true);
    },
  );
});
