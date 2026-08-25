import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./index.js";

describe("literal and visible text parsing", () => {
  it("concatenates literal declaration and processing text without invented spaces", () => {
    const result = parseQtiXml(itemXml("bo<em>ld</em>ly", "sc<em>or</em>ed"));

    expect(result.ok).toBe(true);
    expect(result.document?.item.outcomeDeclarations[0]?.defaultValue).toBe("boldly");
    expect(result.document?.item.responseProcessing?.rules[0]).toEqual(
      expect.objectContaining({
        expression: expect.objectContaining({ rawValue: "scored", value: "scored" }),
      }),
    );
  });

  it("preserves inline words and separates blocks in prompts and choices", () => {
    const result = parseQtiXml(itemXml("A", "scored"));

    expect(result.ok).toBe(true);
    expect(result.document?.item.prompt).toBe("Choose boldly now next");
    expect(result.document?.item.interactions[0]?.prompt).toBe("Choose boldly now next");
    expect(result.document?.item.interactions[0]?.choices[0]?.text).toBe("Clearly marked answer");
    expect(result.document?.item.interactions[0]?.text).toContain(
      "Clearly marked answer Another choice",
    );
  });
});

function itemXml(correctValue: string, processingValue: string): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="text-content" title="text-content" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="LITERAL" cardinality="single" base-type="identifier">
        <qti-default-value><qti-value>${correctValue}</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="string"/>
      <qti-item-body>
        <qti-prompt><p>Choose bo<em>ld</em>ly now</p><p>next</p></qti-prompt>
        <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
          <qti-prompt><p>Choose bo<em>ld</em>ly now</p><p>next</p></qti-prompt>
          <qti-simple-choice identifier="A">Clearly <strong>marked</strong> answer</qti-simple-choice>
          <qti-simple-choice identifier="B">Another choice</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="RESULT">
          <qti-base-value base-type="string">${processingValue}</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
