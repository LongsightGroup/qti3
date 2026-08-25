# Plan 015: Validate numeric-operator arity and define empty stats results

> Confirm each behavior against QTI 3.0.1 before editing and update the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/validation-processing.ts packages/core/src/processing-evaluator-numeric.ts packages/core/src/processing-operators.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: conformance bug
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

QTI numeric aggregates require one or more child expressions, while `statsOperator` requires one
container expression. The parser currently permits empty operator nodes, letting JavaScript reduce
identities (`sum=0`, `product=1`) masquerade as authored QTI semantics. An empty numeric container
also currently yields zero for mean/variance/SD without an explicit conformance decision.

## Required reference and scope

Use the official QTI 3.0.1 ASI Information Model, sections for `qti-sum`, `qti-product`, `qti-min`,
`qti-max`, and `qti-stats-operator`. In scope: arity diagnostics, defensive evaluator results, and
focused tests. Out of scope: non-empty math.

## Steps

1. Add validation diagnostics for zero children on 1-to-many numeric operators and anything other
   than one child for stats.
2. Make defensively evaluated invalid-arity nodes return `null`, not identity values.
3. Record the information-model result for an empty-but-valid stats container. If the spec is
   silent, return `null` and document that conservative choice in support notes.
4. Test missing children, NULL operands, empty containers, and normal non-empty values separately.

## Verification and done criteria

- Spec links and the empty-container decision appear in code/support notes.
- `pnpm test && pnpm test:conformance && pnpm verify` exit 0.

## STOP conditions

Stop if a conformance fixture relies on identity behavior; report old/new outcomes without changing
the fixture.
