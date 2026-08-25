# Plan 008: Keep invalid declaration numbers out of the parsed runtime model

> Preserve existing diagnostics and update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/parser-declarations.ts packages/core/src/validation.ts packages/core/src/value-format.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

Validation already diagnoses malformed mapping, area-mapping, bounds, and lookup-table numbers, but
the parser stores bare `Number(...)` results in the returned document. Because a document is
returned alongside validation errors, a caller that continues can receive `NaN` in scoring state
and fail later during serialization with an unrelated error.

## Scope

In scope: numeric parsing in `parser-declarations.ts`, existing validation regression tests, and
direct-session tests using a returned invalid document. Out of scope: candidate response coercion,
public model type changes, or duplicate diagnostics.

## Steps

1. Inventory each declaration-side `Number(...)` and its spec/default behavior. Add a private
   finite-number parser returning `undefined` for invalid text.
2. Retain raw attributes so existing validation codes remain authoritative. Populate the runtime
   model with a safe spec default where one exists; skip an invalid entry where no meaningful
   runtime value exists. Never retain `NaN` or infinity.
3. Add tests for malformed/missing mapping defaults, mapped values, area mapped values, and lookup
   source values. Each must retain the existing authoring diagnostic and leave the document free of
   non-finite numbers.

## Verification and done criteria

- A recursive test assertion finds no non-finite numeric model value after parsing malformed XML.
- `pnpm verify` exits 0 and valid fixtures produce no new diagnostics.

## STOP conditions

Stop if the QTI default for a missing attribute is ambiguous or skipping an invalid entry changes a
publicly documented model-shape guarantee; report the exact attribute before choosing a fallback.
