# Plan 026: Remove duplicate stages from `pnpm verify`

## Status

TODO — P2, S effort. Depends on plan 020 only if both edit `package.json`.

## Why

The root `test` script already runs the full Vitest project. The later `test:conformance` and
`test:a11y` stages in `verify` rerun subsets that have just passed. This adds time without adding
coverage. Browser caching and job parallelization are separate CI design decisions and are not
part of this plan.

## Scope

- `package.json`
- Documentation that explicitly reproduces the old `verify` command, if any

## Implementation

1. Record a clean baseline for `pnpm verify`, including the Vitest test count and elapsed time.
2. Remove `pnpm test:conformance` and `pnpm test:a11y` from `verify`. Keep both named scripts for
   focused local use.
3. Confirm that `release:check` and `certification:check` still reach all their current gates
   through `verify`; do not reorder unrelated stages.
4. Run the revised command and confirm the Vitest test count is unchanged and each test executes
   once.

## Acceptance criteria

- `pnpm verify` contains one full Vitest run, not a full run followed by two subset reruns.
- `test:conformance` and `test:a11y` remain available.
- `pnpm verify` passes with the same test count as the baseline.

## Stop conditions

- Stop if Vitest configuration excludes either package from `pnpm test`; document the exclusion
  and retain the needed explicit stage.
- Do not add Playwright caching or split the workflow into parallel jobs under this plan.
