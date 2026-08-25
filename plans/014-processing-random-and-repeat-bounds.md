# Plan 014: Bound repeat expansion in processing

> Run the drift check first. Do not duplicate existing random-expression validation.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/processing-evaluator-collection.ts packages/core/src/validation-processing.ts packages/core/src/session.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security / availability
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

Random integer/float attributes are already validated for presence, numeric form, step, and bound
order. The remaining gap is `qti-repeat`: a literal or variable-sourced count can expand without a
runtime limit and block or exhaust Node/browser processing.

## Scope and implementation

In scope: a named processing limit, repeat validation/evaluation, tests, and support notes. Out of
scope: changing RNG behavior or inventing an evaluator logging channel.

1. Add a documented constant for the maximum produced repeat elements, not merely loop count.
2. At validation time, reject a literal negative/non-integer count and diagnose a literal whose
   projected minimum expansion already exceeds the cap.
3. At evaluation time, calculate projected growth before allocating. Return `null` when the count
   is invalid or the cap would be exceeded. Do not partially construct a container.
4. Because evaluator functions currently have no diagnostic channel, document `null` as the
   defensive runtime result; do not add console logging. A future session-runtime diagnostic design
   may add observability separately.

## Verification and done criteria

- Tests cover literal and variable counts, count × child expansion, exact cap, cap+1, and completion
  under one second.
- `pnpm verify` exits 0.

## STOP conditions

Stop if a published synthetic fixture exceeds the proposed cap or if static projection is impossible
without evaluating child expressions twice; adjust the algorithm, not the safety boundary.
