import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { itemMetadataSupport } from "./support.js";
import { validateAssessmentItem } from "./validation.js";

const assessmentItemOpen = `
  <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-metadata-test" title="item-metadata-test" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
      <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
    </qti-response-declaration>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
`;

const assessmentItemClose = `
    <qti-item-body>
      <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
        <qti-simple-choice identifier="A">A</qti-simple-choice>
      </qti-choice-interaction>
    </qti-item-body>
    <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
  </qti-assessment-item>
`;

describe("QTI item metadata parsing", () => {
  it("keeps an empty qti-companion-materials-info container in the model", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info/>
      ${assessmentItemClose}
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.companionMaterials).toEqual({
      physicalMaterials: [],
      digitalMaterials: [],
      unparsedChildren: [],
      source: expect.objectContaining({
        path: "/qti-assessment-item/qti-companion-materials-info[1]",
      }),
    });
  });

  it("reports duplicate qti-catalog-info containers", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-catalog-info>
          <qti-catalog id="first">
            <qti-card support="linguistic-guidance">
              <qti-html-content>First catalog.</qti-html-content>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
        <qti-catalog-info>
          <qti-catalog id="second">
            <qti-card support="linguistic-guidance">
              <qti-html-content>Second catalog.</qti-html-content>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      ${assessmentItemClose}
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "item.child.duplicate",
          severity: "error",
          path: "/qti-assessment-item/qti-catalog-info[2]",
        }),
      ]),
    );
    expect(result.document?.item.catalogInfo?.catalogs).toEqual([
      expect.objectContaining({ id: "first" }),
    ]);
  });

  it("validates parsed companion materials without extra validation diagnostics", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info>
          <qti-physical-material>Bring a ruler.</qti-physical-material>
        </qti-companion-materials-info>
      ${assessmentItemClose}
    `);

    expect(result.ok).toBe(true);
    if (!result.document) throw new Error("Expected parsed document.");

    const validation = validateAssessmentItem(result.document);
    expect(validation.ok).toBe(true);
    expect(validation.diagnostics).toEqual([]);
  });

  it("rejects companion materials models that retain empty physical materials", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info>
          <qti-physical-material>Bring a ruler.</qti-physical-material>
        </qti-companion-materials-info>
      ${assessmentItemClose}
    `);

    if (!result.document?.item.companionMaterials) {
      throw new Error("Expected companion materials on parsed document.");
    }

    result.document.item.companionMaterials.physicalMaterials.push({
      text: "   ",
      source: result.document.item.companionMaterials.physicalMaterials[0]?.source,
    });

    const validation = validateAssessmentItem(result.document);
    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: "companionMaterials.physicalMaterial.empty.model",
        severity: "error",
      }),
    ]);
  });

  it("rejects companion materials models with physical material listed as unparsed", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info>
          <qti-physical-material>Bring a ruler.</qti-physical-material>
        </qti-companion-materials-info>
      ${assessmentItemClose}
    `);

    if (!result.document?.item.companionMaterials) {
      throw new Error("Expected companion materials on parsed document.");
    }

    result.document.item.companionMaterials.unparsedChildren.push({
      qtiName: "qti-physical-material",
      source: result.document.item.companionMaterials.physicalMaterials[0]?.source,
    });

    const validation = validateAssessmentItem(result.document);
    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: "companionMaterials.model.inconsistent",
        severity: "error",
      }),
    ]);
  });

  it("rejects companion materials models with digital material listed as unparsed", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info>
          <qti-digital-material>
            <qti-file-href>../materials/reference.txt</qti-file-href>
          </qti-digital-material>
        </qti-companion-materials-info>
      ${assessmentItemClose}
    `);

    if (!result.document?.item.companionMaterials) {
      throw new Error("Expected companion materials on parsed document.");
    }

    result.document.item.companionMaterials.unparsedChildren.push({
      qtiName: "qti-digital-material",
      source: result.document.item.companionMaterials.digitalMaterials[0]?.source,
    });

    const validation = validateAssessmentItem(result.document);
    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: "companionMaterials.model.inconsistent",
        severity: "error",
      }),
    ]);
  });

  it("rejects companion materials models that retain empty digital file hrefs", () => {
    const result = parseQtiXml(`
      ${assessmentItemOpen}
        <qti-companion-materials-info>
          <qti-digital-material>
            <qti-file-href>../materials/reference.txt</qti-file-href>
          </qti-digital-material>
        </qti-companion-materials-info>
      ${assessmentItemClose}
    `);

    if (!result.document?.item.companionMaterials) {
      throw new Error("Expected companion materials on parsed document.");
    }

    result.document.item.companionMaterials.digitalMaterials.push({
      fileHref: "   ",
      attributes: {},
      source: result.document.item.companionMaterials.digitalMaterials[0]?.source,
    });

    const validation = validateAssessmentItem(result.document);
    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        code: "companionMaterials.digitalMaterial.fileHref.empty.model",
        severity: "error",
      }),
    ]);
  });

  it("documents parser-item-metadata coverage in the item metadata matrix", () => {
    expect(itemMetadataSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ qtiName: "qti-catalog-info", validate: true }),
        expect.objectContaining({ qtiName: "qti-stylesheet", validate: true }),
        expect.objectContaining({ qtiName: "qti-modal-feedback", validate: true }),
        expect.objectContaining({ qtiName: "qti-companion-materials-info", validate: true }),
      ]),
    );
  });
});

describe("assessment item metadata integration", () => {
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
});
