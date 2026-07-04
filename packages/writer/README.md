# @longsightgroup/qti3-writer

Framework-neutral QTI 3 assessment item XML writer for authoring systems.

This package writes QTI-shaped authoring primitives to QTI 3 XML. It does not expose qflow draft
types, render UI, or sanitize HTML. Trusted XHTML/QTI fragments must be prepared by the host before
they are passed to the writer.

## Install

```sh
npm install @longsightgroup/qti3-writer
```

## Use

```ts
import { qti3TrustedXmlFragment, writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";

const result = writeQti3AssessmentItemResult({
  interactionType: "choice",
  identifier: "item-1",
  title: "Choice item",
  promptHtml: qti3TrustedXmlFragment("Choose one."),
  responseCardinality: "single",
  choices: [
    { identifier: "A", text: "Alpha" },
    { identifier: "B", text: "Beta" },
  ],
  correctResponse: ["B"],
});

if (!result.ok) {
  throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
}

console.log(result.xml);
```

The stable host-facing API is `writeQti3AssessmentItemResult(item)`. It returns typed diagnostics
and should be used by production authoring systems. Use `validateQti3AuthoringItem(item)` when a UI
or import pipeline needs diagnostics before writing XML.

`writeQti3AssessmentItem(item)` remains available as a convenience API for scripts and tests. It
throws `Qti3WriterError` when writer invariants fail.

Direct builders do not require the redundant `interactionType` discriminant:

```ts
import { buildQti3TextEntryItem, qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";

const xml = buildQti3TextEntryItem({
  identifier: "item-2",
  title: "Text entry",
  bodyHtml: qti3TrustedXmlFragment(
    '<p>Answer: <qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
  ),
  responses: [{ responseIdentifier: "RESPONSE", answers: [{ value: "deno" }] }],
});
```

## Trusted Fragments

`bodyHtml`, `promptHtml`, and rich choice content use `Qti3TrustedXmlFragment`. The writer escapes
plain text fields and XML attributes, but it assembles trusted fragments as provided. Sanitization is
the host authoring system's responsibility.

## Support Matrix

The exported `qti3WriterInteractionSupport` array is the authoritative support matrix for
interactions the writer can currently write and validate:

| Interaction       | QTI element                         | Writer support                                                        |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Choice            | `qti-choice-interaction`            | Writes and validates                                                  |
| Order             | `qti-order-interaction`             | Writes and validates ordered cardinality and choice references        |
| Inline choice     | `qti-inline-choice-interaction`     | Replaces empty QTI placeholders and validates slot references         |
| Hottext           | `qti-hottext-interaction`           | Replaces empty QTI placeholders and validates choice references       |
| Gap match         | `qti-gap-match-interaction`         | Writes and validates gap choices, targets, and directed pairs         |
| Associate         | `qti-associate-interaction`         | Writes and validates pair responses and associable choices            |
| Text entry        | `qti-text-entry-interaction`        | Writes declarations and validates trusted body interaction references |
| Match             | `qti-match-interaction`             | Writes and validates                                                  |
| Hotspot           | `qti-hotspot-interaction`           | Writes and validates accessible object metadata and references        |
| Graphic associate | `qti-graphic-associate-interaction` | Writes and validates object metadata, hotspots, and pair responses    |
| Graphic gap match | `qti-graphic-gap-match-interaction` | Writes and validates hotspot and inline-gap target modes              |

The writer test suite round-trips every supported builder through `@longsightgroup/qti3-core`
parsing and `validateAssessmentItem()` with zero diagnostics.

For order items, an explicit `correctOrder` must include every choice by default. Partial correct
orders are accepted only when `minChoices` or `maxChoices` explicitly configures subset ordering.

Inline choice items use trusted `bodyHtml` with empty QTI-shaped placeholders. The writer replaces
each `<qti-inline-choice-interaction response-identifier="..."/>` placeholder with the generated
interaction for the matching slot. This keeps qflow editor markers out of the public API while still
letting host tools control the surrounding inline prose. Default `all_or_nothing` scoring writes the
slot count as the score when every inline choice is correct, so a two-slot item awards `SCORE = 2`.
Use `map_response` scoring when the host needs per-slot partial credit or custom normalization.

Hottext items use trusted `bodyHtml` inside the generated `qti-hottext-interaction`. Each generated
hottext choice is placed by an empty `<qti-hottext identifier="..."/>` placeholder in that body
fragment. When `maxChoices` is omitted, the writer emits `cardinality="multiple"`; set
`maxChoices: 1` for single-select hottext items.

Gap match items use trusted `bodyHtml` inside the generated `qti-gap-match-interaction`. Targets are
QTI-shaped `<qti-gap identifier="..."/>` elements in that body fragment and must match the structured
`targets` list. Gap styling, including input-width classes, belongs on those trusted `qti-gap`
elements. The writer supports text and image gap choices and defaults to `map_response` scoring for
parity with qflow gap match exports.

Graphic interactions render generated long-description markup immediately before the interaction
element. For graphic gap match, trusted `bodyHtml` is interaction content so inline `qti-gap`
targets can be parsed and validated by QTI engines.

Graphic gap match supports two target modes. Hotspot targets are generated as
`qti-associable-hotspot` elements on the graphic. Inline targets are declared in `targets` with
`targetType: "inlineGap"` and must have matching trusted `bodyHtml` containing `qti-gap` elements.

## Migration Pattern

Future qflow interaction writers should move into this package one interaction at a time. Each
migration should add:

- a `Qti3XAuthoringItem` union member
- a direct-builder input type that does not require `interactionType`
- a validator returning `Qti3WriterDiagnostic[]`
- a package-owned XML writer
- a `qti3WriterInteractionSupport` entry
- a qflow adapter from draft model to QTI authoring model
- parser plus `validateAssessmentItem()` round-trip tests

The exported `qti3WriterPlannedInteractionMigrationOrder` from `planned-interactions.js` records the
intended qflow migration sequence. Planned interactions are not part of the supported writer matrix
until they have writer validation, XML output, support metadata, and round-trip tests.

Current planned order:

1. extended text
2. upload
3. media
4. graphic order
5. select point
6. position object
7. slider
8. custom
9. portable custom
10. drawing
11. end attempt
