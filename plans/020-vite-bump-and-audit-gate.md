# Plan 020: Upgrade the vulnerable Vite toolchain and gate dev advisories

> Resolve current versions at execution time, run the full audit, and update the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- package.json pnpm-lock.yaml .github/workflows/ci.yml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dependency security
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

Vite is pinned to 8.2.1 in both direct importers. Version 8.2.2 was current but only five days
old, so the repository's seven-day `minimumReleaseAge` policy correctly rejected it. The lockfile
and exact dependency policy now contain the reviewed 8.2.1 transitive tree, CI audits all
dependencies at high severity, and the full verification, Playwright, audit, and Pages build gates
pass.

## Why this matters

`vite@8.0.12` is affected by advisories fixed in 8.0.16, and its locked PostCSS/Nanoid tree also
contains high-severity advisories. These are development/build dependencies, so a production-only
audit gate would not prevent recurrence.

## Scope and steps

In scope: both direct Vite pins in the root and manual-example manifests, their lockfile and exact
dependency-policy resolution, and one CI audit step. Out of scope: unrelated upgrades and runtime
dependency-policy changes.

1. Record `pnpm view vite version`, then pin the current compatible Vite 8.x release exactly; it
   must be at least 8.0.16. Run `pnpm install`.
2. Run `pnpm audit --json`. The Vite, PostCSS, and Nanoid high/critical findings must be gone. Do
   not suppress advisories or add lockfile overrides unless the direct Vite upgrade cannot resolve
   them; report that case.
3. Add `pnpm audit --audit-level high` to CI after frozen install. Do not use `--prod`, because the
   finding being fixed is in the dev toolchain.
4. Run the full local and browser gates plus `pnpm pages:build`.

## Verification and done criteria

- `pnpm audit --audit-level high` exits 0.
- `pnpm verify && pnpm test:browser && pnpm pages:build` exit 0.
- Vite remains exact and aligned in both direct importers, and no unrelated dependency is changed
  intentionally.

## STOP conditions

Stop if current Vite 8.x remains vulnerable, requires a Node engine above the repository target, or
causes semantic browser/build failures.
