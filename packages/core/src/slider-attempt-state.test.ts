import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { createItemSession } from "./session.js";

const sliderXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="slider-state" title="slider-state" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10" step="3"/>
  </qti-item-body>
</qti-assessment-item>`;

describe("QTI slider attempt state", () => {
  it("rejects a restored response outside the authored slider domain", () => {
    const parsed = parseQtiXml(sliderXml);
    const document = parsed.document;
    if (!document) throw new Error("Expected a parsed slider document.");
    const state = createItemSession(document).serialize();

    expect(() =>
      createItemSession(document, {
        ...state,
        responses: { RESPONSE: 4 },
      }),
    ).toThrow("Cannot restore response RESPONSE: value 4 is not in the authored slider domain.");
  });

  it("restores a response on the authored slider domain", () => {
    const parsed = parseQtiXml(sliderXml);
    const document = parsed.document;
    if (!document) throw new Error("Expected a parsed slider document.");
    const state = createItemSession(document).serialize();
    const restored = createItemSession(document, {
      ...state,
      responses: { RESPONSE: 3 },
    });

    expect(restored.serialize().responses.RESPONSE).toBe(3);
  });
});
