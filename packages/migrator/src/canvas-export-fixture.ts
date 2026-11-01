/** Synthetic MIT-licensed inputs following Canvas lib/cc/qti/qti_items.rb"s exporter. */
export function canvasChoiceXml(points: string = "3"): string {
  return `<questestinterop><assessment ident="QUIZ" title="Canvas quiz"><section ident="SECTION">
  <item ident="CHOICE" title="Capital city">
    <itemmetadata><qtimetadata>
      <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>multiple_choice_question</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
    </qtimetadata></itemmetadata>
    <presentation><material><mattext texttype="text/html">Which city is in France?</mattext></material>
      <response_lid ident="response1" rcardinality="Single"><render_choice>
        <response_label ident="A"><material><mattext>Paris</mattext></material></response_label>
        <response_label ident="B"><material><mattext>Berlin</mattext></material></response_label>
      </render_choice></response_lid>
    </presentation>
    <resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      <respcondition continue="No"><conditionvar><varequal respident="response1">A</varequal></conditionvar>
        <setvar action="Set" varname="SCORE">100</setvar>
      </respcondition>
    </resprocessing>
  </item></section></assessment></questestinterop>`;
}

/** Canvas essays have a fill-in response without rows and a non-scoring other condition. */
export function canvasEssayXml(points: string = "5"): string {
  return `<questestinterop><assessment ident="QUIZ"><section ident="SECTION">
  <item ident="ESSAY" title="Explain your reasoning"><itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>essay_question</fieldentry></qtimetadatafield>
    <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata><presentation>
    <material><mattext texttype="text/html"><![CDATA[<p>Explain <strong>your reasoning</strong>.</p>]]></mattext></material>
    <response_str ident="response1" rcardinality="Single"><render_fib><response_label ident="answer1" rshuffle="No"/></render_fib></response_str>
  </presentation><resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="Yes"><conditionvar><other/></conditionvar></respcondition>
  </resprocessing></item></section></assessment></questestinterop>`;
}
