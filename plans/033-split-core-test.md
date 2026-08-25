# Plan 033: Split `core.test.ts` with stable support-evidence paths

## Status

TODO — P3, L effort.

## Why

`packages/core/src/core.test.ts` has become a multi-thousand-line suite spanning parsing,
sessions, response processing, template processing, operators, and mapping. Splitting it improves
ownership and reviewability, but support metadata stores test file paths as evidence. Those paths
must move atomically with the tests.

## Scope

- `packages/core/src/core.test.ts`
- New focused test files under `packages/core/src/`
- `packages/core/src/support-evidence.ts`
- Tests that validate support-evidence file paths

## Target files

- `core-parsing.test.ts`: parsing, declarations, validation, and diagnostics
- `core-session-state.test.ts`: session lifecycle, response state, serialization, and restore
- `processing-response.test.ts`: response rules, conditions, outcomes, feedback, and exit rules
- `processing-template.test.ts`: template rules, constraints, randomization, and materialization
- `processing-operators.test.ts`: expression/operator semantics not owned by mapping
- `processing-mapping.test.ts`: mapping, area mapping, lookup tables, points, and containers
- `core.test.ts`: only genuinely cross-cutting integration cases that do not fit one owner

## Implementation

1. Record the baseline test count and list every `describe` block in `core.test.ts` before moving
   code.
2. Add named file-path constants in `support-evidence.ts` for the target suites. Replace repeated
   string literals in support entries with the appropriate constant.
3. Move complete `describe` blocks, shared imports, and local fixtures into the target files.
   Prefer existing public/test helpers; do not move test-only helpers into runtime modules merely
   to share them.
4. Update each support-evidence entry in the same commit as its proving test. Do not use one broad
   file path as evidence for behavior proved elsewhere.
5. Run the support-matrix assertions and compare the final Vitest test count with baseline.

## Acceptance criteria

- Every baseline test still runs; no case is dropped, skipped, or weakened.
- No target test file exceeds 1,200 lines without a written reason in the plan completion note.
- Every support-evidence path exists and contains assertions for the referenced behavior.
- Production behavior and public API are unchanged.
- `pnpm verify` passes.

## Stop conditions

- Stop if a move requires production refactoring; record that coupling as a separate plan.
- Do not replace behavioral tests with snapshots to make the split easier.
