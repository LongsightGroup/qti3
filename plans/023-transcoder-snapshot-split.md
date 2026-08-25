# Plan 023: Split transcoder snapshots without reducing output coverage

> Preserve every existing case and full-output assertion. Update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/transcoder/src/transcoder.test.ts packages/transcoder/src/__snapshots__`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

The 176 profile/interaction cases and 176 normalized full-output snapshots now live in eight
profile-owned test/snapshot files. A shared helper adds explicit profile, aggregate fidelity,
interaction-report, scoring-disposition, and unexpected-error assertions before every full-output
snapshot. Mechanical parsing compared all 176 before/after bodies byte-for-byte: no keys or output
changed. Focused transcoder checks, all 176 support-evidence cases, and full verification pass.

## Why this matters

A single roughly 9,390-line snapshot makes unrelated profile changes appear in one review block.
The fix is to localize failures and diffs, not to discard full emitted-output coverage.

## Scope and steps

1. Inventory the exact current test-case count and snapshot keys; record the count before editing.
2. Split the parameterized monolith into stable per-profile/per-case test names. Each existing case
   must retain a normalized full-output snapshot or equivalent full-string golden assertion.
3. Add targeted structured assertions for profile ID, fidelity, scoring disposition, interaction
   report, and unexpected error diagnostics before each output assertion.
4. Regenerate snapshots once. Review the diff mechanically: no emitted XML may change during this
   tests-only plan. Organize snapshot files by test module/profile if Vitest supports that cleanly;
   otherwise stable individual keys in smaller test files are acceptable.

## Verification and done criteria

- Before/after case counts and full-output assertion counts are identical.
- No individual snapshot entry exceeds the size of its one case; no representative-subset deletion.
- `pnpm test -- transcoder && pnpm check:transcoder-support && pnpm verify` exit 0.
- Production source files and emitted expected XML are unchanged.

## STOP conditions

Stop if splitting keys causes unexplained output churn or if any former case lacks an equivalent full
output assertion.
