import { describe, expect, it } from "vitest";

import {
  buildQti3HotspotItem,
  qti3TrustedXmlFragment,
  validateQti3HotspotItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer hotspot", () => {
  it("writes hotspot items with object metadata, cardinality, and selection messages", () => {
    const xml = buildQti3HotspotItem({
      identifier: "hotspot-1",
      title: "Hotspot",
      promptHtml: qti3TrustedXmlFragment("Select a region"),
      object: {
        data: "images/map.png",
        alt: "Map",
        width: 100,
        height: 100,
        longDescription: "Long map description",
      },
      choices: [{ identifier: "R1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: ["R1"],
      minChoices: 1,
      maxChoices: 1,
      minChoicesMessage: "Pick one",
      maxChoicesMessage: "Only one",
      sharedVocabulary: { "selections-tone": "light" },
      classNames: ["writer-hotspot"],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      cardinality: "single",
      baseType: "identifier",
      correctResponse: "R1",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "hotspot",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "identifier",
    });
    expect(item.interactions[0]?.object).toMatchObject({
      data: "images/map.png",
      type: "image/png",
      width: "100",
      height: "100",
      text: "Map",
      attributes: expect.objectContaining({ alt: "Map" }),
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "writer-hotspot qti-selections-light",
      "min-choices": "1",
      "max-choices": "1",
      "data-min-selections-message": "Pick one",
      "data-max-selections-message": "Only one",
    });
    expect(item.interactions[0]?.choices).toEqual([
      expect.objectContaining({
        identifier: "R1",
        role: "hotspot",
        attributes: expect.objectContaining({ shape: "rect", coords: "1,1,20,20" }),
      }),
    ]);
  });

  it("defaults hotspot cardinality and max-choices to single-select", () => {
    const xml = buildQti3HotspotItem({
      interactionType: "hotspot",
      identifier: "hotspot-default-single",
      title: "Hotspot",
      object: { data: "images/map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "R1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: ["R1"],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.cardinality).toBe("single");
    expect(item.interactions[0]?.attributes["max-choices"]).toBe("1");
  });

  it("rejects hotspot items with inaccessible or inconsistent metadata", () => {
    expect(() =>
      buildQti3HotspotItem({
        interactionType: "hotspot",
        identifier: "hotspot-missing-metadata",
        title: "Hotspot",
        object: { data: "/uploads/hotspot-img" },
        choices: [{ identifier: "R1", shape: "rect", coords: "1,1,20,20" }],
        correctResponse: ["R2"],
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "hotspot",
      identifier: "hotspot-missing-metadata",
      title: "Hotspot",
      object: { data: "/uploads/hotspot-img" },
      choices: [{ identifier: "R1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: ["R2"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "missing_hotspot_object_alt",
          "unknown_hotspot_object_type",
          "unknown_hotspot_reference",
        ]),
      );
    }
  });

  it("returns diagnostics for invalid hotspot correct-response identifiers", () => {
    const diagnostics = validateQti3HotspotItem({
      interactionType: "hotspot",
      identifier: "hotspot-invalid-correct",
      title: "Hotspot",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "R1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: ["1invalid"],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid_identifier");
  });
});
