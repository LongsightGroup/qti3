import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { validateSharedVocabularyExtendedText } from "./shared-vocabulary-validation.js";

describe("shared vocabulary validation", () => {
  it("diagnoses invalid extended text height shared vocabulary", () => {
    const diagnostics = validateSharedVocabularyExtendedText({
      classNames: ["qti-height-lines-4", "qti-height-lines-6", "qti-height-lines-15"],
      subjectQtiName: "qti-extended-text-interaction",
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.extendedTextHeightLinesInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-height-lines-4"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.extendedTextHeightLinesConflict",
          severity: "warning",
          message: expect.stringMatching(/qti-height-lines-6.*qti-height-lines-15/),
        }),
      ]),
    );
  });

  it("diagnoses extended text counter conflict and invalid counter classes", () => {
    const diagnostics = validateSharedVocabularyExtendedText({
      classNames: ["qti-counter-up", "qti-counter-down", "qti-counter-left"],
      subjectQtiName: "qti-extended-text-interaction",
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.extendedTextCounterConflict",
          severity: "warning",
          message: expect.stringMatching(/qti-counter-up.*qti-counter-down/),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.extendedTextCounterInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-counter-left"),
        }),
      ]),
    );
  });

  it("diagnoses extended text counter conflict when parsing items", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter-conflict" title="extended-text-counter-conflict" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-extended-text-interaction response-identifier="RESPONSE" class="qti-counter-up qti-counter-down"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.extendedTextCounterConflict",
          severity: "warning",
          message: expect.stringMatching(/qti-counter-up.*qti-counter-down/),
        }),
      ]),
    );
  });
});
