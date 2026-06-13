import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";

describe("QTI custom interaction parsing", () => {
  it("parses legacy custom interaction child markup with attributes and text", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-markup" title="custom-markup" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE" class="customWidget" data-mode="alpha">
            <qti-prompt>Answer with the widget.</qti-prompt>
            <div class="widget">Hello <span data-value="42">there</span></div>
          </qti-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    const interaction = result.document?.item.interactions[0];
    expect(result.ok).toBe(true);
    expect(interaction).toMatchObject({
      type: "custom",
      qtiName: "qti-custom-interaction",
      responseIdentifier: "RESPONSE",
      prompt: "Answer with the widget.",
      customInteraction: {
        dataAttributes: { "data-mode": "alpha" },
      },
    });
    expect(interaction?.customInteraction?.interactionMarkup).toEqual([
      expect.objectContaining({
        kind: "element",
        qtiName: "div",
        attributes: expect.objectContaining({ class: "widget" }),
        children: expect.arrayContaining([
          expect.objectContaining({ kind: "text", text: "Hello " }),
          expect.objectContaining({
            kind: "element",
            qtiName: "span",
            attributes: expect.objectContaining({ "data-value": "42" }),
          }),
        ]),
      }),
    ]);
    expect(interaction?.customInteraction?.interactionMarkupRaw).toContain(
      '<div class="widget">Hello <span data-value="42">there</span></div>',
    );
    expect(interaction?.customInteraction?.interactionMarkupRaw).not.toContain("qti-prompt");
  });

  it("preserves multiple custom interaction markup siblings", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-siblings" title="custom-siblings" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE">
            <section data-part="a">A</section>
            <section data-part="b">B</section>
          </qti-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(
      result.document?.item.interactions[0]?.customInteraction?.interactionMarkup.filter(
        (node) => node.kind === "element",
      ),
    ).toEqual([
      expect.objectContaining({ qtiName: "section", attributes: { "data-part": "a" } }),
      expect.objectContaining({ qtiName: "section", attributes: { "data-part": "b" } }),
    ]);
  });

  it("diagnoses nested QTI interactions inside legacy custom markup", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-nested-interaction" title="custom-nested-interaction" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="NESTED" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE">
            <div>
              <qti-text-entry-interaction response-identifier="NESTED"/>
            </div>
          </qti-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.custom.markupInteraction",
          severity: "error",
          path: "/qti-assessment-item/qti-item-body[1]/qti-custom-interaction[1]/div[1]/qti-text-entry-interaction[1]",
        }),
      ]),
    );
  });

  it("parses printed variables and feedback inside legacy custom markup", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-markup-qti" title="custom-markup-qti" time-dependent="false">
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE">
            <div>
              <qti-printed-variable identifier="RESPONSE"/>
              <qti-feedback-inline identifier="FB1" outcome-identifier="SCORE" show-hide="show">Good.</qti-feedback-inline>
            </div>
          </qti-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const markup =
      result.document?.item.interactions[0]?.customInteraction?.interactionMarkup ?? [];
    expect(markup).toEqual([expect.objectContaining({ kind: "element", qtiName: "div" })]);
    const divChildren = markup[0]?.kind === "element" ? markup[0].children : [];
    expect(divChildren).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "printedVariable", identifier: "RESPONSE" }),
        expect.objectContaining({
          kind: "feedback",
          feedbackType: "inline",
          identifier: "FB1",
        }),
      ]),
    );
  });

  it("returns undefined raw markup when only a prompt is present", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-prompt-only" title="custom-prompt-only" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE">
            <qti-prompt>Prompt only.</qti-prompt>
          </qti-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.customInteraction).toMatchObject({
      interactionMarkup: [],
      interactionMarkupRaw: undefined,
    });
  });

  it("does not treat unknown unsupported interactions as legacy custom interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-not-custom" title="unsupported-not-custom" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-position-slider-interaction response-identifier="RESPONSE">
            <div>Unsupported widget markup.</div>
          </qti-position-slider-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "custom",
      registryStatus: "unsupported",
      qtiName: "qti-position-slider-interaction",
    });
    expect(result.document?.item.interactions[0]?.customInteraction).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.unsupported", severity: "warning" }),
      ]),
    );
  });
});
