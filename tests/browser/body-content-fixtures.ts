/** Synthetic body-content QTI items for player rendering browser tests. */

export const mathBodyItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="math-body" title="math-body" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <p>Evaluate <math display="block"><mrow><mi mathvariant="normal">x</mi><mo stretchy="false">+</mo><mn>1</mn></mrow></math> when x is zero.</p>
    <table>
      <thead><tr><th scope="col">Value</th><th scope="col">Result</th></tr></thead>
      <tbody><tr><td>0</td><td>1</td></tr></tbody>
    </table>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">1</qti-simple-choice>
      <qti-simple-choice identifier="B">2</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

export const semanticBodyItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="semantic-body" title="semantic-body" time-dependent="false" xml:lang="ja">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-prompt id="prompt-label" aria-labelledby="heading-2">選びなさい</qti-prompt>
    <h1>Heading 1</h1>
    <h2 id="heading-2" xml:lang="en">Heading 2</h2>
    <h3>Heading 3</h3>
    <h4>Heading 4</h4>
    <h5>Heading 5</h5>
    <h6>Heading 6</h6>
    <p id="bidi-ruby" dir="rtl" aria-labelledby="heading-2" aria-details="long-desc">
      <bdi>ABC</bdi>
      <bdo dir="ltr">DEF</bdo>
      <ruby xml:lang="ja"><rb>漢</rb><rp>(</rp><rt>かん</rt><rp>)</rp></ruby>
    </p>
    <p id="long-desc" class="qti-visually-hidden" aria-hidden="true">Long description.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

export const unsafeBodyItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsafe-body" title="unsafe-body" time-dependent="false">
  <qti-item-body>
    <p id="safe" aria-hidden="true" onclick="window.qtiUnsafe = true" style="color:red">Safe text</p>
    <a id="bad-link" href="javascript:window.qtiUnsafe = true">Bad link</a>
    <script>window.qtiUnsafe = true</script>
    <style>#safe { color: red }</style>
  </qti-item-body>
</qti-assessment-item>`;

export const bodyContentDiagramImage =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2010%2010'%3E%3Crect%20width='10'%20height='10'%20fill='white'/%3E%3C/svg%3E";

export const sharedVocabularyBodyItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="shared-vocabulary" title="shared-vocabulary" time-dependent="false">
  <qti-item-body>
    <p id="hidden" class="qti-hidden">Hidden from everyone.</p>
    <p id="visually-hidden" class="qti-visually-hidden">Screen reader only text.</p>
    <span id="diagram-label">Diagram label</span>
    <img id="diagram" src="${bodyContentDiagramImage}" alt="Diagram" data-qti-aria-labelledby="diagram-label" data-qti-aria-details="long-desc"/>
    <div id="long-desc" class="qti-visually-hidden" data-qti-a11y-content-role="long-description">Long description content.</div>
    <span id="suppress-all" data-qti-suppress-tts="all">$25.00</span>
    <span id="suppress-screen-reader" data-qti-suppress-tts="screen-reader">Visual-only label</span>
    <span id="suppress-read-aloud" data-qti-suppress-tts="computer-read-aloud">Screen-reader-visible label</span>
    <span id="explicit-aria" aria-label="Explicit label" data-qti-aria-label="Backup label">Named content</span>
    <span id="explicit-qti-hidden" data-qti-suppress-tts="all" data-qti-aria-hidden="false">Explicitly exposed</span>
  </qti-item-body>
</qti-assessment-item>`;

export const dataSsmlPlayerItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="data-ssml-player" title="data-ssml-player" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Read <span id="mrna" data-ssml='{"sub":{"alias":"messenger RNA"}}'>mRNA</span>.</p>
    <p><span id="skip-read-aloud" data-qti-suppress-tts="computer-read-aloud">Visual pronunciation hint.</span></p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt id="spoken-prompt" data-ssml='{"prosody":{"rate":"slow"}}'>Choose the spoken word.</qti-prompt>
      <qti-simple-choice identifier="A" data-ssml='{"phoneme":{"ph":"t@meItoU","alphabet":"x-sampa"}}'>tomato</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
