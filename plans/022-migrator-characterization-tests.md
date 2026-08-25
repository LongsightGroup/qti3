# Plan 022: Add characterization tests to the highest-risk migrator seams

> Tests only: do not fix source behavior discovered by characterization. Update the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/migrator/src`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

Migrator has three broad test files for roughly three dozen modules and recent vendor fixes have
crossed classification, interaction mapping, and repair policy. Focused tests will make the next
legacy-QTI regression local instead of relying only on end-to-end output.

## Fixed targets

1. `qti12-classify.ts`: essay/response-string classification, Canvas-flavored matching, unknown
   interaction fallback, and confidence/reason metadata.
2. `repair-policy.ts`: strict vs repair behavior, diagnostic/fidelity assembly, and unsupported
   feature preservation.
3. The QTI 2 interaction mapper module used for choice/match/text-entry conversion: locate its exact
   current filename from the imports in `index.ts`; cover those three public mapper branches. If it
   has no exported seam, test it through the smallest exported orchestrator with one synthetic item
   per branch—do not choose a different target.

## Scope and steps

Create one sibling test file per target using synthetic MIT-licensed inline XML/data. Pin current
outputs and diagnostics, including source-format metadata and loss/repair disposition. Add at least
three meaningful cases per target; do not assert entire giant XML blobs when structured fields are
available. If a result appears incorrect, document it under a `Discovered findings` section in the
PR/plan status and leave source unchanged.

## Verification and done criteria

- `pnpm test -- migrator && pnpm verify` exit 0.
- Diff contains tests only; no snapshots over 300 lines and no private/customer fixtures.

## STOP conditions

Stop if the third target cannot be reached without production refactoring; report the missing test
seam rather than substituting easier coverage.
