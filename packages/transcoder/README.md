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
for its package conventions, interaction policies, and release evidence contract. QTI 1.2
conversions use declared, diagnosed fallbacks when the older standard or selected product dialect
cannot represent an interaction natively.

Typed authoring input and parsed XML both normalize through the core `QtiAssessmentItem` semantic
model. Interaction mappers are executable and exhaustive over the core registry. QTI 2.1 and 2.2
share semantic mappers but have separate wire serializers; QTI 1.2 owns explicit native and
fallback response/scoring mappings. Composite items produce one mapping report per interaction.

Package transcoding preserves safe source paths, assessment-test section structure, item
dependencies, and per-resource asset ownership. Generated reports use deterministic
`assets/generated/<sha256>.json` paths.

`pnpm check:transcoder-support` executes every profile/interaction case and compares the result
with the committed evidence hashes. `pnpm check:transcoder-xsd` validates all 88 cells against the
vendored, SHA-256-locked schema closure. `pnpm release:check` also requires a current, full-matrix
Canvas import receipt before a vendor profile can be published.
