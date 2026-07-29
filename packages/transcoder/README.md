# `@longsightgroup/qti3-transcoder`

Profile-driven QTI 3 to QTI 1.2, QTI 2.1, and QTI 2.2 transcoding.

Every operation requires an explicit, versioned profile. The package does not detect an LMS or
silently select a compatibility mode.

```ts
import { transcodeQti3Item } from "@longsightgroup/qti3-transcoder";

const result = transcodeQti3Item(
  { kind: "xml", xml: qti3Xml, sourcePath: "items/question.xml" },
  { profile: "qti21-standard@1" },
);
```

Node-only evidence tooling is available from the explicit
`@longsightgroup/qti3-transcoder/evidence` entry point. The main entry point has no Node runtime
dependency.

The standards profiles are `qti12-standard@1`, `qti21-standard@1`, and
`qti22-standard@1`. `canvas-classic-quizzes@1` is a separate, source-backed Canvas Classic
Quizzes dialect; it is never selected implicitly. See [Canvas Classic profile](./CANVAS_CLASSIC.md)
for its package conventions, interaction policies, and release evidence contract.
`canvas-new-quizzes@1` is a distinct source-derived Canvas New Quizzes direct-import profile whose
live product-import status is explicitly unverified. See
[Canvas New Quizzes profile](./CANVAS_NEW_QUIZZES.md). `moodle-xml@1` targets Moodle's first-party
question-bank XML importer rather than its legacy Blackboard compatibility path. See
[Moodle XML profile](./MOODLE_XML.md).
`blackboard-question-banks@1` targets Blackboard Learn's QTI 2.1 question-bank importer. See the
[Blackboard question-bank profile](./BLACKBOARD_QTI21.md).
`brightspace-course-import@1` targets the QTI 2.1 path under Brightspace course import. See the
[Brightspace course-import profile](./BRIGHTSPACE_QTI21.md). QTI 1.2 and vendor conversions use
declared, diagnosed fallbacks when the selected destination cannot represent an interaction
natively.

Typed authoring input and parsed XML both normalize through the core `QtiAssessmentItem` semantic
model. Interaction mappers are executable and exhaustive over the core registry. QTI 2.1 and 2.2
share semantic mappers but have separate wire serializers; QTI 1.2 owns explicit native and
fallback response/scoring mappings. Composite items produce one mapping report per interaction.

Package transcoding preserves safe source paths, assessment-test section structure, item
dependencies, and per-resource asset ownership. Generated reports use deterministic
`assets/generated/<sha256>.json` paths.

`pnpm check:transcoder-support` executes every profile/interaction case and compares the result
with the committed evidence hashes. `pnpm check:transcoder-xsd` validates every QTI profile cell
against the vendored, SHA-256-locked schema closure. Moodle XML is a proprietary vendor format and
is validated against its runtime semantic contract. Recorded product imports may supplement this
evidence, but they are not required by `pnpm release:check`.
