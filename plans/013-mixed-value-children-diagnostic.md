# Plan 013: Diagnose mixed fielded and unfielded declaration values

> Run the drift check first and update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/parser.ts packages/core/src/parser-declarations.ts packages/core/src/parser-item-metadata.ts`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

Declaration parsers now receive the existing parse diagnostic array and emit one sourced
`declaration.value.fieldIdentifier.mixed` error for each value container that mixes fielded and
unfielded children. The parser preserves the prior record-only defensive fallback. Public-boundary
tests cover response correct/default, mapping-bearing response, outcome/template defaults, exact
paths, and unchanged scalar/container/record behavior; parser and full verification pass.

## Why this matters

When a correct/default value mixes field-identified and plain `qti-value` children,
`parseVariableValue` silently discards the plain values. The malformed shape must remain visible as
an authoring diagnostic rather than silently changing the value used by scoring.

## Scope and implementation

Change `parseResponseDeclaration`, `parseOutcomeDeclaration`, and `parseTemplateDeclaration` to
accept the parser diagnostic array, following the explicit diagnostic-parameter pattern in
`parser-item-metadata.ts`. Thread that array from `parseAssessmentItem`. In `parseVariableValue`,
when some but not all children have `field-identifier`, push one dot-case error diagnostic with the
value container's source and retain the current record-only fallback so the runtime shape remains
stable. Do not change all-fielded or all-unfielded behavior.

Add parser tests covering mixed values in correct, default, and mapped declaration contexts, plus
unchanged scalar/container/record happy paths.

## Verification and done criteria

- `pnpm test -- parser && pnpm verify` exit 0.
- Mixed values produce exactly one diagnostic per malformed container with a source path.
- No public type changes and no thrown normal parse errors.

## STOP conditions

Stop if diagnostic threading requires a public declaration-parser signature relied on outside core;
report callers and propose a private wrapper instead.
