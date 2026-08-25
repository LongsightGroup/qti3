# Plan 003: Make invalid equal-rounded expressions inert during evaluation

> Run the drift check first. Stop on mismatched excerpts or out-of-scope changes. Update
> `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/validation-processing.ts packages/core/src/processing-evaluator-comparison.ts packages/core/src/core.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

Validation already emits `processing.roundingMode` and `processing.roundingFigures` for malformed
`qti-equal-rounded`. However, `parseQtiXml` still returns a document alongside validation errors,
and a core caller can pass that document to `createItemSession`. With `figures=0` and significant
figures, both operands become zero and an invalid expression can award credit.

## Current state and conventions

- `packages/core/src/validation-processing.ts` calls `validateRounding` for `equalRounded`.
- `packages/core/src/processing-evaluator-comparison.ts` evaluates the parsed expression without
  defensively checking the mode/figures domain.
- Normal invalid processing returns `null`; it does not throw.

## Scope

In scope: the `equalRounded` evaluator branch and focused tests in `packages/core/src/core.test.ts`
or a dedicated comparison-evaluator test. Out of scope: changing diagnostic codes, parsed model
types, or `qti-round-to`.

## Steps

1. Add a regression test that parses invalid equal-rounded XML, confirms the existing diagnostic,
   deliberately creates a session from the returned document, and proves the condition cannot
   award credit.
2. Before rounding, require a supported mode, integer figures, decimal places `>=0`, and
   significant figures `>0`. Return `null` otherwise.
3. Add valid decimal-place and significant-figure regression cases.

## Verification and done criteria

- `pnpm test -- core` passes, including the invalid-document defensive test.
- `pnpm verify` exits 0.
- No new or duplicate rounding diagnostic is introduced.

## STOP conditions

Stop if direct session creation from a document with diagnostics is intentionally prohibited by a
documented public contract; in that case propose enforcing that boundary centrally.
