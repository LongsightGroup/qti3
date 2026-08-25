# Plan 018: Mark modal feedback as rendered in the support matrix

> Keep this plan narrow and update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/support.ts packages/core/src/types.ts packages/core/src/support-registry.test.ts tests/browser/player-feedback.spec.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: conformance evidence
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

The support registry now marks `qti-modal-feedback` rendered and records its parsing, validation,
outcome-processing dependency, and player rendering flags. Registry tests require direct browser
evidence for every rendered item-metadata entry. CLI support checks, full verification, and the
feedback browser suite pass.

## Why this matters

`qti-modal-feedback` is marked `support: "parsed"` and `render: false` even though its notes and
browser evidence say the player renders outcome-gated modal feedback. The existing support-status
vocabulary already contains `rendered`; no new tier is needed.

## Scope and steps

Only update the modal-feedback entry and registry consistency tests. Set its support level and flags
to reflect demonstrated parsing, validation, processing dependency, and player rendering. Cite
`tests/browser/player-feedback.spec.ts` directly. Extend the registry test so an item-metadata entry
claiming `render: true` must cite browser evidence.

Do not promote catalog or companion-material entries merely because hosts can inspect their parsed
models, and do not add a `renderedHostMediated` status.

## Verification and done criteria

- `pnpm build && node packages/cli/dist/index.js support-matrix` reports modal feedback truthfully.
- `node packages/cli/dist/index.js assert-support`, `pnpm test`, and the feedback browser suite pass.

## STOP conditions

Stop if the matrix contract distinguishes feedback processing from outcome-gated visibility in a way
that requires a new public schema; report that design issue separately.
