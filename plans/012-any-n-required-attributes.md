# Plan 012: Require qti-any-n min/max attributes with validation

> **Executor instructions**: Follow step by step; honor STOP conditions. Update your
> status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 646dd16..HEAD -- packages/core/src/processing-evaluator-boolean.ts packages/core/src/parser-processing.ts`
> Mismatch with excerpts → STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

The QTI information model gives `min` and `max` multiplicity [1] (required, no default)
for `qti-any-n`. Today a missing attribute silently evaluates as 0, forcing the condition
false (`trueCount > max=0`). Malformed items should produce diagnostics, not silent else-branches.

## Current state

- `packages/core/src/processing-evaluator-boolean.ts:23-27`:

```ts
case "anyN": {
  const min = context.indexValue(expression.min) ?? 0;
  const max = context.indexValue(expression.max) ?? 0;
```

- The parser stores raw strings for min/max (see the `anyN` branch of
  `packages/core/src/parser-processing.ts`; locate via
  `grep -n "anyN\|any-n" packages/core/src/parser-processing.ts`).
- Exemplar guard: the `qti-round-to` branch in the same parser validates attributes
  and falls through to diagnostics.

## Commands you will need

| Purpose | Command     | Expected on success |
| ------- | ----------- | ------------------- |
| Tests   | `pnpm test` | all pass            |

## Scope

**In scope**:

- `packages/core/src/parser-processing.ts` (anyN branch only)
- Related test file

**Out of scope**:

- Evaluator fallback behavior (keep `?? 0` as defensive default)
- Other boolean operators

## Git workflow

- Branch: `advisor/012-any-n-required-attrs`
- Commit style: short imperative

## Steps

### Step 1: Validate presence and integer-ness at parse time

In the anyN branch: require both attributes present and integer-valued (allowing them
to be variable references if the model supports indexValue over variables — inspect how
min/max are typed and consumed; validate accordingly). On violation, follow the same
diagnostic fall-through used by round-to.

**Verify**: `pnpm typecheck && pnpm test` → pass.

### Step 2: Tests

Missing min → diagnostic; missing max → diagnostic; non-integer → diagnostic;
valid literal and valid variable-reference forms still parse.

**Verify**: new tests pass.

## Test plan

- Add to the processing parse test file used by neighboring expression tests
  (`grep -rln "round-to" packages/core/src --include="*.test.ts"` shows the file).

## Done criteria

- [ ] Diagnostic tests pass for missing/invalid min and max
- [ ] `pnpm verify` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- min/max turn out to be legitimately optional per spec text — record the quote and mark REJECTED.

## Maintenance notes

None beyond noting the validator alongside other required-attribute checks.
