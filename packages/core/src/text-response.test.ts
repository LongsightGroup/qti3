import { describe, expect, it } from "vitest";
import {
  captureQtiTextResponse,
  createItemSession,
  parseQtiXml,
  validateQtiResponseVariables,
} from "./index.js";

function textItem(cardinality = "single", baseType = 'base-type="float"', attributes = "") {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-text" title="Numeric text" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="${cardinality}" ${baseType}/>
    <qti-response-declaration identifier="RAW" cardinality="single" base-type="string"/>
    <qti-item-body><p>Value: <qti-text-entry-interaction response-identifier="RESPONSE" ${attributes}/></p></qti-item-body>
  </qti-assessment-item>`;
}

function parsed(cardinality = "single", baseType = 'base-type="float"', attributes = "") {
  const result = parseQtiXml(textItem(cardinality, baseType, attributes));
  expect(result.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
  if (!result.document) throw new Error("Expected text item");
  const interaction = result.document.item.interactions[0];
  if (!interaction) throw new Error("Expected text interaction");
  return { document: result.document, interaction };
}

describe("text response contracts", () => {
  it.each([
    ["integer", 'base="16"', "ff", 255],
    ["integer", "", "-007", -7],
    ["integer", "", "7.0", null],
    ["float", "", "0.12", 0.12],
    ["float", "", "1.20e2", 120],
    ["float", 'base="2"', "10.1", 2.5],
    ["float", "", "12oops", null],
    ["float", "", "", null],
    ["string", "", "  intact  ", "  intact  "],
  ])("captures %s %s input %s", (baseType, attributes, text, expected) => {
    const { interaction } = parsed("single", `base-type="${baseType}"`, attributes);
    expect(captureQtiTextResponse(interaction, text)).toEqual(expected);
  });

  it("preserves numeric record precision, null fields, and attempt serialization", () => {
    const { document, interaction } = parsed("record", "");
    const value = captureQtiTextResponse(interaction, "001.20e-2");
    expect(value).toEqual({
      stringValue: "001.20e-2",
      floatValue: 0.012,
      integerValue: null,
      leftDigits: 3,
      rightDigits: 2,
      ndp: 4,
      nsf: 3,
      exponent: -2,
    });
    const session = createItemSession(document);
    session.respond("RESPONSE", value);
    expect(createItemSession(document, session.serialize()).serialize().responses.RESPONSE).toEqual(
      value,
    );
    expect(captureQtiTextResponse(interaction, "not numeric")).toMatchObject({
      stringValue: "not numeric",
      floatValue: null,
    });
    expect(
      validateQtiResponseVariables({
        item: document.item,
        responses: { RESPONSE: value },
        allowIncompleteResponses: true,
      }).ok,
    ).toBe(true);
    expect(
      validateQtiResponseVariables({
        item: document.item,
        responses: { RESPONSE: { floatValue: "oops" } },
        allowIncompleteResponses: true,
      }).ok,
    ).toBe(false);
  });

  it("validates companion declarations, radix, and unsupported formats", () => {
    parsed("single", 'base-type="integer"', 'string-identifier="RAW"');
    for (const attributes of ['base="1"', 'format="unknown"', 'string-identifier="MISSING"']) {
      expect(
        parseQtiXml(textItem("single", 'base-type="integer"', attributes)).diagnostics.some(
          (entry) => entry.severity === "error",
        ),
      ).toBe(true);
    }
  });
});
