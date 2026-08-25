# Plan 007: Map every matching area at most once across response points

> This is scoring-visible. Confirm the cited QTI rule before editing and update the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/processing-mapping.ts packages/core/src/core.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

`scoreAreaMapping` currently uses `.find` for each point, so only the first overlapping area is
counted. It also counts the same area repeatedly when multiple response points fall inside it. QTI
3.0.1 says points are tested against each area in turn and, for containers, each area can be mapped
once only.

## Required reference

Read section 2.11.1.6 of the official QTI 3.0.1 ASI Information Model:
`https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html`.
Record the short rule and URL in the PR description; do not copy a long excerpt.

## Scope and steps

Only change `scoreAreaMapping` and focused tests. For a container response, keep a set of matched
area-entry indexes. Test every point against every area; add a mapped value only the first time that
area matches any point. Apply `defaultValue` once for a point that matches no area. Preserve final
lower/upper-bound clamping and malformed-point behavior.

Add tests for: one point in two overlapping areas; two points in the same area; two points in
different areas; an unmatched point; and a mixture of matched/unmatched points.

## Verification and done criteria

- `pnpm test && pnpm test:conformance && pnpm verify` exit 0.
- An overlapping point sums all matching entries; repeated points do not remap an area.

## STOP conditions

Stop if conformance fixtures encode a different result; report item identifiers and old/new scores
without rewriting expectations.
