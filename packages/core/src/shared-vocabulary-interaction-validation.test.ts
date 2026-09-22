import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./index.js";
import { readFileSync } from "node:fs";

describe("shared vocabulary interaction validation", () => {
  it("preserves certification width 5 without an unsupported-width warning", () => {
    const xml = readFileSync(
      new URL(
        "../../fixtures/packages/sv-matrix/items/interaction-input-width-five.xml",
        import.meta.url,
      ),
      "utf8",
    );
    const result = parseQtiXml(xml);
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    expect(
      result.document?.item.interactions.map((interaction) => interaction.attributes.class),
    ).toEqual(["qti-input-width-5", "qti-input-width-5"]);
    const unsupported = parseQtiXml(xml.replaceAll("qti-input-width-5", "qti-input-width-7"));
    expect(unsupported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.sharedVocabulary.inputWidthInvalid",
        severity: "warning",
      }),
    );
  });

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
