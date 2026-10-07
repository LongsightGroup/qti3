# @longsightgroup/qti3-migrator

Framework-neutral QTI 1.2 and QTI 2.x to QTI 3 migration utilities.

QTI 1.2 items with multiple responses are rejected with
`qti12_composite_responses_unsupported` unless the mapper handles every response
through the matching conversion. This prevents scoring only the first answer of a
multi-answer condition. Nonempty QTI 2 `matchGroup` restrictions produce
`qti2_match_group_not_preserved`; empty groups remain unrestricted. Both refusals
apply with safe repair. Hotspot migration preserves surrounding instructions,
region labels, and textual object descriptions. Graphic association and graphic
gap targets also retain their region labels. See `graphic-and-composite-fidelity.test.ts`.

QTI 2 item language and the placement of surrounding content are retained when
migrating block interactions. Hottext response cardinality is preserved independently
of its selection limit. Missing response declarations or changed cardinality/base type
produce `qti2_response_type_not_preserved`. Item-level modal feedback is not yet
translated and produces `qti2_modal_feedback_not_preserved`. Both errors block a
successful migration, including with safe repair; explicitly requested review stubs
retain the errors. Regression coverage is in `item-preservation-regressions.test.ts`.

QTI 2.0's `http://www.imsglobal.org/xsd/imsqti_v2p0` namespace is recognized
alongside QTI 2.1 and 2.2 when translating content and checking scoring fidelity.
Standard QTI 2.0 response-processing template URLs are recognized too; unsupported
programs still produce preservation errors. `qti20-fidelity.test.ts` verifies choice
structure, rubric translation, correct/incorrect/unanswered grades, and rejection of
unpreserved scoring under both repair policies.

QTI 2 choice items may retain an explicit finite non-negative MAXSCORE default through
the canonical choice writer. Import still requires exact structural processing and
outcome fidelity: maximum metadata alone never authorizes replacing a custom program.
`choice-point-roundtrip.test.ts` verifies fractional/zero grades and refusals of changed
programs through standard QTI 2.1/2.2 and the Brightspace export profile.

The migrator reads legacy QTI package or item XML and produces QTI-shaped authoring models from `@longsightgroup/qti3-writer`. It does not own application-specific draft models or authoring UI review policy.

```ts
import { migrateQtiToQti3 } from "@longsightgroup/qti3-migrator";

const result = await migrateQtiToQti3({ filename: "quiz.zip", bytes });
```

Use `migrateQtiToQti3Package` for complete legacy QTI packages when the output should be passed directly to
`@longsightgroup/qti3-writer` package APIs. Package migration preserves manifest item and asset
paths from the source package:

```ts
import { migrateQtiToQti3Package } from "@longsightgroup/qti3-migrator";
import { writeQti3PackageZipResult } from "@longsightgroup/qti3-writer";

const migrated = await migrateQtiToQti3Package({ filename: "quiz.zip", bytes });

if (migrated.ok) {
  const qti3Package = writeQti3PackageZipResult(migrated.package);
  console.log(qti3Package);
}
```

Use `migrateQtiResourceToQti3` when a host package, such as IMS Common Cartridge, has already
identified one QTI resource and can provide that resource's local file closure. The result includes
the underlying migration, launchable QTI 3 package entries, a `launchHref`, item hrefs, and
diagnostics:

```ts
import { migrateQtiResourceToQti3 } from "@longsightgroup/qti3-migrator";

const migrated = await migrateQtiResourceToQti3({
  sourcePath: "assessment/quiz.xml",
  files: {
    "assessment/quiz.xml": quizXmlBytes,
    "assessment/map.png": mapPngBytes,
  },
});

if (migrated.ok) {
  console.log(migrated.title);
  console.log(migrated.launchHref);
  console.log(migrated.entries);
}
```

`files` is the local file closure for one IMS Common Cartridge QTI resource: keys are package-relative
paths within that resource, backslashes are normalized to forward slashes, and `sourcePath` must match
one of those keys after normalization. On success, `entries` is a standalone QTI 3 package file set
rooted at `imsmanifest.xml`; the caller decides where to store or repackage those files.

QTI 1.2 XML resources that contain multiple `<item>` elements are emitted as stable sibling item
paths so package output does not duplicate item paths while source-relative asset references keep the
same base directory.

Resource migration attaches every non-XML file in the provided closure to each migrated item. The
writer emits shared asset paths once when the referenced bytes are identical across items.

Defaults are strict: source repair is disabled and unsupported interactions are reported as diagnostics instead of silently converted.

QTI 2.x migration checks response defaults, mappings, and area mappings against the emitted item.
Mappings that the authoring model cannot reproduce, including weighted choice/pair mappings or
unsupported mapping defaults and bounds, return `qti2_response_mapping_not_preserved` instead of
silently changing scores. Response defaults are not yet supported by the authoring model; their
loss returns `qti2_response_default_not_preserved`. These errors suppress the migrated XML and
authoring item, unless the caller explicitly requests a review stub. Safe source repair does not
permit dropping these semantics.

Text-entry migration preserves string, integer, and float types; input constraints; explicit mapping
weights and case sensitivity; and the correct response independently of its mapping weight.
Match-correct text answers remain case-sensitive. Other response types and unrepresentable mapping
defaults or bounds return diagnostics. `defaultValue` is never interpreted as `correctResponse`.
Extended-text migration also preserves `patternMask` input constraints.

QTI 1.2 material preserves ordered text and image components. Plain text remains literal text;
`text/html` material is accepted when it contains a well-formed XHTML fragment, including encoded
or CDATA content. Malformed HTML, unsupported content types, and unsupported material components
return `qti12_material_not_preserved`, including under safe repair.

QTI assessment-test structure preservation is not implemented yet. When a legacy package contains an
assessment-test resource, migration returns a flat review part and reports
`assessment_test_structure_not_migrated`.

QTI 1.2 choice and associate migration preserves `render_choice shuffle` and converts
`response_label rshuffle="No"` to fixed choices. Canvas matching preserves compatible target-list
shuffle settings and keeps source positions fixed. Conflicting shuffle or fixed settings across
lists return `qti12_canvas_match_shuffle_conflict`, because QTI 3 uses one shared target set.
A fixed label is never used to infer an answer key; missing keys follow the explicit repair policy.

An explicit `shuffle` attribute on legacy graphic gap match returns
`qti2_graphic_gap_shuffle_unsupported`, including false values, rather than silently discarding it.
QTI 3 graphic gap match does not define this attribute. Ordinary graphic gap match without this
attribute continues to migrate.

Authored QTI 2 response processing is accepted when its canonical standard template or its
inline expression tree is preserved by the writer. Changed inline rules (which override a
coexisting template), unknown templates, and changed template semantics return `qti2_response_processing_not_preserved`. The migrator
does not replace a supplied scoring program with an inferred answer-key program. Absent or empty
processing is also checked: if the writer would introduce scoring, migration returns the same
unsupported diagnostic. Outcome declarations, types, defaults, and metadata must be preserved;
otherwise migration returns `qti2_outcomes_not_preserved`. Explicit numeric zero defaults are
recognized as equivalent to implicit numeric zero defaults.

Nonzero `matchMin` on association choices, gap choices, and associable hotspots returns `qti2_match_min_not_preserved` because
the authoring model cannot yet express it. These failures produce no converted item unless the
caller explicitly requests a review stub. QTI 2 `fixed` accepts both XML Boolean spellings,
including `fixed="1"` for a pinned choice.

QTI 1.2 scoring currently accepts a single positive conjunction that sets `SCORE` to 1 (or adds 1 once),
with a zero default, over the supported single-response forms. Negation, alternative scoring
conditions, weighted/additive scores, and unpreserved defaults return
`qti12_response_processing_unsupported`, including under `repairPolicy: "safe"`.
For example, Canvas matching conditions that add 50 points per pair are rejected;
they cannot be represented by the writer's all-or-nothing matching model.

String correct responses and text-entry mapping keys preserve significant whitespace.

QTI 2 migration rejects template declarations or template processing with
`qti2_template_not_preserved` until those semantics can be preserved. It also rejects
changes to correct responses with `qti2_correct_response_not_preserved`, including
invented answer keys under safe repair. Hottext and gap-match migration preserve prompts,
surrounding item-body content, and the original interaction position.

QTI 2 rubric blocks retain their `view` audiences when translated to `qti-rubric-block`.
Adaptive QTI 2 items return `qti2_adaptive_not_preserved`, including under safe repair: the
current authoring writer cannot preserve adaptive lifecycle semantics. No converted item is
produced unless the caller explicitly requests a review stub.

QTI 2 rubric blocks become QTI 3 rubrics with a `qti-content-body` wrapper and
`use="instructions"`, reflecting QTI 2's definition of rubrics as instructions to the selected
audiences. The source `view` remains unchanged; a scorer audience alone does not imply a scoring use.

Canonical inline-choice all-or-nothing matching can retain explicit finite
non-negative point maxima through standard QTI 2.1/2.2 round trips.
The parsed maximum is a candidate for the canonical writer. Actual processing
and outcome metadata must still agree with the regenerated program before an
item is emitted. Changed scoring or unmatched range metadata remains a refusal;
maximum metadata alone never authorizes replacing a custom program.

Brightspace retains its configured dropdown-to-text-answer downgrade and loss
receipt. A useful downgraded export does not establish a lossless dropdown
re-import; the conservative importer refuses programs it cannot reproduce.
