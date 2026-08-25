import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";

describe("QTI item content parsing", () => {
  it("preserves authored gap match sentence segments", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-segments" title="gap-segments" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-gap-match-interaction response-identifier="RESPONSE">
            <qti-prompt>Complete the sentence.</qti-prompt>
            <qti-gap-text identifier="A" match-max="1">response declaration</qti-gap-text>
            <p>An interaction writes to a <qti-gap identifier="G1" class="qti-input-width-10"/>.</p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.gapMatchSegments).toEqual([
      { kind: "text", text: "An interaction writes to a " },
      expect.objectContaining({
        kind: "gap",
        identifier: "G1",
        attributes: expect.objectContaining({ class: "qti-input-width-10" }),
      }),
      { kind: "text", text: "." },
      { kind: "text", text: " " },
    ]);
  });

  it("captures parent prose for inline interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-choice" title="inline-choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <p>Choose <qti-inline-choice-interaction response-identifier="RESPONSE">
            <qti-inline-choice identifier="A">A</qti-inline-choice>
            <qti-inline-choice identifier="B">B</qti-inline-choice>
          </qti-inline-choice-interaction>.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "inlineChoice",
      contextText: "Choose.",
    });
  });

  it("preserves rich inline choice content with plain text fallbacks", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rich-inline-choice" title="rich-inline-choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <p>Choose <qti-inline-choice-interaction response-identifier="RESPONSE">
            <qti-inline-choice identifier="A"><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mn>1</mn><mo>+</mo><mn>1</mn></mrow></math></qti-inline-choice>
            <qti-inline-choice identifier="B"><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="two plus two"><mrow><mn>2</mn><mo>+</mo><mn>2</mn></mrow></math></qti-inline-choice>
            <qti-inline-choice identifier="C"><img alt="shaded square" src="data:image/svg+xml,%3Csvg/%3E"/></qti-inline-choice>
          </qti-inline-choice-interaction>.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const choices = result.document?.item.interactions[0]?.choices;
    expect(choices?.[0]).toMatchObject({
      identifier: "A",
      text: "1 + 1",
      role: "inlineChoice",
    });
    expect(
      choices?.[0]?.content?.some((node) => "qtiName" in node && node.qtiName === "math"),
    ).toBe(true);
    expect(choices?.[1]).toMatchObject({
      identifier: "B",
      text: "two plus two",
      role: "inlineChoice",
    });
    expect(
      choices?.[1]?.content?.some((node) => "qtiName" in node && node.qtiName === "math"),
    ).toBe(true);
    expect(choices?.[2]).toMatchObject({
      identifier: "C",
      text: "shaded square",
      role: "inlineChoice",
    });
    expect(choices?.[2]?.content?.some((node) => "qtiName" in node && node.qtiName === "img")).toBe(
      true,
    );
  });

  it("decodes numeric entities in MathML while preserving literal entity text fallbacks", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mathml-entities" title="mathml-entities" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
            <qti-simple-choice identifier="A"><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>&#937;</mi><mo>+</mo><mi>&#x3A9;</mi></mrow></math></qti-simple-choice>
            <qti-simple-choice identifier="B"><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>&amp;#x398;</mi></mrow></math></qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const choices = result.document?.item.interactions[0]?.choices;
    expect(choices?.[0]).toMatchObject({
      identifier: "A",
      text: "Ω + Ω",
    });
    expect(choices?.[1]).toMatchObject({
      identifier: "B",
      text: "&#x398;",
    });

    const firstMath = choices?.[0]?.content?.[0];
    const secondMath = choices?.[1]?.content?.[0];
    expect(firstMath).toMatchObject({ kind: "element", qtiName: "math" });
    expect(secondMath).toMatchObject({ kind: "element", qtiName: "math" });
    expect(firstMath?.kind === "element" ? firstMath.children : []).toEqual([
      expect.objectContaining({
        kind: "element",
        qtiName: "mrow",
        children: [
          expect.objectContaining({
            kind: "element",
            qtiName: "mi",
            children: [expect.objectContaining({ kind: "text", text: "Ω" })],
          }),
          expect.objectContaining({
            kind: "element",
            qtiName: "mo",
            children: [expect.objectContaining({ kind: "text", text: "+" })],
          }),
          expect.objectContaining({
            kind: "element",
            qtiName: "mi",
            children: [expect.objectContaining({ kind: "text", text: "Ω" })],
          }),
        ],
      }),
    ]);
    expect(secondMath?.kind === "element" ? secondMath.children : []).toEqual([
      expect.objectContaining({
        kind: "element",
        qtiName: "mrow",
        children: [
          expect.objectContaining({
            kind: "element",
            qtiName: "mi",
            children: [expect.objectContaining({ kind: "text", text: "&#x398;" })],
          }),
        ],
      }),
    ]);
  });

  it("preserves whitespace around inline emphasis in item body", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-em" title="inline-em" time-dependent="false">
        <qti-item-body>
          <p>Note: The <em>orientation</em> of the layout of the drivers should be vertical.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const paragraph = result.document?.item.body.find(
      (node): node is Extract<typeof node, { kind: "element" }> =>
        node.kind === "element" && node.qtiName === "p",
    );
    expect(paragraph).toBeDefined();
    if (paragraph?.kind !== "element") return;
    expect(paragraph.children).toEqual([
      expect.objectContaining({ kind: "text", text: "Note: The " }),
      expect.objectContaining({
        kind: "element",
        qtiName: "em",
        children: [expect.objectContaining({ kind: "text", text: "orientation" })],
      }),
      expect.objectContaining({
        kind: "text",
        text: " of the layout of the drivers should be vertical.",
      }),
    ]);
  });

  it("drops inter-block indentation from item body while preserving inline spaces", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="block-indent" title="block-indent" time-dependent="false">
        <qti-item-body>
          <p>First paragraph.</p>
          <p>Second paragraph.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const body = result.document?.item.body ?? [];

    expect(body.every((node) => node.kind !== "text")).toBe(true);
    expect(body).toHaveLength(2);
    expect(body.map((node) => (node.kind === "element" ? node.qtiName : node.kind))).toEqual([
      "p",
      "p",
    ]);
  });

  it("preserves item body mixed-content order with embedded interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mixed-body" title="mixed-body" time-dependent="false">
        <qti-response-declaration identifier="FIRST" cardinality="single" base-type="identifier"/>
        <qti-response-declaration identifier="SECOND" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <p>Choose <qti-inline-choice-interaction response-identifier="FIRST">
            <qti-inline-choice identifier="A">response</qti-inline-choice>
            <qti-inline-choice identifier="B">outcome</qti-inline-choice>
          </qti-inline-choice-interaction> and type <qti-text-entry-interaction response-identifier="SECOND"/>.</p>
          <p>Score: <qti-printed-variable identifier="SCORE"/></p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions.map((interaction) => interaction.type)).toEqual([
      "inlineChoice",
      "textEntry",
    ]);
    const [firstParagraph, secondParagraph] = result.document?.item.body ?? [];
    expect(firstParagraph).toMatchObject({ kind: "element", qtiName: "p" });
    expect(firstParagraph?.kind === "element" ? firstParagraph.children : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: expect.stringContaining("Choose") }),
        expect.objectContaining({
          kind: "interaction",
          interactionIndex: 0,
          responseIdentifier: "FIRST",
        }),
        expect.objectContaining({ kind: "text", text: expect.stringContaining("and type") }),
        expect.objectContaining({
          kind: "interaction",
          interactionIndex: 1,
          responseIdentifier: "SECOND",
        }),
      ]),
    );
    expect(secondParagraph).toMatchObject({ kind: "element", qtiName: "p" });
    expect(secondParagraph?.kind === "element" ? secondParagraph.children : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: expect.stringContaining("Score") }),
        expect.objectContaining({ kind: "printedVariable", identifier: "SCORE" }),
      ]),
    );
  });

  it("preserves rich interaction prompt content", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rich-prompt" title="rich-prompt" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE">
            <qti-prompt>Order <math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mfrac><mi>a</mi><mi>b</mi></mfrac><annotation encoding="SnuggleTeX">\\[ \\frac{a}{b} \\]</annotation></semantics></math>.</qti-prompt>
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-order-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const interaction = result.document?.item.interactions[0];
    expect(interaction?.promptContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: expect.stringContaining("Order") }),
        expect.objectContaining({ kind: "element", qtiName: "math" }),
      ]),
    );
    expect(interaction?.prompt).toContain("Order");
    expect(interaction?.prompt).not.toContain("\\[");
  });
});
