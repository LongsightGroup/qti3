# Canvas New Quizzes profile

`canvas-new-quizzes@1` targets the direct QTI package import exposed by Canvas New Quizzes. It
emits a Canvas-flavored QTI 1.2 package and is deliberately separate from both
`canvas-classic-quizzes@1` and `qti12-standard@1`.

The profile does not target the course-import option that converts Classic Quizzes into New
Quizzes. That workflow passes through a separate migration service and is not treated as equivalent
to direct New Quizzes import.

## Evidence status

The profile is source-derived. A live Canvas New Quizzes import has not been performed, so
`vendorEvidence.compatibility.productImport` is `unverified`. Generated output must not be
described as product-verified until a real import run has been recorded.

The public evidence baseline is pinned to:

- [Canvas LMS New Quizzes package integration](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/cc/qti/new_quizzes_generator.rb);
- [Canvas LMS New Quizzes package fixtures](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/spec/lib/cc/qti/new_quizzes_generator_spec.rb);
- [Instructure QTI 1.2 interaction dispatch](https://github.com/instructure/qti/blob/f58eed273fd79060260dc18599378a36562389a4/lib/qti/v1/models/interactions.rb);
- [Instructure QTI 1.2 ordering parser](https://github.com/instructure/qti/blob/f58eed273fd79060260dc18599378a36562389a4/lib/qti/v1/models/interactions/ordering_interaction.rb); and
- [Instructure's direct New Quizzes import documentation](https://community.instructure.com/en/kb/articles/661050-how-do-i-import-a-quiz-from-a-qti-package-in-new-quizzes).

Canvas documentation says that direct New Quizzes import accepts QTI 1.2 and QTI 2.x packages, but
also warns that software-specific third-party item types may be unsupported. The public Instructure
QTI parser exposes a broader Canvas-relevant interaction surface through its QTI 1.2 models, so
version 1 of this profile uses that path rather than assuming generic QTI 2.1 compatibility.

## Package contract

The profile uses the established Canvas QTI 1.2 package boundary:

- an IMS Content Packaging manifest;
- an `imsqti_xmlv1p2` assessment resource;
- an `assessment_meta.xml` dependency;
- Canvas item metadata including `question_type`, `points_possible`,
  `original_answer_ids`, and `assessment_question_identifierref`;
- HTML stems and rich choice content; and
- percentage-based response processing.

This package shape is shared with the Classic profile only where the observable wire contract is
the same. Interaction policy remains profile-specific.

## Mapping policy

New Quizzes ordering is emitted as a native QTI 1.2 ordered response:

- `response_lid` uses `rcardinality="Ordered"`;
- scoring uses indexed `varequal` comparisons;
- Canvas metadata identifies an `ordering_question`; and
- the Classic matching fallback is not applied.

Other mappings remain conservative until public evidence establishes a distinct New Quizzes
contract. In particular:

- graphic ordering remains a diagnosed matching fallback;
- association and interactions without a dependable Canvas representation remain manual-grade
  fallbacks;
- multi-region hotspots retain the accessible multiple-answer or manual-grade policy; and
- file upload uses Canvas file-upload metadata without inventing a text response.

The executable support report records every mapping and fallback under
`packages/transcoder/support/canvas-new-quizzes@1.md`. Source analysis, semantic
validation, reverse migration, stable goldens, and XSD validation do not substitute for a product
import.

## Future product evidence

A future live import may be recorded at
`packages/transcoder/evidence/vendor-import/canvas-new-quizzes@1-import.json` using the existing
vendor-import evidence schema. The receipt should identify the Canvas release tested, distinguish
direct quiz import from item-bank import, and record each interaction case independently.

Do not create or commit a receipt until the recorded Canvas run has occurred.
