import type { QtiFixture } from "./index.js";

function catalogFixture(id: string, title: string, body: string, catalogs: string): QtiFixture {
  return {
    id,
    category: "catalog",
    title,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${id}" title="${id}" time-dependent="false" xml:lang="en">
  <qti-item-body>${body}</qti-item-body>
  <qti-catalog-info>${catalogs}</qti-catalog-info>
</qti-assessment-item>`,
    expectedParseDiagnostics: [],
    expectedValidationDiagnostics: [],
    attempts: [],
  };
}

/** Synthetic catalog fixtures covering QTI glossary, translation, fallback, and spoken content. */
export const catalogFixtures: QtiFixture[] = [
  catalogFixture(
    "catalog-glossary-inline",
    "Catalog glossary with inline HTML",
    '<p>Choose the <span data-catalog-idref="accurate">accurate</span> statement.</p>',
    `<qti-catalog id="accurate">
      <qti-card support="glossary-on-screen" xml:lang="en">
        <qti-html-content>
          <p class="glossary-term"><strong>Accurate</strong></p>
          <p class="glossary-definition">Correct in all details.</p>
        </qti-html-content>
      </qti-card>
    </qti-catalog>`,
  ),
  catalogFixture(
    "catalog-glossary-file",
    "Catalog glossary with referenced HTML",
    '<p>She practiced the <span data-catalog-idref="harmonica">harmonica</span>.</p>',
    `<qti-catalog id="harmonica">
      <qti-card support="glossary-on-screen" xml:lang="en">
        <qti-file-href mime-type="text/html">glossary/grades5_9/harmonica.html</qti-file-href>
      </qti-card>
    </qti-catalog>`,
  ),
  catalogFixture(
    "catalog-multilingual-supports",
    "Catalog with glossary, translations, and spoken support",
    '<p>Choose the <span data-catalog-idref="precise">precise</span> measurement.</p>',
    `<qti-catalog id="precise">
      <qti-card support="glossary-on-screen" xml:lang="en">
        <qti-html-content><p><strong>Precise:</strong> exact and accurate.</p></qti-html-content>
      </qti-card>
      <qti-card support="keyword-translation">
        <qti-card-entry xml:lang="es" default="true">
          <qti-html-content><p>preciso</p></qti-html-content>
        </qti-card-entry>
        <qti-card-entry xml:lang="de">
          <qti-html-content><p>genau</p></qti-html-content>
        </qti-card-entry>
        <qti-card-entry xml:lang="fr-CA">
          <qti-html-content><p>précis</p></qti-html-content>
        </qti-card-entry>
      </qti-card>
      <qti-card support="spoken">
        <qti-card-entry xml:lang="en" default="true" data-reading-type="computer-read-aloud">
          <qti-html-content>
            <audio controls="controls">
              <source src="audio/precise.mp3#t=0,2.5" type="audio/mpeg"/>
              <source src="audio/precise.ogg#t=0,2.5" type="audio/ogg"/>
            </audio>
          </qti-html-content>
        </qti-card-entry>
      </qti-card>
    </qti-catalog>`,
  ),
];
