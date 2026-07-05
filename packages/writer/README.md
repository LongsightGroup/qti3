# @longsightgroup/qti3-writer

Framework-neutral QTI 3 assessment item XML writer for authoring applications.

This package writes QTI-shaped authoring primitives to QTI 3 XML. It does not render UI or sanitize
HTML. Trusted XHTML/QTI fragments must be prepared by the calling application before they are passed
to the writer.

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

The stable application-facing API is `writeQti3AssessmentItemResult(item)`. It returns typed
diagnostics and should be used by production authoring systems. Use
`validateQti3AuthoringItem(item)` when a UI or import pipeline needs diagnostics before writing XML.

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
the calling application's responsibility.

## Support Matrix

The exported `qti3WriterInteractionSupport` array is the authoritative support matrix for
interactions the writer can currently write and validate:

| Interaction       | QTI element                         | Writer support                                                         |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Choice            | `qti-choice-interaction`            | Writes and validates                                                   |
| Order             | `qti-order-interaction`             | Writes and validates ordered cardinality and choice references         |
| Inline choice     | `qti-inline-choice-interaction`     | Replaces empty QTI placeholders and validates slot references          |
| Hottext           | `qti-hottext-interaction`           | Replaces empty QTI placeholders and validates choice references        |
| Gap match         | `qti-gap-match-interaction`         | Writes and validates gap choices, targets, and directed pairs          |
| Extended text     | `qti-extended-text-interaction`     | Writes constructed-response interactions and rubric blocks             |
| Upload            | `qti-upload-interaction`            | Writes file response declarations and application upload metadata      |
| Media             | `qti-media-interaction`             | Writes audio, video, and object media with playback metadata           |
| Associate         | `qti-associate-interaction`         | Writes and validates pair responses and associable choices             |
| Text entry        | `qti-text-entry-interaction`        | Writes declarations and validates trusted body interaction references  |
| Match             | `qti-match-interaction`             | Writes and validates                                                   |
| Hotspot           | `qti-hotspot-interaction`           | Writes and validates accessible object metadata and references         |
| Graphic order     | `qti-graphic-order-interaction`     | Writes and validates object metadata, hotspots, and ordered responses  |
| Select point      | `qti-select-point-interaction`      | Writes and validates point responses, area mappings, and object data   |
| Position object   | `qti-position-object-interaction`   | Writes and validates stage/movable objects, point responses, targets   |
| Slider            | `qti-slider-interaction`            | Writes and validates numeric bounds, responses, mappings, presentation |
| Custom            | `qti-custom-interaction`            | Writes trusted legacy custom markup and response processing fragments  |
| Portable custom   | `qti-portable-custom-interaction`   | Writes launch metadata, modules, trusted markup, response processing   |
| Drawing           | `qti-drawing-interaction`           | Writes file responses with accessible canvas object metadata           |
| End attempt       | `qti-end-attempt-interaction`       | Writes boolean end-attempt responses and button metadata               |
| Graphic associate | `qti-graphic-associate-interaction` | Writes and validates object metadata, hotspots, and pair responses     |
| Graphic gap match | `qti-graphic-gap-match-interaction` | Writes and validates hotspot and inline-gap target modes               |

The writer test suite round-trips every supported builder through `@longsightgroup/qti3-core`
parsing and `validateAssessmentItem()` with zero diagnostics.

For order items, an explicit `correctOrder` must include every choice by default. Partial correct
orders are accepted only when `minChoices` or `maxChoices` explicitly configures subset ordering.

Inline choice items use trusted `bodyHtml` with empty QTI-shaped placeholders. The writer replaces
each `<qti-inline-choice-interaction response-identifier="..."/>` placeholder with the generated
interaction for the matching slot. This keeps editor markers out of the public API while still
letting applications control the surrounding inline prose. Default `all_or_nothing` scoring writes
the slot count as the score when every inline choice is correct, so a two-slot item awards
`SCORE = 2`. Use `map_response` scoring when the application needs per-slot partial credit or custom
normalization.

Hottext items use trusted `bodyHtml` inside the generated `qti-hottext-interaction`. Each generated
hottext choice is placed by an empty `<qti-hottext identifier="..."/>` placeholder in that body
fragment. When `maxChoices` is omitted, the writer emits `cardinality="multiple"`; set
`maxChoices: 1` for single-select hottext items.

Gap match items use trusted `bodyHtml` inside the generated `qti-gap-match-interaction`. Targets are
QTI-shaped `<qti-gap identifier="..."/>` elements in that body fragment and must match the structured
`targets` list. Gap styling, including input-width classes, belongs on those trusted `qti-gap`
elements. Each gap target can have at most one associated choice; repeated target identifiers in
`correctResponse` are rejected. The writer supports text and image gap choices and defaults to
`map_response` scoring for authoring systems that need per-pair partial credit.

Extended text items write a single `qti-extended-text-interaction` after optional trusted `bodyHtml`.
The writer supports prompt, rubric, expected length/lines, min/max strings, placeholder text,
pattern-mask attributes, `format="plain"`, `format="preformatted"`, and `format="xhtml"`.
`qti3-core` validates extended text response declarations as `cardinality="single"` and
`base-type="string"`, so the writer reports diagnostics for other response shapes.

Upload items write a single `qti-upload-interaction` with a `cardinality="single"` /
`base-type="file"` response declaration. Application constraints such as maximum file size, allowed file
types, and multiple-file UI behavior are emitted as `data-max-size`, `data-file-types`, and
`data-multiple` attributes for runtimes that understand them. When `correctResponse` is
provided, the writer emits a correct-response filename and the `match_correct` response-processing
template; otherwise upload items remain manually scored/unscored.

Media items write a single `qti-media-interaction` with a `cardinality="single"` /
`base-type="integer"` response declaration for play count. The writer supports audio, video, and
object media sources, video captions, transcript companion materials, autostart/loop flags,
min/max play bounds, coords, labels, dimensions, and media shared-vocabulary player controls.

Slider items write a single numeric `qti-slider-interaction`. The writer infers `base-type` as
`integer` when bounds, step, correct response, and mapping keys are whole numbers; otherwise it uses
`float`. Slider scoring defaults to `map_response` when mappings are present and `match_correct`
when they are not.

Custom interaction items write deprecated legacy `qti-custom-interaction` items for applications
that still need that QTI shape. The writer validates response declaration shape and XML attribute
names, but it treats widget markup and custom response processing as trusted fragments supplied by
the application.
Portable custom items write `qti-portable-custom-interaction` launch metadata, optional
`qti-interaction-modules`, and trusted `qti-interaction-markup`. The writer requires a custom
interaction type identifier plus either a `module` attribute or at least one interaction module.
Drawing items write a single `qti-drawing-interaction` with a `cardinality="single"` /
`base-type="file"` response declaration and an accessible canvas object.
End attempt items write a single `qti-end-attempt-interaction` with a `cardinality="single"` /
`base-type="boolean"` response declaration and a required button title.

Graphic interactions render generated long-description markup immediately before the interaction
element. Graphic order defaults `correctOrder` to the declared hotspot order when omitted. For
graphic order items, an explicit `correctOrder` must include every hotspot by default. Partial
correct orders are accepted only when `minChoices` or `maxChoices` explicitly configures subset
ordering. Select point and position object write `map_response_point` scoring and require at least
one area mapping target. When `maxChoices` is omitted, these point interactions emit
`cardinality="single"`; set `maxChoices` above 1 for multi-point responses. For graphic gap match,
trusted `bodyHtml` is interaction content so inline `qti-gap` targets can be parsed and validated by
QTI engines.

Graphic gap match supports two target modes. Hotspot targets are generated as
`qti-associable-hotspot` elements on the graphic. Inline targets are declared in `targets` with
`targetType: "inlineGap"` and must have matching trusted `bodyHtml` containing `qti-gap` elements.
