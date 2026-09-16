/** Synthetic item examples, published under the repository's MIT license. */
export const legacySamples = {
  qti21: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="planets" title="The red planet" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Which planet is known as the red planet?</prompt>
      <simpleChoice identifier="A">Venus</simpleChoice>
      <simpleChoice identifier="B">Mars</simpleChoice>
      <simpleChoice identifier="C">Jupiter</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>
</assessmentItem>`,
  qti12: `<questestinterop>
  <item ident="planets" title="The red planet">
    <presentation>
      <material><mattext>Which planet is known as the red planet?</mattext></material>
      <response_lid ident="RESPONSE" rcardinality="Single">
        <render_choice>
          <response_label ident="A"><material><mattext>Venus</mattext></material></response_label>
          <response_label ident="B"><material><mattext>Mars</mattext></material></response_label>
          <response_label ident="C"><material><mattext>Jupiter</mattext></material></response_label>
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes><decvar varname="SCORE" vartype="Decimal" defaultval="0"/></outcomes>
      <respcondition continue="No">
        <conditionvar><varequal respident="RESPONSE">B</varequal></conditionvar>
        <setvar varname="SCORE" action="Set">1</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`,
};

/** A QTI 3 choice item for standards-profile transcoding. */
export const qti3Sample = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="planets" title="The red planet" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>B</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Which planet is known as the red planet?</qti-prompt>
      <qti-simple-choice identifier="A">Venus</qti-simple-choice>
      <qti-simple-choice identifier="B">Mars</qti-simple-choice>
      <qti-simple-choice identifier="C">Jupiter</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
