import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./index.js";

describe("shared vocabulary interaction validation", () => {
  it("routes choice shared-vocabulary conflicts through the interaction validator", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-sv" title="choice-sv" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE" class="qti-selections-light qti-selections-dark">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.selectionsToneConflict",
        }),
      ]),
    );
  });
});
