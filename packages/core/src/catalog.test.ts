import { describe, expect, it } from "vitest";
import { createCatalogSupportResolution } from "./catalog.js";
import { parseQtiXml } from "./parser.js";

function catalogItem(catalog: string, reference = '<span data-catalog-idref="term">term</span>') {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="catalog-contract" title="catalog-contract" time-dependent="false">
      <qti-item-body><p>${reference}</p></qti-item-body>
      <qti-catalog-info>${catalog}</qti-catalog-info>
    </qti-assessment-item>
  `;
}

describe("QTI catalog contracts", () => {
  it("assigns stable reference identities and discovers references nested in catalog HTML", () => {
    const result = parseQtiXml(
      catalogItem(`
        <qti-catalog id="term">
          <qti-card support="glossary-on-screen">
            <qti-html-content>
              <p data-catalog-idref="related">Definition with related support.</p>
            </qti-html-content>
          </qti-card>
        </qti-catalog>
        <qti-catalog id="related">
          <qti-card support="linguistic-guidance">
            <qti-html-content>Related guidance.</qti-html-content>
          </qti-card>
        </qti-catalog>
      `),
    );

    expect(result.ok).toBe(true);
    expect(result.document?.item.catalogReferences).toEqual([
      expect.objectContaining({
        idref: "term",
        qtiName: "span",
        referenceId: expect.stringContaining("/qti-item-body[1]/p[1]/span[1]"),
      }),
      expect.objectContaining({
        idref: "related",
        qtiName: "p",
        referenceId: expect.stringContaining("/qti-html-content[1]/p[1]"),
      }),
    ]);
  });

  it("selects only the best language rank and reports why it was selected", () => {
    const result = parseQtiXml(
      catalogItem(`
        <qti-catalog id="term">
          <qti-card support="keyword-translation">
            <qti-card-entry xml:lang="fr" default="1"><qti-html-content>générique</qti-html-content></qti-card-entry>
            <qti-card-entry xml:lang="fr-CA"><qti-html-content>canadien</qti-html-content></qti-card-entry>
            <qti-card-entry xml:lang="es" default="0"><qti-html-content>español</qti-html-content></qti-card-entry>
          </qti-card>
        </qti-catalog>
      `),
    );
    if (!result.document) throw new Error("Expected parsed catalog item.");

    const entries = result.document.item.catalogInfo?.catalogs[0]?.cards[0]?.entries;
    expect(entries?.map((entry) => entry.default)).toEqual([true, false, false]);

    const exact = createCatalogSupportResolution(result.document, {
      supports: "keyword-translation",
      languages: ["fr-CA"],
    });
    expect(exact.references[0]?.matches).toEqual([
      expect.objectContaining({
        language: "fr-CA",
        selectionReason: "exact-language",
      }),
    ]);

    const primary = createCatalogSupportResolution(result.document, {
      supports: "keyword-translation",
      languages: ["fr-FR"],
    });
    expect(primary.references[0]?.matches).toEqual([
      expect.objectContaining({ language: "fr", selectionReason: "primary-language" }),
    ]);

    const fallback = createCatalogSupportResolution(result.document, {
      supports: "keyword-translation",
      languages: ["de"],
    });
    expect(fallback.references[0]?.matches).toEqual([
      expect.objectContaining({ language: "fr", selectionReason: "default" }),
    ]);
  });

  it("uses language metadata declared directly on a card", () => {
    const result = parseQtiXml(
      catalogItem(`
        <qti-catalog id="term">
          <qti-card support="glossary-on-screen" xml:lang="en">
            <qti-html-content>Definition.</qti-html-content>
          </qti-card>
        </qti-catalog>
      `),
    );
    if (!result.document) throw new Error("Expected parsed catalog item.");

    expect(
      createCatalogSupportResolution(result.document, {
        supports: "glossary-on-screen",
        languages: "en-US",
      }).references[0]?.matches,
    ).toEqual([expect.objectContaining({ language: "en", selectionReason: "primary-language" })]);
  });

  it("rejects invalid default attribute values on catalog entries", () => {
    const result = parseQtiXml(
      catalogItem(`
        <qti-catalog id="term">
          <qti-card support="glossary-on-screen">
            <qti-card-entry xml:lang="fr" default="maybe"><qti-html-content>Définition.</qti-html-content></qti-card-entry>
          </qti-card>
        </qti-catalog>
      `),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "catalog.cardEntry.default.boolean" }),
      ]),
    );
  });

  it("rejects mixed card selections and multiple defaults", () => {
    const result = parseQtiXml(
      catalogItem(`
        <qti-catalog id="term">
          <qti-card support="glossary-on-screen">
            <qti-html-content>Inline.</qti-html-content>
            <qti-file-href mime-type="text/html">glossary/term.html</qti-file-href>
            <qti-card-entry default="true"><qti-html-content>First.</qti-html-content></qti-card-entry>
            <qti-card-entry default="true"><qti-html-content>Second.</qti-html-content></qti-card-entry>
          </qti-card>
        </qti-catalog>
      `),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "catalog.card.content.choice" }),
        expect.objectContaining({ code: "catalog.card.entries.choice" }),
        expect.objectContaining({ code: "catalog.cardEntry.default.multiple" }),
      ]),
    );
  });
});

describe("catalog support resolution integration", () => {
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
});
