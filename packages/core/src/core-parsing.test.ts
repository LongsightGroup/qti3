import { describe, expect, it } from "vitest";
import {
  createCatalogSupportResolution,
  createTextToSpeechTraversal,
  createItemSession,
  parseQtiXml,
  parseQtiDataSsml,
  validateAssessmentItem,
} from "./index.js";

describe("core parsing and validation", () => {
  it("diagnoses incomplete XML instead of materializing a partial tree as valid", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="incomplete" title="incomplete" time-dependent="false">
        <qti-item-body>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "xml.parse",
        severity: "error",
        message: "Unexpected end of document. Missing closing tag for <qti-item-body>.",
      }),
    );
  });

  it("coerces declaration values using declaration base-types", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="typed-defaults" title="typed-defaults" time-dependent="false">
        <qti-template-declaration identifier="TEMPLATE_COUNT" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>4</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-response-declaration identifier="COUNT" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>2</qti-value></qti-default-value>
          <qti-correct-response><qti-value>3</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="FLAGS" cardinality="multiple" base-type="boolean">
          <qti-default-value>
            <qti-value>true</qti-value>
            <qti-value>false</qti-value>
          </qti-default-value>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>1</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="ATTEMPTS" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="PASSED" cardinality="single" base-type="boolean">
          <qti-default-value><qti-value>false</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body><p>Typed defaults.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.document).toBeDefined();
    const document = result.document!;
    const countDeclaration = document.item.responseDeclarations.find(
      (declaration) => declaration.identifier === "COUNT",
    );
    expect(countDeclaration?.defaultValue).toBe(2);
    expect(countDeclaration?.correctResponse).toBe(3);

    const session = createItemSession(document);
    const state = session.serialize();
    expect(state.responses.COUNT).toBeUndefined();
    expect(state.responses.FLAGS).toBeUndefined();
    expect(state.outcomes.MAXSCORE).toBe(1);
    expect(state.outcomes.ATTEMPTS).toBe(0);
    expect(state.outcomes.PASSED).toBe(false);

    session.respond("COUNT", 3);
    const startedState = session.serialize();
    expect(startedState.responses.COUNT).toBe(3);
    expect(startedState.responses.FLAGS).toEqual([true, false]);
    expect(state.templateValues?.TEMPLATE_COUNT).toBe(4);
  });

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

  it("accepts qflowlearn package authoring variants used by presidents exports", () => {
    const image =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLz4=";
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="qflow-variants" title="qflow-variants" time-dependent="false">
        <qti-response-declaration identifier="ASSOCIATE" cardinality="multiple" base-type="pair"/>
        <qti-response-declaration identifier="GRAPHIC_GAP" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point"/>
        <qti-response-declaration identifier="DRAWING" cardinality="single" base-type="file"/>
        <qti-response-declaration identifier="PCI" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string">
          <qti-correct-response>
            <qti-value>Abraham Lincoln</qti-value>
            <qti-value>Lincoln</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-item-body>
          <qti-associate-interaction response-identifier="ASSOCIATE">
            <qti-simple-associable-choice identifier="A" match-max="1">Washington</qti-simple-associable-choice>
            <qti-simple-associable-choice identifier="B" match-max="1">Two terms</qti-simple-associable-choice>
          </qti-associate-interaction>
          <qti-graphic-gap-match-interaction response-identifier="GRAPHIC_GAP">
            <object data="${image}" type="image/svg+xml" width="160" height="120"/>
            <qti-gap-text identifier="LABEL" match-max="1">FDR</qti-gap-text>
            <qti-associable-hotspot identifier="TARGET" shape="circle" coords="80,60,12" match-max="1"/>
          </qti-graphic-gap-match-interaction>
          <qti-select-point-interaction response-identifier="POINT">
            <img src="${image}" alt="Timeline" width="160" height="120"/>
          </qti-select-point-interaction>
          <qti-drawing-interaction response-identifier="DRAWING">
            <object data="${image}" type="image/svg+xml" width="160" height="120"/>
          </qti-drawing-interaction>
          <qti-portable-custom-interaction
            response-identifier="PCI"
            custom-interaction-type-identifier="urn:qflow:presidents:timeline"
            module="presidentsPci">
            <qti-interaction-markup><div>Custom presidents widget</div></qti-interaction-markup>
          </qti-portable-custom-interaction>
          <p>Answer: <qti-text-entry-interaction response-identifier="TEXT"/></p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(
      result.document?.item.interactions.find((item) => item.type === "selectPoint")?.object,
    ).toMatchObject({ data: image, type: "image/svg+xml" });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.child.unsupported" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.object.required" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "declaration.correctResponse.cardinality",
        severity: "warning",
      }),
    );
  });

  it("parses position object stage separately from the movable object", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="position-stage" title="position-stage" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point"/>
        <qti-item-body>
          <qti-position-object-stage>
            <object data="stage.svg" type="image/svg+xml" width="480" height="300"/>
            <qti-position-object-interaction response-identifier="RESPONSE">
              <object data="marker.svg" type="image/svg+xml" width="64" height="48"/>
            </qti-position-object-interaction>
          </qti-position-object-stage>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const interaction = result.document?.item.interactions.find(
      (item) => item.type === "positionObject",
    );
    expect(interaction?.object).toMatchObject({ data: "marker.svg", width: "64", height: "48" });
    expect(interaction?.positionObjectStage).toMatchObject({
      data: "stage.svg",
      width: "480",
      height: "300",
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.child.unsupported" }),
    );
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

  it("preserves assessment item language metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="language" xml:lang="ja" title="language" time-dependent="false">
        <qti-item-body>
          <p>言語メタデータを保持します。</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.language).toBe("ja");
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

  it("preserves and validates item catalog metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="catalog-item" title="catalog-item" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-prompt>Choose the <span data-catalog-idref="accurate-help">accurate</span> statement.</qti-prompt>
            <qti-simple-choice identifier="A">QTI stands for Question and Test Interoperability.</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="accurate-help">
            <qti-card support="linguistic-guidance">
              <qti-html-content>Accurate means correct.</qti-html-content>
            </qti-card>
            <qti-card support="spoken">
              <qti-card-entry data-reading-type="computer-read-aloud" default="true">
                <qti-file-href mime-type="audio/mpeg">audio/accurate.mp3</qti-file-href>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.catalogInfo?.catalogs).toMatchObject([
      {
        id: "accurate-help",
        cards: [
          {
            support: "linguistic-guidance",
            htmlContent: { text: "Accurate means correct." },
          },
          {
            support: "spoken",
            entries: [
              {
                default: true,
                attributes: { "data-reading-type": "computer-read-aloud" },
                fileHrefs: [{ href: "audio/accurate.mp3", mimeType: "audio/mpeg" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("resolves catalog supports for media alternatives in reference order", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-catalog" title="media-catalog" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <p data-catalog-idref="audio-transcript">Listen to the recording.</p>
          <qti-media-interaction response-identifier="RESPONSE" data-catalog-idref="video-alternatives">
            <qti-prompt>Watch the clip.</qti-prompt>
            <video width="320" height="180">
              <source src="clips/presentation.mp4" type="video/mp4"/>
              <track kind="captions" src="captions/presentation.vtt" srclang="en" label="English"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="audio-transcript">
            <qti-card support="transcript">
              <qti-card-entry xml:lang="en" default="true">
                <qti-html-content><p>English transcript.</p></qti-html-content>
              </qti-card-entry>
              <qti-card-entry xml:lang="es">
                <qti-html-content><p>Transcripción en español.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
          <qti-catalog id="video-alternatives">
            <qti-card support="audio-description">
              <qti-card-entry default="true">
                <qti-file-href mime-type="audio/mpeg">audio/presentation-description.mp3</qti-file-href>
              </qti-card-entry>
            </qti-card>
            <qti-card support="sign-language">
              <qti-card-entry xml:lang="ase" default="true">
                <qti-html-content><p>ASL interpretation clip.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
            <qti-card support="media-alternative">
              <qti-file-href mime-type="video/mp4">video/presentation-described.mp4</qti-file-href>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);

    const spanishTranscript = createCatalogSupportResolution(result.document!, {
      supports: "transcript",
      languages: ["es"],
    });
    expect(spanishTranscript.references.map((reference) => reference.idref)).toEqual([
      "audio-transcript",
      "video-alternatives",
    ]);
    expect(spanishTranscript.references[0]?.matches).toEqual([
      expect.objectContaining({
        support: "transcript",
        language: "es",
        default: false,
        htmlContent: expect.objectContaining({ text: "Transcripción en español." }),
      }),
    ]);
    expect(spanishTranscript.references[1]?.matches).toEqual([]);

    const mediaAlternatives = createCatalogSupportResolution(result.document!, {
      supports: ["audio-description", "sign-language", "media-alternative"],
      languages: ["ase"],
    });
    expect(mediaAlternatives.references[1]?.matches).toEqual([
      expect.objectContaining({
        support: "audio-description",
        default: true,
        fileHrefs: [
          expect.objectContaining({
            href: "audio/presentation-description.mp3",
            mimeType: "audio/mpeg",
          }),
        ],
      }),
      expect.objectContaining({
        support: "sign-language",
        language: "ase",
        htmlContent: expect.objectContaining({ text: "ASL interpretation clip." }),
      }),
      expect.objectContaining({
        support: "media-alternative",
        default: true,
        fileHrefs: [
          expect.objectContaining({
            href: "video/presentation-described.mp4",
            mimeType: "video/mp4",
          }),
        ],
      }),
    ]);
  });

  it("diagnoses invalid catalog references and card content", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-catalog-item" title="bad-catalog-item" time-dependent="false">
        <qti-item-body>
          <p data-catalog-idref="missing">Term</p>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="known">
            <qti-card support="spoken"/>
            <qti-card support="spoken"><qti-file-href/></qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog.idref.reference", severity: "error" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog.card.content.required", severity: "error" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog.card.support.duplicate", severity: "error" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog.fileHref.required", severity: "error" }),
    );
  });

  it("preserves and validates item stylesheet references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stylesheet-item" title="stylesheet-item" time-dependent="false">
        <qti-stylesheet href="style/item.css" type="text/css" media="screen" title="Item styles"/>
        <qti-item-body><p>Styled item.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.stylesheets).toMatchObject([
      {
        href: "style/item.css",
        type: "text/css",
        media: "screen",
        title: "Item styles",
      },
    ]);

    const invalid = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-stylesheet-item" title="bad-stylesheet-item" time-dependent="false">
        <qti-stylesheet type="text/css"/>
        <qti-item-body/>
      </qti-assessment-item>
    `);
    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics).toContainEqual(
      expect.objectContaining({ code: "stylesheet.href.required", severity: "error" }),
    );
  });

  it("validates response declaration references and response shape", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid" title="invalid" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-order-interaction>
          <qti-choice-interaction response-identifier="MISSING">
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.responseIdentifier.reference" }),
        expect.objectContaining({ code: "interaction.cardinality" }),
      ]),
    );
  });

  it("attaches source locations and paths to parsed model nodes and validation diagnostics", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="located" title="located" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="MISSING">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="A">Duplicate</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.source).toMatchObject({
      line: 2,
      column: 7,
      path: "/qti-assessment-item",
    });
    expect(result.document?.item.interactions[0]?.source).toMatchObject({
      line: 5,
      column: 11,
      path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]",
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.responseIdentifier.reference",
          path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]",
          source: expect.objectContaining({ line: 5, column: 11 }),
        }),
        expect.objectContaining({
          code: "choice.identifier.duplicate",
          path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]/qti-simple-choice[2]",
          source: expect.objectContaining({ line: 7, column: 13 }),
        }),
      ]),
    );
  });

  it("validates direct child contracts for supported interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-child" title="bad-child" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10">
            <qti-simple-choice identifier="A">Not allowed here</qti-simple-choice>
          </qti-slider-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.child.unsupported",
        message: "qti-slider-interaction does not allow qti-simple-choice as a direct child.",
        path: "/qti-assessment-item/qti-item-body[1]/qti-slider-interaction[1]/qti-simple-choice[1]",
        source: expect.objectContaining({ line: 6, column: 13 }),
      }),
    );
  });

  it("does not mask missing or unsupported declaration attributes with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" time-dependent="false">
        <qti-response-declaration cardinality="many" base-type="nonsense"/>
        <qti-outcome-declaration identifier="SCORE"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.identifier).toBe("");
    expect(result.document?.item.responseDeclarations[0]?.identifier).toBe("");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "identifier.required" }),
        expect.objectContaining({ code: "declaration.cardinality" }),
        expect.objectContaining({ code: "declaration.baseType" }),
        expect.objectContaining({ code: "declaration.cardinality.required" }),
        expect.objectContaining({ code: "declaration.baseType.required" }),
      ]),
    );
  });

  it("requires the QTI ASI namespace and item body for assessment items", () => {
    const wrongNamespace = parseQtiXml(`
      <qti-assessment-item xmlns="https://example.invalid/not-qti" identifier="wrong-namespace" title="wrong-namespace" time-dependent="false">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(wrongNamespace.ok).toBe(false);
    expect(wrongNamespace.document).toBeUndefined();
    expect(wrongNamespace.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "qti.root",
        message: expect.stringContaining("Expected qti-assessment-item in namespace"),
      }),
    );

    const missingBody = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-body" title="missing-body" time-dependent="false"/>
    `);

    expect(missingBody.ok).toBe(false);
    expect(missingBody.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "itemBody.required",
        message: "qti-assessment-item requires a qti-item-body.",
      }),
    );
  });

  it("requires schema-required assessment item root attributes", () => {
    const missingAttributes = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-root-attrs">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(missingAttributes.ok).toBe(false);
    expect(missingAttributes.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "assessmentItem.title.required" }),
        expect.objectContaining({ code: "assessmentItem.timeDependent.required" }),
      ]),
    );

    const invalidTimeDependent = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-time" title="bad-time" time-dependent="maybe">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(invalidTimeDependent.ok).toBe(false);
    expect(invalidTimeDependent.diagnostics).toContainEqual(
      expect.objectContaining({ code: "assessmentItem.timeDependent.boolean" }),
    );
  });

  it("does not mask missing choice identifiers with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-choice-id" title="missing-choice-id" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice>A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.interactions[0]?.choices[0]).toMatchObject({
      identifier: "",
      text: "A",
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "identifier.required",
        message: "qti-simple-choice requires a non-empty identifier.",
        path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]/qti-simple-choice[1]",
      }),
    );
  });

  it("exposes validation independent of XML parsing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(validateAssessmentItem(result.document!).ok).toBe(true);
  });

  it("validates and exposes Data-SSML read-aloud metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="data-ssml" title="data-ssml" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <p>Read <span id="mrna" data-ssml='{"sub":{"alias":"messenger RNA"}}'>mRNA</span>.</p>
          <p><span data-qti-suppress-tts="computer-read-aloud">Visual read-aloud skip.</span></p>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-prompt data-ssml='{"prosody":{"rate":"slow"}}'>Choose the word.</qti-prompt>
            <qti-simple-choice identifier="A" data-ssml='{"phoneme":{"ph":"t@meItoU","alphabet":"x-sampa"}}'>tomato</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "content.dataSsml.invalid" }),
    );
    expect(parseQtiDataSsml('{"say-as":{"interpret-as":"ordinal"}}')).toEqual({
      ok: true,
      value: { "say-as": { "interpret-as": "ordinal" } },
    });

    const traversal = createTextToSpeechTraversal(result.document!);
    expect(traversal.diagnostics).toEqual([]);
    expect(traversal.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "content",
          text: "mRNA",
          dataSsml: '{"sub":{"alias":"messenger RNA"}}',
          ssml: { sub: { alias: "messenger RNA" } },
        }),
        expect.objectContaining({
          kind: "content",
          text: "Visual read-aloud skip.",
          suppressTts: ["computer-read-aloud"],
        }),
        expect.objectContaining({
          kind: "interactionPrompt",
          text: "Choose the word.",
          ssml: { prosody: { rate: "slow" } },
        }),
        expect.objectContaining({
          kind: "choice",
          choiceIdentifier: "A",
          text: "tomato",
          ssml: { phoneme: { ph: "t@meItoU", alphabet: "x-sampa" } },
        }),
      ]),
    );
  });

  it("diagnoses invalid Data-SSML metadata without blocking item parsing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-data-ssml" title="bad-data-ssml" time-dependent="false">
        <qti-item-body>
          <p>
            <span data-ssml="not json">Invalid JSON</span>
            <span data-ssml='{"sub":{}}'>Missing alias</span>
            <span data-ssml='{"mark":{"name":"x"}}'>Unsupported function</span>
          </p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const diagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "content.dataSsml.invalid",
    );
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining("data-ssml must be valid JSON"),
        }),
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining("sub.alias is required"),
        }),
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining('Unsupported Data-SSML function "mark"'),
        }),
      ]),
    );

    const traversal = createTextToSpeechTraversal(result.document!);
    expect(traversal.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Missing alias",
          ssmlErrors: ["sub.alias is required."],
        }),
      ]),
    );
    expect(parseQtiDataSsml("[]")).toEqual({
      ok: false,
      errors: ["data-ssml must be a JSON object."],
    });
  });

  it("validates declaration default and correct response values against base types", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-declaration-values" title="bad-declaration-values" time-dependent="false">
        <qti-response-declaration identifier="INT_RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response>
            <qti-value>abc</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="POINT_RESPONSE" cardinality="single" base-type="point">
          <qti-correct-response>
            <qti-value>10</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="PAIR_RESPONSE" cardinality="multiple" base-type="directedPair">
          <qti-correct-response>
            <qti-value>A</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="SINGLE_RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response>
            <qti-value>A</qti-value>
            <qti-value>B</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="BOOLEAN_OUTCOME" cardinality="single" base-type="boolean">
          <qti-default-value>
            <qti-value>yes</qti-value>
          </qti-default-value>
        </qti-outcome-declaration>
        <qti-template-declaration identifier="FLOAT_TEMPLATE" cardinality="single" base-type="float">
          <qti-default-value>
            <qti-value>not-a-float</qti-value>
          </qti-default-value>
        </qti-template-declaration>
        <qti-item-body>
          <qti-custom-interaction response-identifier="INT_RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("INT_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("POINT_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("PAIR_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.cardinality",
          message: expect.stringContaining("SINGLE_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.defaultValue.baseType",
          message: expect.stringContaining("BOOLEAN_OUTCOME"),
        }),
        expect.objectContaining({
          code: "declaration.defaultValue.baseType",
          message: expect.stringContaining("FLOAT_TEMPLATE"),
        }),
      ]),
    );
  });

  it("validates correct response choice references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-correct-response-refs" title="bad-correct-response-refs" time-dependent="false">
        <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>MISSING</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="MATCH" cardinality="multiple" base-type="directedPair">
          <qti-correct-response><qti-value>A MISSING</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="CHOICE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
          <qti-match-interaction response-identifier="MATCH">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
            </qti-simple-match-set>
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "response.correctResponse.reference",
          path: "/qti-assessment-item/qti-response-declaration[1]",
        }),
        expect.objectContaining({
          code: "response.correctResponse.reference",
          path: "/qti-assessment-item/qti-response-declaration[2]",
        }),
      ]),
    );
  });
});
