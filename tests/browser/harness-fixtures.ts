/** Synthetic harness-only QTI items for manual debugger browser tests. */

export const catalogDebugItemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="catalog-debug" title="catalog-debug" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p data-catalog-idref="term-help">Select the accurate statement.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">QTI items may include dormant support-specific content.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="term-help">
      <qti-card support="linguistic-guidance">
        <qti-html-content>Accurate means correct.</qti-html-content>
      </qti-card>
    </qti-catalog>
  </qti-catalog-info>
</qti-assessment-item>`;

export const mediaCatalogItemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-catalog" title="media-catalog" time-dependent="false">
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
    </qti-catalog>
  </qti-catalog-info>
</qti-assessment-item>`;

export const stylesheetDebugItemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stylesheet-debug" title="stylesheet-debug" time-dependent="false">
  <qti-stylesheet href="style/item.css" type="text/css" media="screen"/>
  <qti-item-body><p>Styled item body.</p></qti-item-body>
</qti-assessment-item>`;

export const companionMaterialsHostItemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-host" title="companion-materials-host" time-dependent="false">
  <qti-companion-materials-info>
    <qti-physical-material>Bring a ruler.</qti-physical-material>
    <qti-digital-material label="Reference card" mime-type="text/plain">
      <qti-file-href>materials/reference.txt</qti-file-href>
      <qti-resource-icon>materials/reference.svg</qti-resource-icon>
    </qti-digital-material>
  </qti-companion-materials-info>
  <qti-item-body><p>Use the companion materials.</p></qti-item-body>
</qti-assessment-item>`;

export const companionMaterialsOverrideItemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-override" title="companion-materials-override" time-dependent="false">
  <qti-companion-materials-info>
    <qti-digital-material>
      <qti-file-href>materials/reference.txt</qti-file-href>
    </qti-digital-material>
  </qti-companion-materials-info>
  <qti-item-body><p>Use the companion materials.</p></qti-item-body>
</qti-assessment-item>`;

export const candidateVisibleItemXml = `<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="candidate-visible-item"
  title="Internal Item Bank Title" time-dependent="false">
  <qti-item-body>
    <p>Candidate-visible item body.</p>
  </qti-item-body>
</qti-assessment-item>`;
