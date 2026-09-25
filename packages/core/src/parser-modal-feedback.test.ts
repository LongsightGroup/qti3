import { interactionNameToType } from "./support.js";
import { describe, expect, it } from "vitest";
import { parseQtiModalFeedbackFragment } from "./parser-content.js";
import { parseQtiXml } from "./parser.js";

describe("modal feedback content parsing", () => {
  it.each([...interactionNameToType.keys(), "qti-future-interaction"])(
    "excludes %s from feedback but recognizes it in item content",
    (name) => {
      const fragment = `<${name} response-identifier="RESPONSE"/>`;
      const feedback = parseQtiModalFeedbackFragment(fragment);
      expect(feedback.content).toEqual([]);
      expect(feedback.diagnostics).toMatchObject([{ code: "feedback.interaction.forbidden" }]);
      const parsed =
        parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Test" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>${fragment}</qti-item-body>
      </qti-assessment-item>`);
      expect(parsed.document?.item.interactions).toHaveLength(1);
      expect(parsed.document?.item.body).toMatchObject([{ kind: "interaction" }]);
    },
  );

  it("preserves foreign elements whose names resemble interactions", () => {
    const result = parseQtiModalFeedbackFragment(
      '<qti-choice-interaction xmlns="https://example.invalid/content">Foreign content</qti-choice-interaction>',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.content).toMatchObject([
      { kind: "element", namespaceUri: "https://example.invalid/content" },
    ]);
  });

  it("omits forbidden interactions instead of indexing the item's real interactions", () => {
    const result =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback" title="Feedback" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
      <qti-item-body><qti-choice-interaction response-identifier="RESPONSE"><qti-simple-choice identifier="A">Real choice</qti-simple-choice></qti-choice-interaction></qti-item-body>
      <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="RIGHT"><p>Safe feedback<qti-choice-interaction response-identifier="MISSING"><qti-simple-choice identifier="B">Forbidden choice</qti-simple-choice></qti-choice-interaction></p></qti-modal-feedback>
    </qti-assessment-item>`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((entry) => entry.code)).toEqual([
      "feedback.interaction.forbidden",
    ]);
    expect(result.document?.item.interactions).toHaveLength(1);
    expect(result.document?.item.modalFeedback[0]).toMatchObject({
      text: "Safe feedback",
      content: [
        { kind: "element", qtiName: "p", children: [{ kind: "text", text: "Safe feedback" }] },
      ],
    });
  });

  it("parses rich fragments and variable references without synthetic declarations", () => {
    const result = parseQtiModalFeedbackFragment(
      '<p>Score: <qti-printed-variable identifier="SCORE"/></p><img src="hint.png" alt="Hint"/>',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("Hint");
    expect(result.content[0]).toMatchObject({
      children: [{ kind: "text" }, { kind: "printedVariable", identifier: "SCORE" }],
    });
  });

  it("returns XML parser errors instead of content-policy errors", () => {
    const result = parseQtiModalFeedbackFragment("<p>Unclosed");
    expect(result.content).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "xml.parse",
        message: expect.stringContaining("Mismatched closing tag"),
      }),
    );
  });
});
