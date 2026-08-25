# Plan 009: Exact decimal rounding for roundTo/equalRounded

> **Executor instructions**: Follow step by step; honor STOP conditions. Update your
> status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 646dd16..HEAD -- packages/core/src/processing-operators.ts`
> Mismatch with excerpt → STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes boundary-case results)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

Decimal-place and significant-figure rounding now operate on the number's canonical decimal
digits and perform one final scientific-notation conversion, avoiding lossy scaled multiplication.
The functions document half-up/away-from-zero ties and preserve prior zero and non-finite behavior.
Boundary, carry, sign, magnitude, and excess-precision tests pass with the full unit, conformance,
and verification suites.

## Why this matters

`Math.round(value * factor) / factor` misrounds decimal boundaries because the multiply
itself loses precision: `0.615 * 100 === 61.49999999999999`, so `roundToDecimalPlaces(0.615, 2)`
returns `0.61`. Tolerance comparisons (`qti-round-to`, `qti-equal-rounded`) then disagree
with author intent at exactly the x.xx5 boundaries items are most likely to test.
Core has zero runtime dependencies, so the fix must be dependency-free.

## Current state

- `packages/core/src/processing-operators.ts:41-56`:

```ts
export function roundToDecimalPlaces(value: number, figures: number): number {
  const factor = 10 ** figures;
  return Math.round(value * factor) / factor;
}

export function roundToSignificantFigures(value: number, figures: number): number {
  if (value === 0 || figures <= 0) return 0;
  const factor = 10 ** (figures - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.round(value * factor) / factor;
}
```

Callers: `roundWithMode` in the same file; used by
`processing-evaluator-comparison.ts` (equalRounded) and the round-to evaluator.

## Commands you will need

| Purpose   | Command          | Expected on success |
| --------- | ---------------- | ------------------- |
| Typecheck | `pnpm typecheck` | exit 0              |
| Tests     | `pnpm test`      | all pass            |

## Scope

**In scope**:

- `packages/core/src/processing-operators.ts`
- A new or existing operator test file (`packages/core/src/processing-operators.test.ts` if absent, create it)

**Out of scope**:

- Any dependency addition (core must stay zero-dep — hard rule from AGENTS.md)
- Evaluator files (they consume these functions unchanged)
- Rounding MODE semantics (half-up stays half-up; only precision of the operation changes)

## Git workflow

- Branch: `advisor/009-exact-decimal-rounding`
- Commit style: short imperative

## Steps

### Step 1: Write golden boundary tests FIRST (characterization)

In a new/updated `processing-operators.test.ts`, pin desired behavior:
`roundToDecimalPlaces(0.615, 2) === 0.62`, `(1.005, 2) === 1.01`, `(2.675, 2) === 2.68`,
negative values (`-0.615, 2 → -0.62`), large magnitudes, and significant-figure cases
(`roundToSignificantFigures(0.0001234, 3)` etc.). These fail before the fix — that is
the point. Run them to confirm they fail for the multiply-precision reason.

**Verify**: `pnpm test -- processing-operators` → new tests FAIL with off-by-one-ulp values.

### Step 2: Implement string/exponent-based rounding without dependencies

Replace both functions with an approach that avoids the lossy intermediate multiply,
e.g.: convert via `Number.prototype.toExponential`, manipulate the digit string, and
parse back — or use `toFixed` with a correction step for the half-way case. Keep
signatures identical. Handle: negatives, zero, figures beyond float significance
(return input), and non-finite inputs (existing behavior).

**Verify**: `pnpm test -- processing-operators` → Step 1 goldens now PASS.

### Step 3: Sweep for regressions

Run full unit + conformance suites.

**Verify**: `pnpm test && pnpm test:conformance` → all pass. If any conformance fixture
changes outcome, STOP and report the item and old/new scores rather than adjusting fixtures silently.

## Test plan

- Golden set from Step 1 is the permanent regression net; add at least one case per
  function including significantFigures path.

## Done criteria

- [ ] Golden boundary tests exist and pass
- [ ] `grep -n "Math.round(value \* factor)" packages/core/src/processing-operators.ts` returns nothing
- [ ] `pnpm verify` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- A conformance/fixture outcome changes (scoring-visible change needs human review).
- The dependency-free implementation cannot handle some magnitude class correctly — report
  which instead of shipping a partial fix.

## Maintenance notes

Document the chosen half-up semantics in the function's JSDoc so future maintainers don't
"fix" it toward banker's rounding silently.
