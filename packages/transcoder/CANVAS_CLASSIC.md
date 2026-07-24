# Canvas Classic Quizzes profile

`canvas-classic-quizzes@1` targets the QTI 1.2 dialect imported by Canvas Classic Quizzes. It is
deliberately separate from `qti12-standard@1`: callers must request it by name, and standards
output is not made Canvas-specific.

## Evidence baseline

The profile is based on source and fixtures pinned to these revisions:

- [Canvas LMS exporter and fixtures](https://github.com/instructure/canvas-lms/tree/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/cc/qti)
- [Instructure QTI 1.x importer models](https://github.com/instructure/qti/blob/6e5630abe12c698b5016eaf1b3879e7a01171bcd/lib/qti/v1/models/interactions.rb)
- [text2qti Canvas package generator](https://github.com/gpoore/text2qti/blob/c9f119b855fe96ab721e79d3227acc86824f94dc/text2qti/xml_assessment.py)

Canvas's own exporter establishes the profile's wire contract:

- one `questestinterop/assessment/section` document containing all quiz items;
- `itemmetadata/qtimetadata` fields for `question_type`, `points_possible`,
  `original_answer_ids`, and `assessment_question_identifierref`;
- HTML stems and rich answer content in `mattext texttype="text/html"`;
- `response1` for ordinary responses and `response_<source-id>` for matching rows;
- percentage scoring, including exact-set scoring for multiple answers and additive per-row
  scoring for matching;
- a separate Canvas `assessment_meta.xml` dependency; and
- IMS Content Packaging 1.1.3 with an `imsqti_xmlv1p2` assessment resource.

The resource type is not `imsqti_xmlv1p1`. Canvas source defines its QTI-only assessment type as
`imsqti_xmlv1p2`; hybrid Common Cartridge exports use
`imsqti_xmlv1p2/imscc_xmlv1p1/assessment`.

## Mapping policy

Native Canvas forms are emitted for single choice, multiple answer, true/false, short answer,
numeric, essay, matching, file upload, and a single-correct-region hotspot. Matching uses one
response per source row, a shared target pool, and equal partial credit per correctly matched row.

Canvas Classic has no dependable native representation for every QTI 3 interaction. The profile
therefore applies explicit, diagnosed fallbacks:

- multi-region hotspots become exactly scored multiple-answer questions;
- order and graphic order become matching questions with one row per sequence position;
- associate becomes an essay question whose visible instructions retain the available task elements;
- labeled relationship interactions become deterministic choice questions;
- scalar point, position, and slider responses become text or numeric entry; and
- drawing, media, end-attempt, and custom interactions become manual-grade essay questions.

No fallback promises automatic scoring unless the emitted response and scoring rule are
deterministically equivalent. Referenced assets and safe source paths are retained.

## Release evidence

Source analysis, semantic checks, reverse migration, stable goldens, accessibility/keyboard
contracts, and XSD validation are necessary but do not prove that a Canvas release imports every
case. `release:check` therefore refuses publication until
`packages/transcoder/evidence/vendor-import/canvas-classic-quizzes@1-import.json` contains a
reviewed, committed successful-import receipt for all 22 registry interactions:

```json
{
  "schema": "qti3.transcoder.vendor-import-evidence.v1",
  "profile": "canvas-classic-quizzes@1",
  "product": "Canvas Classic Quizzes",
  "productVersion": "Canvas release or commit tested",
  "sourceRevision": "instructure/canvas-lms@1c9f0bb8013ed69c4f2efe11fd483025469b7e6c",
  "recordedAt": "2026-07-23T00:00:00.000Z",
  "cases": [
    {
      "caseId": "canvas-classic-quizzes@1/choice",
      "status": "imported"
    }
  ]
}
```

Do not create or commit the receipt until the recorded Canvas run has occurred. Once committed, the
receipt becomes durable release evidence available to clean CI checkouts; reviewers should verify
the Canvas version, source revision, date, and complete case list.
