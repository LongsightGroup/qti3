# QTI 3 question correctness review

Reviewed and revised on September 16, 2026, against the
[QTI 3.0.1 implementation guide](https://www.imsglobal.org/spec/qti/v3p0/impl) and the
[official QTI 3.0.1 item schema](https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_itemv3p0p1_v1p0.xsd).

The review covers item parsing, core response validation, and scoring for the public
question fixtures. The inventory is 31 canonical XML files plus 10 supplemental
in-memory questions, for 41 questions total; the earlier schema run rejected nine.
The 31-file count and canonical-to-published XML equality were rechecked during revision.

D01–D18 retain their original IDs, and D19 records the additional hint-scoring defect.
Each finding has an example and one proposed fix sentence. P1 means a high-priority
interoperability defect; P2 means a narrower correctness issue or a policy decision.
Layer labels distinguish engine behavior, fixture markup, answer keys, and host policy.

Examples marked **probe** are synthetic variants, not claims about the unchanged public
fixture; other XML examples are shortened fixture excerpts unless identified as proposed
markup. Item-parse rejection is evidence about declarations, not proof of candidate input
capture or browser rendering. Browser checks listed as acceptance work remain unperformed,
and none of the proposed fixes have been implemented.

## Response contracts

### D01: Numeric and record Text Entry declarations are rejected

**Layer:** Engine item validation. **Priority:** P1.

**Source:** `packages/core/src/validation-interactions.ts`, `expectedResponseShape`.

The interaction contract permits only single/string declarations. These two probes use
numeric and record declarations allowed by the Text Entry contract.

```xml
<!-- Numeric probe; the interaction is inside a paragraph. -->
<qti-response-declaration identifier="R" cardinality="single" base-type="integer">
  <qti-correct-response><qti-value>42</qti-value></qti-correct-response>
</qti-response-declaration>
<p><qti-text-entry-interaction response-identifier="R" base="10"/></p>
```

```xml
<!-- Alternative record probe, in a separate item. -->
<qti-response-declaration identifier="R" cardinality="record">
  <qti-correct-response>
    <qti-value field-identifier="stringValue" base-type="string">42</qti-value>
    <qti-value field-identifier="integerValue" base-type="integer">42</qti-value>
  </qti-correct-response>
</qti-response-declaration>
<p><qti-text-entry-interaction response-identifier="R"/></p>
```

**Observed:** `parseQtiXml` reports `interaction.baseType` for the integer declaration
and `interaction.cardinality` for the record declaration, before candidate input occurs.

**Acceptance scope:** Numeric conversion must account for `base` and `format`, record
fields need their specified types, and `string-identifier` needs a declared string
response; this review did not establish the player behavior for those attributes.

**Fix:** Implement the specified Text Entry declaration and value contracts, including
record fields, `base`, `format`, and `string-identifier`, and verify candidate capture
separately in browser tests before broadening the support claim.

### D02: Extended Text collection declarations are rejected

**Layer:** Engine item validation. **Priority:** P1.

**Source:** `packages/core/src/validation-interactions.ts`, `expectedResponseShape`.

Extended Text shares Text Entry's single/string restriction, although its contract permits
multiple and ordered collections as well as single and record values.

```xml
<!-- Probe containing two distinct values and explicit collection bounds. -->
<qti-response-declaration identifier="R" cardinality="multiple" base-type="string">
  <qti-correct-response>
    <qti-value>mulch</qti-value>
    <qti-value>watering</qti-value>
  </qti-correct-response>
</qti-response-declaration>
<qti-extended-text-interaction response-identifier="R" min-strings="2" max-strings="2"/>
```

**Observed:** `parseQtiXml` reports
`qti-extended-text-interaction expects single cardinality, got multiple`.
This stronger probe still establishes a declaration failure, not a tested collection editor.

**Acceptance scope:** A future implementation must capture two separate strings, retain
order when declared ordered, and reject submissions outside `min-strings` / `max-strings`;
numeric and record forms need their own cases rather than an unrestricted allowlist.

**Fix:** Give Extended Text its own declaration and value contract, enforce collection
bounds, and prove collection capture and serialization with browser tests for the supported forms.

### D03: Valid single-pair declarations are rejected

**Layer:** Engine item validation. **Priority:** P1.

**Source:** `packages/core/src/validation-interactions.ts`, `expectedResponseShape`.

The validator restricts all five pairing families to multiple cardinality, but the
specified contracts differ.

| Interaction       | Base type      | Permitted cardinality                     |
| ----------------- | -------------- | ----------------------------------------- |
| Associate         | `pair`         | Single or multiple                        |
| Graphic Associate | `pair`         | Single or multiple                        |
| Match             | `directedPair` | Single or multiple                        |
| Gap Match         | `directedPair` | Single or multiple, depending on the gaps |
| Graphic Gap Match | `directedPair` | Multiple                                  |

The single-response Gap Match probe has one source and one gap.

```xml
<qti-response-declaration identifier="R" cardinality="single" base-type="directedPair"/>
<qti-gap-match-interaction response-identifier="R">
  <qti-gap-text identifier="A" match-max="1">A</qti-gap-text>
  <p><qti-gap identifier="G1"/></p>
</qti-gap-match-interaction>
```

**Observed:** Single-pair Associate, Match, and Gap Match probes produce
`interaction.cardinality`; Graphic Associate shares Associate's rejecting branch.

**Spec boundary:** The proposed expansion excludes Graphic Gap Match because both
[guide §3.2.14](https://www.imsglobal.org/spec/qti/v3p0/impl) and the schema's
`GraphicGapMatchInteractionDType` documentation specify multiple cardinality.

**Fix:** Permit single responses for Associate, Graphic Associate, Match, and Gap Match
while preserving each family's base type and Graphic Gap Match's multiple-only contract.

### D04: Associate accepts a directed-pair binding

**Layer:** Engine item validation. **Priority:** P1.

**Source:** `packages/core/src/validation-interactions.ts`, `expectedResponseShape`.

Associate and Graphic Associate require `pair`, but the validator also permits `directedPair`.
The complete probe below isolates the invalid binding from the wrapper problem in D09.

```xml
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="associate-binding-probe" title="Associate binding probe" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A B</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-associate-interaction response-identifier="RESPONSE" max-associations="1">
      <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
      <qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice>
    </qti-associate-interaction>
  </qti-item-body>
</qti-assessment-item>
```

**Observed:** An otherwise valid Associate item with this binding returns `ok: true`
with no diagnostics instead of identifying the base-type mismatch.

**Fix:** Restrict Associate and Graphic Associate to `pair` and add rejection tests using
otherwise valid complete items with `directedPair` declarations.

## Graphical content

### D05: Graphic child contracts reject permitted image elements

**Layer:** Engine item validation and asset parsing. **Priority:** P1.

**Source:** `packages/core/src/validation-interactions.ts`, `allowedInteractionChildren`
(`graphicOrder`, `graphicAssociate`, `graphicGapMatch`, and `hotspot` branches);
`packages/core/src/parser.ts`, `parseInteraction` and `parseObjectAsset`.

The direct-child allowlists have different gaps, so this is not a claim that every graphic
interaction rejects every image form.

| Interaction                                                  | `img` allowed by current child list | `picture` allowed by current child list |
| ------------------------------------------------------------ | ----------------------------------- | --------------------------------------- |
| Hotspot, Graphic Order, Graphic Associate, Graphic Gap Match | No                                  | No                                      |
| Position Object, Select Point                                | Yes                                 | No                                      |
| Drawing                                                      | Yes                                 | Yes                                     |

The guide permits these image forms and identifies `object` as deprecated; the current
canonical graphical questions rely on `object`, which masks the missing image cases.

```xml
<!-- Probe replacing the canonical Hotspot image with equivalent img markup. -->
<qti-hotspot-interaction response-identifier="RESPONSE">
  <img src="hotspot-flow.svg" width="480" height="300" alt="Flow"/>
  <qti-hotspot-choice identifier="A" shape="rect" coords="184,52,296,124"/>
</qti-hotspot-interaction>
```

**Observed:** Parsing the Hotspot probe reports
`qti-hotspot-interaction does not allow img as a direct child`.
The other cells above come from inspected allowlists, not browser tests.

**Acceptance scope:** Equivalent permitted media must yield the same image URL, dimensions,
and alternative text; a picture must retain its sources and fallback image, and existing
hotspot geometry must remain unchanged, with browser delivery verified separately.

**Fix:** Add the missing image cases to the appropriate child contracts and asset parser,
then test the stated media fields and graphical placement for each changed branch.

## Response limits

### D06: Omitted maximum limits become unlimited

**Layer:** Engine response validation, with dependent fixture repairs. **Priority:** P1.

**Source:** `packages/core/src/response-validation-policy.ts`, `maximumAllowedResponses`.

The resolver returns no maximum when the attribute is absent. Authored zero already means
unlimited correctly; the defect is failure to apply the interaction-specific default.

| Attribute          | Interactions whose schema default is one                          |
| ------------------ | ----------------------------------------------------------------- |
| `max-associations` | Associate, Match, Gap Match, Graphic Associate, Graphic Gap Match |
| `max-choices`      | Choice, Hot Text, Hotspot, Position Object                        |

These defaults must not be applied indiscriminately: Select Point defaults to zero, and
Order / Graphic Order have their own subset rules.

```xml
<qti-gap-match-interaction response-identifier="RESPONSE">
  <!-- gapMatch-reference supplies four sources and two text gaps. -->
</qti-gap-match-interaction>
```

```json
{ "RESPONSE": ["A G1", "B G2"] }
```

**Observed:** Unchanged Match, Gap Match, and Graphic Associate fixtures omit
`max-associations`, yet their two-pair keys pass response validation; a multiple-cardinality
Choice probe also accepts `["A", "B"]` with an omitted maximum, as it does with explicit zero.
The Choice probe therefore exposes both an unchecked binding and an unchecked default limit.

**Fixture dependencies:** Match needs four associations with the repaired D18 key;
`gapMatch-reference` and `graphicAssociate-reference` each need two; the shared-vocabulary
fixture's two-gap response also needs an explicit limit, while its one-pair Match controls
are compatible with the default of one.

**Fix:** Resolve omitted maxima from each interaction's specified default while preserving
explicit-zero behavior, and repair affected fixture limits alongside the engine change.

### D07: Scored-response requiredness is implicit engine policy

**Layer:** Host policy inside core response validation. **Priority:** P2, policy decision.

**Source:** `packages/core/src/response-validation.ts`, `effectiveMinimumRequiredResponses`;
`packages/core/src/response-validation.test.ts`, the scored-optional-response tests.

The validator deliberately requires a response when a correct answer exists and the
interaction omits an authored minimum. Existing tests explicitly require this behavior
and the zero-minimum override, so this is not described as an accidental regression or
invalid Choice XML. The shared helper applies beyond Choice to scored interactions that
reach this validation path.

```xml
<!-- Both variants belong to the same scored Choice question. -->
<qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
  <!-- Existing choices. -->
</qti-choice-interaction>

<!-- Alternative: explicitly allow an unanswered response. -->
<qti-choice-interaction response-identifier="RESPONSE" max-choices="1" min-choices="0">
  <!-- The same choices. -->
</qti-choice-interaction>
```

| Submitted response     | Omitted `min-choices` | Explicit `min-choices="0"` |
| ---------------------- | --------------------- | -------------------------- |
| `{ "RESPONSE": null }` | `response.required`   | Accepted                   |

**Assessment:** Both outcomes were reproduced, but a passing policy test does not make
the inferred minimum a QTI default; hosts need to distinguish strict QTI constraints
from the product's requirement to answer scored questions.

**Proposed fix:** Make scored-response requiredness an explicit host policy separate
from QTI constraint validation, and update tests and documentation to state the selected default.

### D08: Authored per-choice minimums are not enforced

**Layer:** Engine response validation. **Priority:** P2.

**Source:** `packages/core/src/response-validation.ts`, `validateDeclarationResponse`;
`packages/core/src/response-validation-policy.ts`, `matchMaxDiagnostics`.

The parser preserves `match-min`, but submission validation has no equivalent minimum-use
check for applicable choices in Associate, Match, Gap Match, Graphic Associate, and
Graphic Gap Match.

```xml
<!-- Synthetic Associate probe: add match-min to A and remove the invalid D09 wrapper. -->
<qti-simple-associable-choice identifier="A" match-min="1" match-max="1">
  Interview with the park ranger who led the restoration project
</qti-simple-associable-choice>
```

```json
{ "RESPONSE": ["C D"] }
```

**Observed:** C and D are valid choices, and the modified probe passes response validation
with A unused; the published `associate-reference.xml` does not contain this authored minimum.

**Counting scope:** The current maximum counter splits both pair positions; a minimum
check should count unordered-pair participation or the appropriate directed source/target
role, including repeated uses where allowed and choices used zero times.
No separate incorrect maximum-count result was reproduced, and current choice validation
rejects duplicate identifiers, so that implementation observation is not an additional finding.

**Fix:** Add role-aware per-choice minimum checks for final validation across the applicable
families while preserving incomplete-response mode and each family's occurrence semantics.

## Invalid question XML

The official item schema rejected the following nine questions.

| Question                             | Schema deficiency                                        | Finding IDs |
| ------------------------------------ | -------------------------------------------------------- | ----------- |
| `associate-reference`                | Match-set wrapper inside Associate                       | D09         |
| `graphicGapMatch-reference`          | Text gaps instead of graphical hotspots                  | D10         |
| `endAttempt-reference`               | Inline End Attempt directly under the item body          | D11         |
| `adaptive-feedback-reference`        | Inline End Attempt directly under the item body          | D11         |
| `positionObject-reference`           | Prompt inside Position Object                            | D12         |
| `template-content-reference`         | Incorrect declaration order and missing MathML namespace | D13, D14    |
| `basic-mathml`                       | Missing MathML namespace                                 | D14         |
| `basic-shared-vocabulary`            | Inline Text Entry directly under the item body           | D15         |
| `basic-extra-item-feature-tolerance` | Missing rubric `use` attribute                           | D16         |

### D09: Associate uses and accepts a Match-only wrapper

**Layer:** Fixture XML and engine child validation. **Priority:** P2.

**Source:** `packages/fixtures/xml/associate-reference.xml:12`;
`packages/core/src/validation-interactions.ts`, `allowedInteractionChildren`.

```xml
<qti-associate-interaction response-identifier="RESPONSE">
  <qti-simple-match-set>
    <qti-simple-associable-choice identifier="A" match-max="1">
      Interview with the park ranger who led the restoration project
    </qti-simple-associable-choice>
    <!-- Remaining fixture choices. -->
  </qti-simple-match-set>
</qti-associate-interaction>
```

**Observed:** The schema expects direct `qti-simple-associable-choice` children and rejects
the wrapper, but `parseQtiXml` accepts the complete fixture because the Associate allowlist
explicitly includes `qti-simple-match-set`.

**Fix:** Remove the wrapper from the generator, regenerate the fixture, and remove it
from Associate's child contract with a negative validation test.

### D10: Graphic Gap Match uses and accepts text-gap targets

**Layer:** Fixture XML and engine child validation. **Priority:** P2.

**Source:** `packages/fixtures/xml/graphicGapMatch-reference.xml:12`;
`packages/core/src/validation-interactions.ts`, `allowedInteractionChildren`.

```xml
<!-- Current target content after the image and gap choices. -->
<p>
  The first step is to <qti-gap identifier="G1"/> before the class can
  <qti-gap identifier="G2"/> at the stream.
</p>
```

**Observed:** The schema expects `qti-associable-hotspot` targets and rejects the paragraph,
but the engine accepts the complete fixture because the graphical branch includes
`staticContentNames()` and does not require graphical targets.
The `qti-gap` element belongs to text Gap Match.

**Fix:** Replace the fixture's text targets with positioned associable hotspots and enforce
the graphical child sequence and required targets in the validator.

### D11: End Attempt appears directly under the item body

**Layer:** Fixture XML. **Priority:** P2.

**Sources:** `packages/fixtures/xml/endAttempt-reference.xml:12` and
`packages/fixtures/xml/adaptive-feedback-reference.xml:19`.

The two fixtures have the same nesting error but different response bindings.

```xml
<!-- adaptive-feedback-reference.xml: direct child of qti-item-body. -->
<qti-end-attempt-interaction response-identifier="HINT" title="Show hint"/>

<!-- endAttempt-reference.xml: direct child of qti-item-body in a different item. -->
<qti-end-attempt-interaction response-identifier="RESPONSE" title="Show planning hint"/>
```

**Observed:** The schema rejects both direct children; wrapping each control in a paragraph
made temporary copies validate, but did not correct the scored-hint content problem in D19.

**Fix:** Wrap both inline controls in paragraphs in their generators and regenerate the
XML while handling the independent scored-hint defect under D19.

### D12: Position Object contains an invalid prompt child

**Layer:** Fixture XML and engine child validation. **Priority:** P2.

**Source:** `packages/fixtures/xml/positionObject-reference.xml:13`;
`packages/core/src/validation-interactions.ts`, the Position Object child branch.

The actual fixture already has the required stage; the error is inside its interaction.

```xml
<qti-position-object-stage>
  <object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/>
  <qti-position-object-interaction response-identifier="RESPONSE">
    <qti-prompt>
      Drag the field-note marker onto the Collect water data step in the workflow.
    </qti-prompt>
    <!-- Existing marker object, whose inline SVG data is omitted here. -->
  </qti-position-object-interaction>
</qti-position-object-stage>
```

**Observed:** The schema rejects `qti-prompt` where the marker media is required;
moving the instruction before the stage made a temporary copy validate.
The engine currently allows the prompt through its shared `common` child list.

**Contract boundary:** A stage starts with its image and contains the interaction(s);
the interaction contains one `object`, `img`, or `picture`, not another stage or a prompt,
and the separate missing-picture engine case is listed under D05.

**Fix:** Move the instruction before the existing stage and make the Position Object child
validator require exactly one permitted marker-media element without a prompt or nested stage.

### D13: Template declarations precede response declarations

**Layer:** Fixture XML ordering. **Priority:** P2.

**Source:** `packages/fixtures/xml/template-content-reference.xml:3`;
`packages/fixtures/src/index.ts`, `createTemplateContentFixture`.

```xml
<qti-template-declaration identifier="PATH" cardinality="single" base-type="identifier"/>
<qti-template-declaration identifier="COUNT" cardinality="single" base-type="integer"
  math-variable="true"/>
<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
  <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
</qti-response-declaration>
```

**Observed:** The schema rejects the response declaration after template declarations.
D14's MathML namespace error is independent; repairing this sequence only allows the
validator to reach that later error.

**Ordering scope:** The full item sequence is context declarations, response declarations,
outcome declarations, template declarations, template processing, stimulus references,
companion materials, stylesheets, item body, catalogs, response processing, and modal feedback,
with optional elements omitted as appropriate.

**Fix:** Generate the template-content item in the full schema-defined child order and
verify ordering across the fixture generators independently of the D14 namespace repair.

### D14: MathML elements inherit the QTI namespace

**Layer:** Fixture XML namespaces. **Priority:** P2.

**Sources:** `packages/fixtures/xml/template-content-reference.xml:23` and
`packages/fixtures/src/index.ts`, `createBasicMathMlFixture`.

```xml
<!-- template-content-reference: namespace is inherited from the QTI item. -->
<math><mrow><mi>COUNT</mi><mo>+</mo><mn>1</mn></mrow></math>

<!-- basic-mathml: the same namespace error with a different expression. -->
<math><mrow><mn>2</mn><mo>+</mo><mn>2</mn></mrow></math>
```

**Observed:** Both fragments create QTI-namespace elements, which the item schema rejects
instead of recognizing as MathML; the template example also has the separate D13 order error.
Either a MathML default namespace or a bound prefix such as `m:math` is valid when all
MathML descendants use that namespace.

**Fix:** Put both expressions and their MathML descendants in the MathML namespace using
either a default declaration or consistent prefixing, then regenerate the published fixtures.

### D15: Shared-vocabulary Text Entry occupies a block position

**Layer:** Fixture XML, with a D06 limit dependency. **Priority:** P2.

**Source:** `packages/fixtures/src/index.ts`, `createBasicSharedVocabularyFixture`.

```xml
<qti-item-body>
  <!-- Other shared-vocabulary controls are omitted. -->
  <qti-text-entry-interaction response-identifier="BLOCK_TEXT_WIDTH_RESPONSE"
    class="qti-input-width-20" expected-length="4"/>
</qti-item-body>
```

**Observed:** The schema rejects this inline interaction directly under the item body.
Wrapping this control is a local nesting repair, not evidence that the rest of this large
fixture is correct; its two-gap `GAP_RESPONSE` also lacks an explicit maximum under D06,
whereas its two separate Match controls each key only one pair.

**Fix:** Wrap the text-entry control in a paragraph, repair the independent two-gap limit
under D06, and validate the complete shared-vocabulary fixture after regeneration.

### D16: The rubric omits its required use attribute

**Layer:** Fixture XML. **Priority:** P2.

**Source:** `packages/fixtures/src/index.ts`, `createBasicExtraItemFeatureToleranceFixture`.

```xml
<qti-rubric-block view="candidate">
  <qti-content-body>
    <p>Optional rubric guidance remains visible.</p>
  </qti-content-body>
</qti-rubric-block>
```

**Observed:** The schema reports `The attribute 'use' is required but missing`.
Both `view` and `use` are required, and `view` is already present; allowed `use` values
include `instructions`, `scoring`, `navigation`, and extensions matching the schema's
`ext:` vocabulary pattern.
This fixture tests tolerance of additional valid features and expects no diagnostics,
which is distinct from testing acceptance of schema-invalid markup.

**Fix:** Add `use="instructions"` while retaining `view="candidate"`, regenerate the fixture,
and require schema validity independently of extra-feature tolerance assertions.

## Answer keys

### D17: The essay inherits an unrelated automatic answer key

**Layer:** Fixture generator and scoring intent. **Priority:** P2.

**Source:** `packages/fixtures/src/index.ts`, `defaultResponse` and `assessmentItem`;
`packages/fixtures/xml/extendedText-reference.xml`.

The essay asks for a recommendation supported by garden moisture observations, but
`defaultResponse()` falls through to the generic `A` key and `assessmentItem()` adds
`match_correct` processing.

| Submitted essay response                                                              | Observed score |
| ------------------------------------------------------------------------------------- | -------------- |
| `A`                                                                                   | 1              |
| `Use mulch in the garden beds because the mulched beds retained moisture for longer.` | 0              |

The [guide's human-scored essay example](https://www.imsglobal.org/spec/qti/v3p0/impl)
marks `SCORE` with `external-scored="human"` and omits response processing.
Removing only the key would leave automatic scoring in the generated item.

```xml
<!-- Proposed outcome declaration; remove the key and qti-response-processing. -->
<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"
  external-scored="human"/>
```

**Acceptance boundary:** The host must treat the outcome as awaiting external scoring;
a numeric default alone does not establish that a human grade has been returned, and
this review did not test that host workflow.

**Fix:** Give the essay an explicit generator path that omits the placeholder key and
`match_correct`, declares human-scored `SCORE`, and verifies that external-scoring intent is preserved.

### D18: The four-observation Match question keys only two pairs

**Layer:** Fixture answer key, coupled to D06. **Priority:** P2.

**Source:** `packages/fixtures/src/index.ts`, `defaultResponse`;
`packages/fixtures/xml/match-reference.xml`.

The prompt requests a match for each of four observations, but the generated key includes
only the first two pairs.

| Submitted Match response           | Observed score |
| ---------------------------------- | -------------- |
| `["A G1", "B G2"]`                 | 1              |
| `["A G1", "B G2", "C G3", "D G4"]` | 0              |

The fixture also omits `max-associations`, so fixing D06 alone would reject even the current
two-pair key; update the key, maximum, and expected attempts together.
This answer-key finding is specific to `match-reference`: the two-pair key in
`gapMatch-reference` is complete for its two gaps, although its omitted limit needs D06.

**Fix:** Key all four requested pairs, author `max-associations="4"`, and test complete
and incomplete attempts alongside the default-limit correction.

### D19: The planning-hint control is the entire scored answer

**Layer:** Fixture content and answer key. **Priority:** P2.

**Source:** `packages/fixtures/xml/endAttempt-reference.xml`;
`packages/fixtures/src/index.ts`, the End Attempt branches of `defaultResponse` and
`renderInteractionXml`.

```xml
<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="boolean">
  <qti-correct-response><qti-value>true</qti-value></qti-correct-response>
</qti-response-declaration>
<!-- This is the item's only interaction. -->
<qti-end-attempt-interaction response-identifier="RESPONSE" title="Show planning hint"/>
<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
```

**Observed:** A core session with `RESPONSE: true` produces `SCORE: 1`; the item contains
only the End Attempt interaction, so the prompt's promised later answer does not exist.
This reproduces the scoring consequence without claiming a browser click test, and it is
independent of the D11 nesting defect.

**Fix:** Bind the hint control to an unscored `HINT` response and add a separate substantive
answer interaction whose response processing determines the score.

## Verification evidence and limits

The original offline schema run used the official item schema and its locally resolved
imports; it passed 32 questions and rejected the nine listed above, comprising six
canonical XML files and three supplemental questions.

The revision independently rechecked the current inventory: `packages/fixtures/xml/`
contains 31 XML files, all 31 match the canonical in-memory strings, and
`allQuestionItemFixtures` contains those 31 plus 10 supplemental questions.
Excluding the three catalog XML files would produce a count of 28, but those files are
part of the reviewed canonical question set.

Four existing Vitest suites passed in the original review: fixture, conformance,
interaction parser, and response validation. That is a baseline result, not independent
corroboration of conformance; several tests encode current behavior, including D07's
required-answer policy and explicit-zero override.

During revision, targeted current-source probes additionally checked record Text Entry,
a two-string Extended Text declaration, the complete D04 example, single Match and Gap Match declarations,
Gap Match's omitted maximum, Choice's omitted/zero maximum, both D07 minimum variants,
and the D19 hint response. Declaration probes stop at the item boundary; they do not
establish candidate collection capture or rendering.

Browser rendering, keyboard behavior, accessibility, picture source selection, and
external human-scoring delivery remain untested here. Proposed browser acceptance work
in D01, D02, and D05 describes the evidence needed for implementation, not results of
this review. Re-run the complete fixture schema gate after repairs, since resolving
one reported error can reveal another independent failure.
