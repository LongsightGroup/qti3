# Plan 005: Add player session options and preserve them across lifecycle rebuilds

> Run the drift check first. This is an additive public API change; update docs and the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/player/src/player-types.ts packages/player/src/player-element.ts packages/core/src/session.ts tests/browser/player-lifecycle.spec.ts README.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature / bug-prevention
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

Core supports `QtiItemSessionOptions` such as `randomSeed`, `customOperators`, and allowed
undeclared response identifiers, but `QtiPlayerLoadOptions` exposes none of them and the player
always calls `createItemSession` without its third argument. Hosts therefore cannot use those core
capabilities through the native player. Once exposed, reset and restore must retain the same
options instead of silently changing processing behavior.

## Scope

In scope: `QtiPlayerLoadOptions.sessionOptions`, `LoadedPlayerItem`, all three player session
construction sites, public type exports, README API example, and lifecycle browser tests. Out of
scope: changing `QtiItemSessionOptions`, serializing functions/registries into attempt JSON, or
adding player-specific operator behavior.

## Steps

1. Import and expose `QtiItemSessionOptions` as optional `sessionOptions` on
   `QtiPlayerLoadOptions`; document that attempt JSON does not contain these host capabilities.
2. Pass it as the third argument during initial load and retain the exact options object on
   `LoadedPlayerItem`. Use it again in `reset()` and `restore()`.
3. Add browser lifecycle tests proving a seeded template remains deterministic after reset and a
   custom operator still works after restore. Add a README example.

## Verification and done criteria

- All `createItemSession` calls in `player-element.ts` pass the retained options.
- `pnpm verify && pnpm test:browser -- player-lifecycle` exit 0.
- Existing call sites compile unchanged because the field is optional.

## STOP conditions

Stop if preserving a mutable operator registry by reference conflicts with an existing immutability
contract; report whether a shallow snapshot or documented reference semantics is appropriate.
