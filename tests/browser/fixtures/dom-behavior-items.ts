export const CHOICE_STACKING_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-stacking" title="choice-stacking" time-dependent="false">
  <qti-response-declaration identifier="HORIZONTAL" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="VERTICAL" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="HORIZONTAL" class="qti-choices-stacking-3 qti-orientation-horizontal" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="VERTICAL" class="qti-choices-stacking-3 qti-orientation-vertical" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const CHOICE_STACKING_GEOMETRY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-stacking-geometry" title="choice-stacking-geometry" time-dependent="false">
  <qti-response-declaration identifier="STACKING_FIVE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="STACKING_FOUR" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="VERTICAL" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="STACKING_FIVE" class="qti-choices-stacking-5" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
      <qti-simple-choice identifier="F">F</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="STACKING_FOUR" class="qti-choices-stacking-4" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
      <qti-simple-choice identifier="F">F</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="VERTICAL" class="qti-choices-stacking-3 qti-orientation-vertical" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const HORIZONTAL_CHOICE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-horizontal" title="choice-horizontal" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" class="qti-orientation-horizontal" max-choices="1">
      <qti-simple-choice identifier="A">First horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Second horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="C">Third horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="D">Fourth horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="E">Fifth horizontal choice</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const ITEM_LAYOUT_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-layout-shared-vocabulary" title="item-layout-shared-vocabulary" time-dependent="false">
  <qti-item-body>
    <div id="layout-row" class="qti-layout-row">
      <div id="layout-left" class="qti-layout-col6 qti-bordered">
        <p id="aligned" class="qti-align-center qti-text-indent-2">Left layout column.</p>
      </div>
      <div id="layout-right" class="qti-layout-col-6 qti-well">
        <p><span id="underlined" class="qti-underline">Right layout column.</span></p>
        <ul id="styled-list" class="qti-list-style-type-square">
          <li><span id="inline" class="qti-italic qti-display-inline-block qti-valign-middle">Inline utility.</span></li>
        </ul>
        <p id="vertical" class="qti-writing-mode-vertical-rl"><span id="combined" class="qti-text-combine-upright-all">2026</span></p>
      </div>
    </div>
    <div id="offset-row" class="qti-layout-row">
      <div id="offset-column" class="qti-layout-col-3 qti-layout-offset-3">Offset column.</div>
    </div>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const CHOICE_PRESENTATION_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-presentation-shared-vocabulary" title="choice-presentation-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="CHOICE_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="HOTTEXT_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-labels-cjk-ideographic qti-labels-suffix-period qti-writing-orientation-vertical-rl">
      <qti-simple-choice identifier="A">First hidden-control choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Second hidden-control choice</qti-simple-choice>
    </qti-choice-interaction>
    <qti-hottext-interaction response-identifier="HOTTEXT_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-unselected-hidden">
      <p>Select the <qti-hottext identifier="A">hidden indicator</qti-hottext> phrase.</p>
    </qti-hottext-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const EMPTY_CHOICE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="empty-choice" title="empty-choice">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt>Select one.</qti-prompt>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const DEPRECATED_CHOICE_ORIENTATION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-orientation-attribute" title="choice-orientation-attribute" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" orientation="horizontal" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const ORDER_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-shared-vocabulary" title="order-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" class="qti-choices-top qti-labels-decimal qti-labels-suffix-parenthesis">
      <qti-simple-choice identifier="A">First step</qti-simple-choice>
      <qti-simple-choice identifier="B">Second step</qti-simple-choice>
      <qti-simple-choice identifier="C">Third step</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const HORIZONTAL_ORDER_ATTRIBUTE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="q15-order-example-2" title="Grand Prix of Bahrain (horizontal)" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier">
    <qti-correct-response>
      <qti-value>DriverC</qti-value>
      <qti-value>DriverA</qti-value>
      <qti-value>DriverB</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" orientation="horizontal">
      <qti-prompt>The following F1 drivers finished on the podium in the first ever Grand Prix of Bahrain. Can you rearrange them into the correct finishing order from left to right, 1st, 2nd, and 3rd?</qti-prompt>
      <qti-simple-choice identifier="DriverA">Rubens Barrichello</qti-simple-choice>
      <qti-simple-choice identifier="DriverB">Jenson Button</qti-simple-choice>
      <qti-simple-choice identifier="DriverC">Michael Schumacher</qti-simple-choice>
    </qti-order-interaction>
    <p>Note: The <em>orientation</em> of the layout of the drivers should be horizontal.</p>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml"/>
</qti-assessment-item>
`.trim();

export const MATCH_TABULAR_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-tabular-shared-vocabulary" title="match-tabular-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" class="qti-match-tabular" data-first-column-header="Characters">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="1">Capulet</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="D" match-max="1">Demetrius</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="M" match-max="1">A Midsummer Night's Dream</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="R" match-max="1">Romeo and Juliet</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const GAP_PLACEMENT_WIDTH_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-placement-width" title="gap-placement-width" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE" class="qti-gap-placement qti-choices-left" data-choices-container-width="120">
      <qti-gap-text identifier="A" match-max="1">alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">beta</qti-gap-text>
      <p>Place <qti-gap identifier="G1" class="qti-input-width-3"/> before <qti-gap identifier="G2" class="qti-input-width-10"/>.</p>
    </qti-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const GAP_CHOICES_CONTAINER_WIDTH_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-choices-container-width" title="gap-choices-container-width" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE" class="qti-choices-top" data-choices-container-width="200">
      <qti-gap-text identifier="W" match-max="1">winter</qti-gap-text>
      <qti-gap-text identifier="Sp" match-max="1">spring</qti-gap-text>
      <qti-gap-text identifier="Su" match-max="1">summer</qti-gap-text>
      <qti-gap-text identifier="A" match-max="1">autumn</qti-gap-text>
      <p>Now is the <qti-gap identifier="G1"/> of our discontent made glorious <qti-gap identifier="G2"/>.</p>
    </qti-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

export const UNSUPPORTED_INTERACTION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-interaction" title="unsupported-interaction" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-unsupported-interaction response-identifier="RESPONSE"/>
  </qti-item-body>
</qti-assessment-item>
`.trim();
