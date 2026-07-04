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

The primary API is `writeQti3AssessmentItem(item)`. It throws `Qti3WriterError` when writer
invariants fail. Use `writeQti3AssessmentItemResult(item)` or `validateQti3AuthoringItem(item)` when
callers need typed diagnostics instead of exceptions.

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

The exported `qti3WriterInteractionSupport` array records the writer's supported interaction
surface:

| Interaction | QTI element                  | Writer support                                                        |
| ----------- | ---------------------------- | --------------------------------------------------------------------- |
| Choice      | `qti-choice-interaction`     | Writes and validates                                                  |
| Text entry  | `qti-text-entry-interaction` | Writes declarations and validates trusted body interaction references |
| Match       | `qti-match-interaction`      | Writes and validates                                                  |
| Hotspot     | `qti-hotspot-interaction`    | Writes and validates accessible object metadata and references        |

The writer test suite round-trips every supported builder through `@longsightgroup/qti3-core`
parsing and `validateAssessmentItem()` with zero diagnostics.
