# Plan 019: Move qti3-fixtures out of player runtime dependencies

> **Executor instructions**: Small mechanical plan. Update your status row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 646dd16..HEAD -- packages/player/package.json packages/player/src/player.test.ts packages/player/src/catalog-delivery.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: packaging / tech-debt
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

`@longsightgroup/qti3-fixtures` is now a player-only development dependency. The lockfile importer
and exact dependency-policy mirror were updated together; no package or version allowance changed.
Runtime source and packed-file review found no fixture-package import, and dependency, build,
exports, source-map, unit-test, and dry-run pack checks pass.

## Why this matters

Every consumer of the published player package installs the entire synthetic-fixture
corpus as a runtime dependency, though only two test files import it. This contradicts
the project's deliberate-dependency posture and bloats installs.

## Current state

- `packages/player/package.json:50-53`:

```json
"dependencies": {
  "@longsightgroup/qti3-core": "workspace:*",
  "@longsightgroup/qti3-fixtures": "workspace:*"
}
```

- Fixture imports exist only in test files:
  - `packages/player/src/player.test.ts:1`
  - `packages/player/src/catalog-delivery.test.ts:3`

## Commands you will need

| Purpose       | Command                                               | Expected on success      |
| ------------- | ----------------------------------------------------- | ------------------------ |
| Deps check    | `pnpm check:deps`                                     | exit 0                   |
| Install       | `pnpm install`                                        | exit 0, lockfile updated |
| Build+exports | `pnpm build && pnpm check:exports && pnpm check:maps` | exit 0                   |
| Tests         | `pnpm test`                                           | all pass                 |

## Scope

**In scope**:

- `packages/player/package.json`
- `pnpm-lock.yaml` (via pnpm install)

**Out of scope**:

- Any source file
- Other packages' manifests

## Git workflow

- Branch: `advisor/019-player-fixtures-dev-dep`
- Commit style: short imperative

## Steps

### Step 1: Confirm no runtime imports

`grep -rn "qti3-fixtures" packages/player/src --include="*.ts" | grep -v ".test.ts"`
→ expect no output. If output appears, STOP and report the import site.

### Step 2: Move the dependency

In `packages/player/package.json`, remove `@longsightgroup/qti3-fixtures` from
`dependencies`; add a `devDependencies` block containing it at the same version spec
(`workspace:*`).

**Verify**: `pnpm install` → exit 0; lockfile shows the move.

### Step 3: Validate gates

`pnpm check:deps && pnpm build && pnpm check:exports && pnpm check:maps && pnpm test`
→ all exit 0.

## Test plan

Existing suites suffice; workspace resolution keeps dev-time behavior identical.

## Done criteria

- [ ] fixtures listed only under devDependencies in packages/player/package.json
- [ ] All gates above exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Runtime (non-test) imports found in Step 1.
- `check:deps` policy rejects devDependency placement (read scripts/check-dependencies.mjs
  message carefully before concluding).

## Maintenance notes

When publishing, confirm npm dry-run pack contents don't reference fixtures
(`pnpm pack --dry-run` from packages/player is a good reviewer check).
