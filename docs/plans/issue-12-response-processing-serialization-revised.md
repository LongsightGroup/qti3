# Issue 12: Structured Response Processing Serialization Plan (Revised)

Revision of `issue-12-response-processing-serialization.md` after auditing the plan against the
actual model (`packages/core/src/types.ts`), parser (`packages/core/src/parser-processing.ts`),
scorer (`packages/core/src/session.ts`), and public exports (`packages/core/src/index.ts`).

## Critique of the Original Plan

### 1. Critical: "emit rules then conditions" double-emits every condition

The original plan says: _"Emit child rules before child conditions, matching the current
structured model fields."_ This is wrong and would fail its own round-trip test.

`QtiResponseProcessing.conditions` is a **derived, flattened convenience copy** of the
`responseCondition` entries already inside `rules`:

- `parseResponseProcessing()` (`parser-processing.ts:14-23`) populates `rules` via
  `parseResponseRules()`, which already wraps each `qti-response-condition` as a
  `{ type: "responseCondition", condition }` rule, **and** separately populates `conditions`
  via `responseConditionsFromChildren()`, which re-extracts the same conditions (recursing
  into fragments).
- Nothing in the codebase consumes `conditions`. The scorer executes `processing.rules` only
  (`session.ts:646`), and validation walks `responseProcessing?.rules` only
  (`validation.ts:899`).

Serializing both fields would emit each condition twice for any parsed model, and would also
destroy rule ordering — in QTI the response rules are a single ordered list where
`qti-set-outcome-value` and `qti-response-condition` interleave; `rules` preserves that
document order, `conditions` does not.

**Fix:** `rules` is the single source of truth. Serialize `template` + `rules` in order and
ignore `conditions` (see Serialization Behavior below for the inconsistency diagnostic).

### 2. The model types are not exported, so the stated use case is impossible

The use case is an authoring tool hand-building a `QtiResponseProcessing` value, but
`index.ts` does not export `QtiResponseProcessing`, `QtiResponseRule`, `QtiResponseCondition`,
`QtiProcessingExpression`, `QtiSetOutcomeValue`, `QtiLookupOutcomeValue`, or
`QtiSourceLocation` (it exports `QtiResponseBranch` but none of the others). The plan must add
these exports — and note that `pnpm verify` runs `check:exports`, so this is gated.

### 3. The "supported expression list + layering" hedge is unnecessary

The plan enumerates ~40 expression types and adds _"if this list is too large, implement in
layers."_ Better: implement `serializeExpression()` as an **exhaustive switch over the
`QtiProcessingExpression` discriminated union** with a `never` check in the default branch.
Every variant in the union is already produced by the parser, so every variant must be
serializable; the compiler then proves completeness and the layering question disappears.
The original list also silently omitted `gcd`, `lcm`, `randomInteger`, and `randomFloat`
(hand-waved as "integer operations" / "random"). With an exhaustive switch, the
`unsupportedExpression` diagnostic only fires for malformed runtime objects from JS callers.

### 4. Several model shapes do not map 1:1 to elements — the plan never specifies the mapping

These asymmetries must be spelled out or implementers will guess wrong:

- **`matchCorrect` is not an element.** It is the parser's special-case for
  `<qti-match><qti-variable/><qti-correct/></qti-match>` (`parser-processing.ts:677-687`).
  It must serialize back to that `qti-match` shape.
- **`isNull` stores only an identifier** — the parser only recognizes
  `qti-is-null > qti-variable`. Serialize to exactly that nesting.
- **`numericCompare` / `durationCompare`** map back to `qti-lt|qti-lte|qti-gt|qti-gte` and
  `qti-duration-lt|qti-duration-gte` by the `operator` field.
- **`random` unwraps an inner `qti-multiple` wrapper** at parse time
  (`parser-processing.ts:287-296`). Serialize values directly under `qti-random` (canonical
  form). Model-level round-trip holds; byte-level round-trip of the wrapper variant is
  explicitly not a goal.

### 5. No policy for `baseValue` text or the raw `attributes` bags

- **`baseValue`**: prefer `rawValue` when present (guarantees parse → serialize → parse
  stability through `coerceValue`); otherwise format the scalar `value`
  (`String(value)` / `"true"`/`"false"`). A `baseValue` with no `rawValue` and a `null` or
  non-scalar `value`, or with no `baseType`, is unserializable → error diagnostic. Note the
  parser synthesizes `{ type: "baseValue", value: null }` (no `baseType`) as a fallback for
  rules missing their expression — those must fail with a clear diagnostic, not emit invalid
  `<qti-base-value/>`.
- **`randomInteger` / `randomFloat` / `inside`**: the typed numeric fields are lossy —
  QTI allows template-variable references in `min`/`max`/`step`, which parse to `NaN` while
  the original strings survive in the `attributes` bag. Emit the known attribute keys
  (`min`, `max`, `step`; `shape`, `coords`) from the `attributes` bag verbatim when present,
  falling back to formatting the typed fields for hand-built models (coords joined with
  `","`). Fixed attribute order, not bag order.
- **`customOperator`**: arbitrary attributes are semantically significant — emit the full
  `attributes` bag in sorted-key order for determinism (`definition`/`class` are part of the
  bag).
- **`anyN.min/max`, `repeat.numberRepeats`, `index.n`**: already strings — emit verbatim
  (they may be template references).

### 6. Reuse the existing XML escaping helpers instead of writing a third copy

`escapeXmlText` / `escapeXmlAttribute` already exist privately in
`parser-custom-interactions.ts:310-316`. Lift them into `xml.ts` and reuse them from both
call sites. (The plan's "Do not add dependencies" stands; this removes duplication instead.)

### 7. Round-trip testing is under-specified and misses the best free coverage

- Model comparison must **strip `source` recursively** before deep-equal (locations cannot
  survive re-parsing of generated XML).
- Reuse the real fixture items in `packages/fixtures/xml/` that carry
  `qti-response-processing` (`choice-reference.xml`, `extendedText-reference.xml`,
  `slider-reference.xml`, `textEntry-reference.xml`, `drawing-reference.xml`,
  `media-reference.xml`) for parse → serialize → parse round-trips, in addition to
  hand-written cases.
- Add an explicit **no-duplication regression test**: a parsed item with a
  `responseCondition` serializes that condition exactly once (guards against critique #1).

### 8. Smaller corrections

- **File naming**: use `serializer-processing.ts` (mirrors `parser-processing.ts`,
  `parser-values.ts` naming) rather than `response-processing-serializer.ts`, and leave the
  expression serializer reusable for a future template-processing serializer (the parser
  already shares `parseExpression` between both).
- **Empty model**: `{ rules: [], conditions: [] }` with no template is schema-valid —
  serialize to `<qti-response-processing/>` with `ok: true`; don't treat it as an error.
- **Template + inline rules together** is legal QTI (template attribute with inline
  fallback rules); the serializer must support both at once, not either/or.
- **`ok` semantics**: define precisely — `ok: false` (and `xml: undefined`) iff any
  `severity: "error"` diagnostic; warnings may accompany `ok: true` with XML.
- The escaping test premise "template-only `map_response` serializes with escaped
  attributes" is weak (the standard template URIs contain nothing to escape); use an
  attribute value containing `&`, `<`, and `"` instead.

---

## Revised Plan

### Summary

Add deterministic, spec-compliant XML serialization for the structured
`QtiResponseProcessing` model. Serialize only from the validated public model — no raw XML
preservation. Unserializable model shapes return typed error diagnostics and no XML.

### Public API

```ts
export interface QtiSerializeResponseProcessingResult {
  ok: boolean; // false iff any error-severity diagnostic; xml is undefined when false
  xml?: string | undefined;
  diagnostics: QtiDiagnostic[];
}

export function serializeResponseProcessing(
  processing: QtiResponseProcessing,
): QtiSerializeResponseProcessingResult;
```

Implementation file: `packages/core/src/serializer-processing.ts`.

Export from `packages/core/src/index.ts`:

- `serializeResponseProcessing`, `QtiSerializeResponseProcessingResult`
- The model types the use case requires: `QtiResponseProcessing`, `QtiResponseRule`,
  `QtiResponseCondition`, `QtiProcessingExpression`, `QtiSetOutcomeValue`,
  `QtiLookupOutcomeValue`, `QtiSourceLocation`, `QtiDiagnosticSeverity`.

(`pnpm verify` runs `check:exports`; keep the export list in sync.)

### Serialization Behavior

**Source of truth.** Serialize the `template` attribute plus the `rules` array, in array
order. The `conditions` field is derived data and is **never serialized**. If
`processing.conditions` is inconsistent with the conditions reachable through `rules`
(different flattened count), emit a `severity: "warning"`
`responseProcessing.serialize.conditionsIgnored` diagnostic so hand-built models that
populated only `conditions` get an actionable signal instead of silently empty output.

**Output format.**

- Self-closing elements when there are no children (`<qti-response-processing/>`,
  `<qti-exit-response/>`).
- Deterministic two-space indentation; one element per line; no original-whitespace or
  attribute-order preservation.
- All attribute values and text content escaped via shared `xml.ts` helpers (lift
  `escapeXmlText` / `escapeXmlAttribute` out of `parser-custom-interactions.ts`).
- Fixed, hard-coded attribute order per element (e.g. `min`, `max`, `step`), except
  `customOperator`, which emits its `attributes` bag in sorted-key order.

**Rules.** Exhaustive switch over `QtiResponseRule`:

- `setOutcomeValue` → `<qti-set-outcome-value identifier=…>` + expression child
- `lookupOutcomeValue` → `<qti-lookup-outcome-value identifier=…>` + expression child
- `exitResponse` → `<qti-exit-response/>`
- `responseCondition` → `<qti-response-condition>` with `qti-response-if`
  (condition expression first, then `thenRules`), `qti-response-else-if` per `elseIfs`
  entry, and `qti-response-else` when `elseRules` is non-empty. A condition with no
  `ifExpression` is unserializable → `missingExpression` error.
- `responseProcessingFragment` → `<qti-response-processing-fragment>` + nested rules

**Expressions.** `serializeExpression()` is an exhaustive switch over every
`QtiProcessingExpression` variant with a compile-time `never` check — no partial support
list, no layering. Non-obvious mappings:

- `matchCorrect` → `<qti-match><qti-variable identifier=…/><qti-correct identifier=…/></qti-match>`
- `isNull` → `<qti-is-null><qti-variable identifier=…/></qti-is-null>`
- `numericCompare` → `qti-lt` / `qti-lte` / `qti-gt` / `qti-gte` by `operator`
- `durationCompare` → `qti-duration-lt` / `qti-duration-gte` by `operator`
- `random` → values directly under `<qti-random>` (canonical form; the optional
  `qti-multiple` wrapper from source XML is not reproduced)
- `baseValue` → text from `rawValue` when defined, else formatted scalar `value`;
  requires `baseType` and a scalar (or raw) value, else `invalidExpression` /
  `invalidAttribute` error
- `randomInteger` / `randomFloat` / `inside` → known attribute keys taken verbatim from the
  `attributes` bag when present (preserves template-variable references the typed numeric
  fields lost), else formatted from typed fields; coords joined with `","`
- `customOperator` → full `attributes` bag, sorted keys, plus expression children
- String-typed numeric fields (`anyN.min/max`, `repeat.numberRepeats`, `index.n`) verbatim

### Diagnostics

Error codes (cause `ok: false`, no XML):

- `responseProcessing.serialize.unsupportedRule`
- `responseProcessing.serialize.unsupportedExpression` (malformed runtime objects only —
  the type union is fully covered)
- `responseProcessing.serialize.missingExpression`
- `responseProcessing.serialize.invalidExpression`
- `responseProcessing.serialize.invalidAttribute`

Warning code (XML still produced):

- `responseProcessing.serialize.conditionsIgnored`

All diagnostics carry `severity` and the `source` from the offending rule/expression when
available. Collect all diagnostics in one pass rather than stopping at the first error.

### Test Plan

`packages/core/src/serializer-processing.test.ts`:

- Template-only `match_correct` → self-closing element with `template` attribute.
- Template attribute containing `&`, `<`, `"` is escaped (and text-content escaping for
  `baseValue` strings).
- Template **plus** inline rules serializes both.
- Empty model (`{ rules: [], conditions: [] }`) → `<qti-response-processing/>`, `ok: true`.
- Inline `setOutcomeValue` + `baseValue` (verifying `rawValue` is emitted verbatim).
- `responseCondition` with if / else-if / else branches; else omitted when `elseRules` empty.
- **No-duplication regression**: parsed XML with a `qti-response-condition` serializes the
  condition exactly once (rules-only emission).
- `responseProcessingFragment` with nested rules.
- `matchCorrect` round-trips through the `qti-match` element shape.
- `randomInteger` with template-reference `min` in the attributes bag is preserved verbatim.
- `customOperator` attribute emission is deterministic (sorted keys).
- Parser-synthesized fallback `baseValue` (`value: null`, no `baseType`) → `ok: false` with
  `invalidExpression`/`invalidAttribute` diagnostic, `xml: undefined`.
- Hand-built model with conditions only in `conditions` → empty-ish XML plus
  `conditionsIgnored` warning.
- Fixture round-trips: for each `packages/fixtures/xml/*-reference.xml` item with
  `qti-response-processing`, parse → serialize → parse and deep-compare the
  `responseProcessing` models with `source` stripped recursively.

Run before completion:

```text
pnpm vitest run packages/core/src/serializer-processing.test.ts packages/core/src/core.test.ts packages/core/src/server-scoring.test.ts
pnpm verify
```

### Implementation Notes

- Keep serialization out of `parser-processing.ts`; new module only.
- Internal helpers: `serializeResponseRule`, `serializeResponseCondition`,
  `serializeExpression`, plus a tiny element-tree printer (`{ name, attributes, children,
text }` → indented string). No generic XML builder, no new dependencies.
- Keep `serializeExpression` free of response-processing-specific assumptions so a future
  template-processing serializer can reuse it (mirroring how the parser shares
  `parseExpression`).
- Lift `escapeXmlText` / `escapeXmlAttribute` into `xml.ts`; update
  `parser-custom-interactions.ts` to import them.

### Non-Goals

- Lossless source XML preservation (comments, whitespace, namespace prefixes, attribute
  order, the `qti-multiple` wrapper under `qti-random`).
- Serializing the derived `conditions` field.
- `template-location` attribute support (not in the model).
- Template-processing (`qti-template-processing`) serialization — design for reuse only.
- Full assessment item serialization.
- Adding a `serialize` capability flag to the `support.ts` element registry.

### Acceptance Criteria

- `serializeResponseProcessing()` and the listed model types are exported from core
  (`check:exports` passes).
- Every `QtiResponseRule` and `QtiProcessingExpression` variant serializes (compile-time
  exhaustive), or returns a typed error diagnostic for runtime-invalid shapes.
- Parsed models serialize each response condition exactly once, preserving rule order.
- Fixture-driven parse → serialize → parse round-trips compare equal modulo `source`.
- `pnpm verify` passes.
