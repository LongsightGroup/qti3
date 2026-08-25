> **SUPERSEDED — do not implement.** The serialization rule in this plan is wrong and would fail
> its own round-trip test. See
> [issue-12-response-processing-serialization-revised.md](./issue-12-response-processing-serialization-revised.md)
> for the authoritative design (delivered).

# Issue 12: Structured Response Processing Serialization Plan

## Summary

Add deterministic, spec-compliant XML serialization for supported `QtiResponseProcessing` models.

This is not raw XML preservation. qti3-core should serialize only from the structured public model it parses, validates, and processes. Unsupported or incomplete model shapes should return typed diagnostics and no XML.

## Use Case

A conformant authoring tool or migration pipeline creates or edits scoring logic through qti3-core's structured model, then exports a QTI item package. It needs qti3-core to emit valid `qti-response-processing` XML for supported scoring templates, rules, conditions, and expressions without hand-building XML or copying unvalidated source fragments.

Example template model:

```ts
const processing: QtiResponseProcessing = {
  template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
  rules: [],
  conditions: [],
};
```

Expected XML:

```xml
<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
```

Example inline model:

```ts
const processing: QtiResponseProcessing = {
  rules: [
    {
      type: "setOutcomeValue",
      identifier: "SCORE",
      expression: {
        type: "baseValue",
        baseType: "float",
        value: 1,
      },
    },
  ],
  conditions: [],
};
```

Expected XML:

```xml
<qti-response-processing>
  <qti-set-outcome-value identifier="SCORE">
    <qti-base-value base-type="float">1</qti-base-value>
  </qti-set-outcome-value>
</qti-response-processing>
```

## Public API

Add a new serializer API from `@longsightgroup/qti3-core`:

```ts
export interface QtiSerializeResponseProcessingResult {
  ok: boolean;
  xml?: string | undefined;
  diagnostics: QtiDiagnostic[];
}

export function serializeResponseProcessing(
  processing: QtiResponseProcessing,
): QtiSerializeResponseProcessingResult;
```

Recommended implementation file:

```text
packages/core/src/response-processing-serializer.ts
```

Export the function and result type from `packages/core/src/index.ts`.

## Serialization Behavior

- Emit a self-closing `qti-response-processing` element for template-only processing with no rules or conditions.
- Emit `template` as an escaped XML attribute when present.
- Emit child rules before child conditions, matching the current structured model fields.
- Use deterministic two-space indentation for nested XML.
- Escape attribute values and text content.
- Return `{ ok: false, diagnostics, xml: undefined }` if any rule or expression cannot be serialized safely.

Supported response rules for the first implementation:

- `setOutcomeValue`
- `lookupOutcomeValue`
- `exitResponse`
- `responseCondition`
- `responseProcessingFragment`

Supported condition structure:

- `qti-response-condition`
- `qti-response-if`
- `qti-response-else-if`
- `qti-response-else`

Supported expressions should initially match the expressions already modeled and exercised by parser/session tests, including:

- `baseValue`
- `null`
- `variable`
- `correct`
- `default`
- `mapResponse`
- `mapResponsePoint`
- `isNull`
- `matchCorrect`
- `match`
- boolean operators: `and`, `or`, `not`, `anyN`
- comparison/string operators: `equal`, `equalRounded`, `numericCompare`, `durationCompare`, `stringMatch`, `substring`, `patternMatch`
- container operators: `multiple`, `ordered`, `containerSize`, `index`, `member`, `contains`, `delete`, `fieldValue`
- numeric/math operators currently modeled by `QtiProcessingExpression`, including `sum`, `product`, `min`, `max`, `subtract`, `divide`, `power`, integer operations, rounding, random, `mathConstant`, `mathOperator`, `repeat`, `statsOperator`, `inside`, and `customOperator`

If this list is too large for a first patch, implement it in layers but make unsupported expression diagnostics explicit and tested.

## Diagnostics

Use typed diagnostics instead of throwing for normal serialization failures.

Suggested diagnostic codes:

- `responseProcessing.serialize.unsupportedRule`
- `responseProcessing.serialize.unsupportedExpression`
- `responseProcessing.serialize.missingExpression`
- `responseProcessing.serialize.invalidExpression`
- `responseProcessing.serialize.invalidAttribute`

Diagnostics should include `severity: "error"` and use the source location from the rule/expression when available.

## Test Plan

Add focused tests in:

```text
packages/core/src/response-processing-serializer.test.ts
```

Required test cases:

- Template-only `match_correct` serializes to a self-closing `qti-response-processing` element.
- Template-only `map_response` serializes with escaped attributes.
- Inline `setOutcomeValue` with `baseValue` serializes correctly.
- `responseCondition` serializes `response-if`, `response-else-if`, and `response-else` branches.
- `responseProcessingFragment` serializes nested rules.
- XML escaping covers text and attribute values.
- Parse -> serialize -> parse preserves the structured response-processing model for representative supported examples.
- Unsupported or incomplete rule/expression returns `ok: false`, no XML, and typed diagnostics.

Run before completion:

```text
pnpm vitest run packages/core/src/response-processing-serializer.test.ts packages/core/src/core.test.ts packages/core/src/server-scoring.test.ts
pnpm verify
```

## Implementation Notes

- Keep serialization separate from parsing. Do not add serializer logic to `parser-processing.ts`.
- Prefer small internal helpers:
  - `serializeResponseRule`
  - `serializeResponseCondition`
  - `serializeExpression`
  - `xmlElement`
  - `xmlAttribute`
  - `xmlText`
- Avoid a generic magical XML builder unless it materially reduces complexity. A small local element helper is enough.
- Keep output deterministic; do not preserve original whitespace or attribute order from imported XML.
- Do not add dependencies.

## Non-Goals

- Lossless source XML preservation.
- Copying raw `qti-response-processing` XML from imported items.
- Preserving comments, original whitespace, namespace prefixes, or original attribute order.
- Serializing unsupported processing constructs without first adding structured model support.
- Full assessment item serialization.

## Acceptance Criteria

- `serializeResponseProcessing()` is exported from core.
- Supported template and inline response-processing models serialize to valid QTI XML.
- Unsupported or incomplete processing returns typed diagnostics and no XML.
- Round-trip tests prove supported parse -> serialize -> parse behavior.
- `pnpm verify` passes.
