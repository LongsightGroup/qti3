import { describe, expect, it } from "vitest";
import { deprecatedInteractionSupport, interactionSupport, parseQtiXml } from "./index.js";

describe("@longsightgroup/qti3-core cross-cutting", () => {
  it("tracks every target QTI 3 interaction type", () => {
    expect(interactionSupport.map((item) => item.qtiName)).toMatchInlineSnapshot(`
      [
        "qti-associate-interaction",
        "qti-choice-interaction",
        "qti-drawing-interaction",
        "qti-end-attempt-interaction",
        "qti-extended-text-interaction",
        "qti-gap-match-interaction",
        "qti-graphic-associate-interaction",
        "qti-graphic-gap-match-interaction",
        "qti-graphic-order-interaction",
        "qti-hotspot-interaction",
        "qti-hottext-interaction",
        "qti-inline-choice-interaction",
        "qti-match-interaction",
        "qti-media-interaction",
        "qti-order-interaction",
        "qti-position-object-interaction",
        "qti-portable-custom-interaction",
        "qti-select-point-interaction",
        "qti-slider-interaction",
        "qti-text-entry-interaction",
        "qti-upload-interaction",
      ]
    `);
  });

  it("tracks deprecated interactions outside the runtime target set", () => {
    expect(deprecatedInteractionSupport).toMatchObject([
      {
        qtiName: "qti-custom-interaction",
        support: "deprecated",
      },
    ]);

    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="deprecated-custom" title="deprecated-custom" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.deprecated", severity: "warning" }),
    );
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "custom",
      registryStatus: "deprecated",
      qtiName: "qti-custom-interaction",
    });
  });

  it("diagnoses unknown QTI interaction elements", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-interaction" title="unsupported-interaction" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-unsupported-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "custom",
      registryStatus: "unsupported",
      qtiName: "qti-unsupported-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.unsupported",
        severity: "warning",
        path: "/qti-assessment-item/qti-item-body[1]/qti-unsupported-interaction[1]",
      }),
    );
  });

  it("marks registered current interactions as supported", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="supported-interaction" title="supported-interaction" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "choice",
      registryStatus: "supported",
      qtiName: "qti-choice-interaction",
    });
  });

  it("diagnoses conflicting choice shared-vocabulary layout classes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="shared-vocab-conflict" title="shared-vocab-conflict" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE" class="qti-labels-none qti-labels-decimal qti-labels-cjk-ideographic qti-labels-lower-alpha qti-labels-suffix-period qti-labels-suffix-parenthesis qti-orientation-horizontal qti-orientation-vertical qti-choices-stacking-2 qti-choices-stacking-4 qti-choices-stacking-6">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.labelsConflict",
          severity: "warning",
          message: expect.stringContaining("qti-labels-none takes precedence"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.labelSuffixConflict",
          severity: "warning",
          message: expect.stringContaining("qti-labels-suffix-period"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orientationConflict",
          severity: "warning",
          message: expect.stringContaining("qti-orientation-horizontal takes precedence"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.stackingConflict",
          severity: "warning",
          message: expect.stringContaining("first valid stacking class"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.stackingInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-choices-stacking-6"),
        }),
      ]),
    );
  });

  it("diagnoses order shared-vocabulary layout conflicts", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-shared-vocab-conflict" title="order-shared-vocab-conflict" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE" class="qti-labels-upper-alpha qti-labels-decimal qti-choices-left qti-choices-top qti-orientation-horizontal qti-orientation-vertical" data-choices-container-width="wide">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-order-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.labelsConflict",
          severity: "warning",
          message: expect.stringContaining("qti-labels-decimal takes precedence"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orderChoicesPositionConflict",
          severity: "warning",
          message: expect.stringContaining("first position class"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orientationConflict",
          severity: "warning",
          message: expect.stringContaining("qti-order-interaction"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orderChoicesContainerWidth",
          severity: "warning",
          message: expect.stringContaining("positive pixel value"),
        }),
      ]),
    );
  });

  it("diagnoses match and gap shared-vocabulary choices positioning conflicts", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="position-shared-vocab-conflict" title="position-shared-vocab-conflict" time-dependent="false">
        <qti-response-declaration identifier="MATCH_RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="GAP_RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-match-interaction response-identifier="MATCH_RESPONSE" class="qti-choices-right qti-choices-bottom">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
            </qti-simple-match-set>
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-match-interaction>
          <qti-gap-match-interaction response-identifier="GAP_RESPONSE" class="qti-choices-left qti-choices-top" data-choices-container-width="wide">
            <qti-gap-text identifier="A" match-max="1">A</qti-gap-text>
            <p><qti-gap identifier="G1"/></p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orderChoicesPositionConflict",
          severity: "warning",
          message: expect.stringContaining("qti-match-interaction"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orderChoicesPositionConflict",
          severity: "warning",
          message: expect.stringContaining("qti-gap-match-interaction"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.orderChoicesContainerWidth",
          severity: "warning",
          message: expect.stringContaining("qti-gap-match-interaction"),
        }),
      ]),
    );
  });

  it("diagnoses invalid gap match input width shared vocabulary", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-input-width" title="gap-input-width" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-gap-match-interaction response-identifier="RESPONSE" class="qti-gap-placement">
            <qti-gap-text identifier="A" match-max="1">A</qti-gap-text>
            <p><qti-gap identifier="G1" class="qti-input-width-8"/></p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.gapInputWidthInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-input-width-8"),
        }),
      ]),
    );
  });

  it("diagnoses conflicting gap match input width shared vocabulary", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-input-width-conflict" title="gap-input-width-conflict" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-gap-match-interaction response-identifier="RESPONSE">
            <qti-gap-text identifier="A" match-max="1">A</qti-gap-text>
            <p><qti-gap identifier="G1" class="qti-input-width-10 qti-input-width-3"/></p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.gapInputWidthConflict",
          severity: "warning",
          message: expect.stringMatching(/qti-input-width-10.*qti-input-width-3/),
        }),
      ]),
    );
  });

  it("diagnoses invalid interaction input width shared vocabulary", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="interaction-input-width" title="interaction-input-width" time-dependent="false">
        <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <p>Type <qti-text-entry-interaction response-identifier="TEXT" class="qti-input-width-8"/>.</p>
          <p>Choose <qti-inline-choice-interaction response-identifier="CHOICE" class="qti-input-width-12">
            <qti-inline-choice identifier="A">A</qti-inline-choice>
            <qti-inline-choice identifier="B">B</qti-inline-choice>
          </qti-inline-choice-interaction>.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.inputWidthInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-text-entry-interaction"),
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.inputWidthInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-inline-choice-interaction"),
        }),
      ]),
    );
  });

  it("diagnoses conflicting interaction input width shared vocabulary", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="interaction-input-width-conflict" title="interaction-input-width-conflict" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <p>Type <qti-text-entry-interaction response-identifier="RESPONSE" class="qti-input-width-20 qti-input-width-4"/>.</p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.inputWidthConflict",
          severity: "warning",
          message: expect.stringMatching(/qti-input-width-20.*qti-input-width-4/),
        }),
      ]),
    );
  });

  it("diagnoses match tabular shared-vocabulary context mistakes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-tabular-shared-vocab" title="match-tabular-shared-vocab" time-dependent="false">
        <qti-response-declaration identifier="FIRST" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="SECOND" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="THIRD" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="FOURTH" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-match-interaction response-identifier="FIRST" class="qti-header-hidden" data-first-column-header="Rows">
            <qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice></qti-simple-match-set>
            <qti-simple-match-set><qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice></qti-simple-match-set>
          </qti-match-interaction>
          <qti-match-interaction response-identifier="SECOND" class="qti-match-tabular qti-header-hidden" data-first-column-header="Rows">
            <qti-simple-match-set><qti-simple-associable-choice identifier="C" match-max="1">C</qti-simple-associable-choice></qti-simple-match-set>
            <qti-simple-match-set><qti-simple-associable-choice identifier="D" match-max="1">D</qti-simple-associable-choice></qti-simple-match-set>
          </qti-match-interaction>
          <qti-match-interaction response-identifier="THIRD" class="qti-match-tabular qti-choices-right" data-choices-container-width="160" data-first-column-header="Rows">
            <qti-simple-match-set><qti-simple-associable-choice identifier="E" match-max="1">E</qti-simple-associable-choice></qti-simple-match-set>
            <qti-simple-match-set><qti-simple-associable-choice identifier="F" match-max="1">F</qti-simple-associable-choice></qti-simple-match-set>
          </qti-match-interaction>
          <qti-match-interaction response-identifier="FOURTH" class="qti-match-tabular">
            <qti-simple-match-set><qti-simple-associable-choice identifier="G" match-max="1">G</qti-simple-associable-choice></qti-simple-match-set>
            <qti-simple-match-set><qti-simple-associable-choice identifier="H" match-max="1">H</qti-simple-associable-choice></qti-simple-match-set>
          </qti-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.sharedVocabulary.matchTabularContext",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.matchTabularHeaderHidden",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.matchTabularChoicesConflict",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "interaction.sharedVocabulary.matchTabularFirstColumnHeader",
          severity: "warning",
        }),
      ]),
    );
  });

  it("diagnoses invalid item-body shared-vocabulary layout classes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="layout-shared-vocab-invalid" title="layout-shared-vocab-invalid" time-dependent="false">
        <qti-item-body>
          <div class="qti-layout-row">
            <div class="qti-layout-col8 qti-layout-offset2">Stimulus</div>
            <div class="qti-layout-col4">Interaction</div>
          </div>
          <div class="qti-layout-row">
            <div class="qti-layout-col-13 qti-layout-offset-12">Invalid span and offset</div>
          </div>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "item.sharedVocabulary.layoutRowOverflow",
          severity: "warning",
          message: expect.stringContaining("14"),
        }),
        expect.objectContaining({
          code: "item.sharedVocabulary.layoutColumnInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-layout-col-13"),
        }),
        expect.objectContaining({
          code: "item.sharedVocabulary.layoutOffsetInvalid",
          severity: "warning",
          message: expect.stringContaining("qti-layout-offset-12"),
        }),
      ]),
    );
  });

  it("parses picture-backed drawing canvases", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-picture" title="drawing-picture" time-dependent="false">
        <qti-response-declaration identifier="DRAWING" cardinality="single" base-type="file"/>
        <qti-item-body>
          <qti-drawing-interaction response-identifier="DRAWING">
            <qti-prompt>Annotate the canvas.</qti-prompt>
            <picture>
              <source srcset="canvas.webp 1x" type="image/webp"/>
              <img src="canvas.png" alt="Drawing canvas" width="320" height="180"/>
            </picture>
          </qti-drawing-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      data: "canvas.png",
      type: "image/*",
      width: "320",
      height: "180",
      text: "Drawing canvas",
      sources: [expect.objectContaining({ src: "canvas.webp", type: "image/webp" })],
    });
  });

  it("uses object alt text as graphical object text", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="object-alt" title="object-alt" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="timeline.png" alt="Timeline graphic with three eras." type="image/png" width="480" height="260"/>
            <qti-hotspot-choice identifier="A" shape="circle" coords="120,130,22"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      text: "Timeline graphic with three eras.",
    });
  });

  it("requires drawing interactions to bind a single file response and canvas object", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-contract" title="drawing-contract" time-dependent="false">
        <qti-response-declaration identifier="DRAWING" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-drawing-interaction response-identifier="DRAWING">
            <qti-prompt>Draw a response.</qti-prompt>
          </qti-drawing-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.baseType" }),
        expect.objectContaining({ code: "interaction.object.required" }),
      ]),
    );
  });

  it("rejects source-only drawing canvases because no canvas image is renderable", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-source-only" title="drawing-source-only" time-dependent="false">
        <qti-response-declaration identifier="DRAWING" cardinality="single" base-type="file"/>
        <qti-item-body>
          <qti-drawing-interaction response-identifier="DRAWING">
            <object>
              <source src="canvas.svg" type="image/svg+xml"/>
            </object>
          </qti-drawing-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.object.required" }),
    );
  });

  it("preserves object asset metadata on media-backed interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media" title="media" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false">
            <object data="clips/washington.mp3" type="audio/mpeg" width="320" height="32">
              Washington audio
            </object>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      data: "clips/washington.mp3",
      type: "audio/mpeg",
      width: "320",
      height: "32",
      text: "Washington audio",
    });
  });

  it("preserves audio and video source and track metadata on media interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-sources" title="media-sources" time-dependent="false">
        <qti-response-declaration identifier="AUDIO_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="VIDEO_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="AUDIO_RESPONSE" autostart="false">
            <audio width="320" height="32">
              <source src="clips/washington.mp3" type="audio/mpeg"/>
            </audio>
          </qti-media-interaction>
          <qti-media-interaction response-identifier="VIDEO_RESPONSE" autostart="false" loop="true">
            <video width="640" height="360">
              <source src="clips/bubble.mp4" type="video/mp4"/>
              <source src="clips/bubble.webm"/>
              <track kind="captions" src="captions/bubble.vtt" srclang="en" label="English" default="default"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      type: "audio/mpeg",
      sources: [{ src: "clips/washington.mp3", type: "audio/mpeg" }],
    });
    expect(result.document?.item.interactions[1]?.object).toMatchObject({
      type: "video/mp4",
      width: "640",
      height: "360",
      sources: [
        { src: "clips/bubble.mp4", type: "video/mp4" },
        { src: "clips/bubble.webm", type: "video/*" },
      ],
      tracks: [
        {
          kind: "captions",
          src: "captions/bubble.vtt",
          srclang: "en",
          label: "English",
          default: true,
        },
      ],
    });
  });

  it("validates media response declarations and playback attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-media" title="bad-media" time-dependent="false">
        <qti-response-declaration identifier="WRONG" cardinality="multiple" base-type="identifier"/>
        <qti-response-declaration identifier="VALID" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction autostart="false">
            <object data="clips/missing-response.mp3" type="audio/mpeg"/>
          </qti-media-interaction>
          <qti-media-interaction response-identifier="WRONG" autostart="maybe" loop="sometimes" min-plays="3" max-plays="2">
            <object data="clips/wrong-shape.mp3" type="audio/mpeg"/>
          </qti-media-interaction>
          <qti-media-interaction response-identifier="VALID" min-plays="-1" max-plays="many">
            <audio><source src="clips/valid.mp3"/></audio>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.responseIdentifier" }),
        expect.objectContaining({ code: "interaction.cardinality" }),
        expect.objectContaining({ code: "interaction.baseType" }),
        expect.objectContaining({ code: "interaction.booleanAttribute" }),
        expect.objectContaining({ code: "interaction.integerAttribute" }),
        expect.objectContaining({ code: "interaction.minMax" }),
      ]),
    );
  });

  it("preserves hotspot geometry on choice metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot" title="hotspot" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png"/>
            <qti-hotspot-choice identifier="A" shape="rect" coords="10,20,60,80"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.choices[0]).toMatchObject({
      identifier: "A",
      role: "hotspot",
      attributes: { shape: "rect", coords: "10,20,60,80" },
    });
  });

  it("preserves qti-gap-img child image assets for graphic gap match choices", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-img-choice" title="gap-img-choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
            <object data="timeline.png" type="image/png" width="160" height="120"/>
            <qti-gap-img identifier="DraggerA" match-max="1">
              <img src="a-cw.png" alt="Civil War" width="78" height="63"/>
            </qti-gap-img>
            <qti-associable-hotspot identifier="A" shape="rect" coords="10,20,88,83" match-max="1"/>
          </qti-graphic-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const choice = result.document?.item.interactions[0]?.choices.find(
      (item) => item.identifier === "DraggerA",
    );
    expect(choice).toMatchObject({
      qtiName: "qti-gap-img",
      text: "Civil War",
      asset: {
        data: "a-cw.png",
        type: "image/*",
        width: "78",
        height: "63",
        text: "Civil War",
      },
    });
  });

  it("validates qti-gap-img choices require usable child media", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-gap-img-choice" title="bad-gap-img-choice" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
            <object data="timeline.png" type="image/png" width="160" height="120"/>
            <qti-gap-img identifier="MissingMedia" match-max="1"/>
            <qti-gap-img identifier="MissingSrc" match-max="1"><img alt="Missing source"/></qti-gap-img>
            <qti-associable-hotspot identifier="A" shape="rect" coords="10,20,88,83" match-max="1"/>
          </qti-graphic-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "choice.gapImg.media.required",
          severity: "error",
          path: expect.stringContaining("qti-gap-img[1]"),
        }),
        expect.objectContaining({
          code: "choice.gapImg.media.required",
          severity: "error",
          path: expect.stringContaining("qti-gap-img[2]"),
        }),
      ]),
    );
  });

  it("infers inline SVG dimensions for graphical interaction objects", () => {
    const image =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0ODAiIGhlaWdodD0iMjYwIiB2aWV3Qm94PSIwIDAgNDgwIDI2MCI+PC9zdmc+";
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-svg-dimensions" title="inline-svg-dimensions" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair"/>
        <qti-item-body>
          <qti-graphic-associate-interaction response-identifier="RESPONSE">
            <object data="${image}" type="image/png">Timeline</object>
            <qti-associable-hotspot identifier="A" shape="circle" coords="120,90,18" match-max="1"/>
            <qti-associable-hotspot identifier="B" shape="circle" coords="120,170,18" match-max="1"/>
          </qti-graphic-associate-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      width: "480",
      height: "260",
    });
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.graphicObjectDimensions" }),
      ]),
    );
  });

  it("warns when graphical hotspot coords cannot map cleanly to object dimensions", () => {
    const missingDimensions = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-hotspot-dimensions" title="missing-hotspot-dimensions" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png"/>
            <qti-hotspot-choice identifier="A" shape="rect" coords="10,20,60,80"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);
    const outOfBounds = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="out-of-bounds-hotspot" title="out-of-bounds-hotspot" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png" width="160" height="120"/>
            <qti-hotspot-choice identifier="A" shape="circle" coords="360,90,18"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(missingDimensions.ok).toBe(true);
    expect(missingDimensions.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.graphicObjectDimensions",
          severity: "warning",
        }),
      ]),
    );
    expect(outOfBounds.ok).toBe(true);
    expect(outOfBounds.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "choice.coords.bounds", severity: "warning" }),
      ]),
    );
  });

  it("validates hotspot geometry attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-hotspot-geometry" title="bad-hotspot-geometry" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png"/>
            <qti-hotspot-choice identifier="A" coords="0,0,nope,50"/>
            <qti-hotspot-choice identifier="B" shape="triangle"/>
            <qti-hotspot-choice identifier="D" shape="circle" coords="0,0"/>
            <qti-associable-hotspot identifier="C" shape="rect" coords="0,0,50,50"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "choice.shape.required" }),
        expect.objectContaining({ code: "choice.shape" }),
        expect.objectContaining({ code: "choice.coords.required" }),
        expect.objectContaining({ code: "choice.coords" }),
        expect.objectContaining({ code: "choice.coords.shape" }),
        expect.objectContaining({ code: "choice.matchMax.required" }),
      ]),
    );
  });

  it("preserves portable custom interaction launch metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci" title="pci" time-dependent="false">
        <qti-template-declaration identifier="START" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>2</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-portable-custom-interaction
            response-identifier="RESPONSE"
            custom-interaction-type-identifier="urn:qti3:fixture:portable-custom"
            module="fixture-portable-custom"
            data-mode="preview">
            <qti-interaction-modules primary-configuration="modules/module_resolution.js">
              <qti-interaction-module id="helper" primary-path="modules/helper"/>
            </qti-interaction-modules>
            <qti-template-variable template-identifier="START"/>
            <qti-context-variable identifier="RESPONSE"/>
            <qti-stylesheet href="pci.css"/>
            <qti-interaction-markup><div class="widget"><qti-printed-variable identifier="START"/></div></qti-interaction-markup>
          </qti-portable-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const interaction = result.document?.item.interactions[0];
    expect(interaction?.attributes).toMatchObject({
      "custom-interaction-type-identifier": "urn:qti3:fixture:portable-custom",
      module: "fixture-portable-custom",
    });
    expect(interaction?.portableCustom).toMatchObject({
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      module: "fixture-portable-custom",
      dataAttributes: { "data-mode": "preview" },
      interactionModules: {
        primaryConfiguration: "modules/module_resolution.js",
        modules: [{ id: "helper", primaryPath: "modules/helper" }],
      },
      templateVariables: [{ kind: "template", identifier: "START" }],
      contextVariables: [{ kind: "context", identifier: "RESPONSE" }],
      stylesheets: [{ href: "pci.css" }],
    });
    expect(interaction?.portableCustom?.interactionMarkupRaw).toContain('<div class="widget">');
    expect(interaction?.portableCustom?.interactionMarkup).toEqual([
      expect.objectContaining({ kind: "element", qtiName: "div" }),
    ]);
  });

  it("keeps portable custom interaction markup inert", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci-markup-inert" title="pci-markup-inert" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="NESTED" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-portable-custom-interaction
            response-identifier="RESPONSE"
            custom-interaction-type-identifier="urn:qti3:fixture:portable-custom"
            module="fixture-portable-custom">
            <qti-interaction-markup>
              <qti-choice-interaction response-identifier="NESTED">
                <qti-simple-choice identifier="A">A</qti-simple-choice>
              </qti-choice-interaction>
            </qti-interaction-markup>
          </qti-portable-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.portableCustom.markupInteraction" }),
      ]),
    );
    expect(result.document?.item.interactions).toHaveLength(1);
    expect(result.document?.item.interactions[0]?.portableCustom?.interactionMarkup).toEqual([
      expect.objectContaining({ kind: "element", qtiName: "qti-choice-interaction" }),
    ]);
  });

  it("rejects duplicate portable custom interaction singleton children", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci-duplicates" title="pci-duplicates" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-portable-custom-interaction
            response-identifier="RESPONSE"
            custom-interaction-type-identifier="urn:qti3:fixture:portable-custom">
            <qti-interaction-modules>
              <qti-interaction-module id="fixture-portable-custom" primary-path="modules/fixture-portable-custom"/>
            </qti-interaction-modules>
            <qti-interaction-modules>
              <qti-interaction-module id="extra" primary-path="modules/extra"/>
            </qti-interaction-modules>
            <qti-interaction-markup><div>First</div></qti-interaction-markup>
            <qti-interaction-markup><div>Second</div></qti-interaction-markup>
          </qti-portable-custom-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    const duplicateDiagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "interaction.portableCustom.child.duplicate",
    );
    expect(result.ok).toBe(false);
    expect(duplicateDiagnostics).toHaveLength(2);
    expect(duplicateDiagnostics.map((diagnostic) => diagnostic.message)).toEqual(
      expect.arrayContaining([
        "qti-portable-custom-interaction allows at most one qti-interaction-modules child.",
        "qti-portable-custom-interaction allows at most one qti-interaction-markup child.",
      ]),
    );
  });

  it("validates required interaction attributes and object assets", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="required-interaction-attrs" title="required-interaction-attrs" time-dependent="false">
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point"/>
        <qti-response-declaration identifier="SLIDER" cardinality="single" base-type="float"/>
        <qti-response-declaration identifier="PCI" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-select-point-interaction response-identifier="POINT"/>
          <qti-slider-interaction response-identifier="SLIDER" lower-bound="10" upper-bound="5" step="0"/>
          <qti-portable-custom-interaction response-identifier="PCI"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.object.required" }),
        expect.objectContaining({ code: "interaction.slider.bounds" }),
        expect.objectContaining({ code: "interaction.numericAttribute" }),
        expect.objectContaining({ code: "interaction.portableCustom.typeIdentifier" }),
        expect.objectContaining({ code: "interaction.portableCustom.module" }),
      ]),
    );
  });

  it("validates interaction and choice limit attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="interaction-limits" title="interaction-limits" time-dependent="false">
        <qti-response-declaration identifier="CHOICE" cardinality="multiple" base-type="identifier"/>
        <qti-response-declaration identifier="ASSOCIATE" cardinality="multiple" base-type="pair"/>
        <qti-response-declaration identifier="GAP" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="CHOICE" min-choices="3" max-choices="2">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
          <qti-associate-interaction response-identifier="ASSOCIATE" min-associations="-1" max-associations="many">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="C">C</qti-simple-associable-choice>
              <qti-simple-associable-choice identifier="E" match-min="2" match-max="1">E</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-associate-interaction>
          <qti-gap-match-interaction response-identifier="GAP">
            <qti-gap-text identifier="D" match-max="none">D</qti-gap-text>
            <p><qti-gap identifier="G1"/></p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.minMax" }),
        expect.objectContaining({ code: "interaction.integerAttribute" }),
        expect.objectContaining({ code: "choice.matchMax.required" }),
        expect.objectContaining({ code: "choice.integerAttribute" }),
        expect.objectContaining({ code: "choice.minMax" }),
      ]),
    );
  });
});
