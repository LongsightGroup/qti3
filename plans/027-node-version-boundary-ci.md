# Plan 027: Test the supported Node version boundaries explicitly

## Status

TODO — P3, S effort.

## Why

The package contract is Node `>=22`. CI currently verifies Node 22, while publishing and Pages
use Node 24. That split is reasonable, but it is implicit: the minimum version is tested and the
release version is exercised only in release-oriented workflows. The goal is to make both roles
intentional, not to force every workflow onto one version.

## Scope

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/pages.yml`
- `package.json` only if the documented engine range is found to be inaccurate

## Implementation

1. Keep Node 22 as the minimum-supported job and run the full `pnpm verify` gate there.
2. Add a Node 24 compatibility job that installs with the frozen lockfile, then runs
   `pnpm typecheck`, `pnpm test`, and `pnpm build`. Avoid duplicating the browser matrix.
3. Name both jobs by purpose (`minimum-node` and `current-node`) so their different versions are
   visible in branch protection and logs.
4. Add short workflow comments explaining why publish/Pages remain on Node 24.

## Acceptance criteria

- Every pull request tests both the declared minimum Node 22 and Node 24.
- Only one CI job installs and runs the Playwright browser matrix.
- Publish and Pages retain Node 24 unless their runtime requirements prove otherwise.
- `package.json` continues to declare `node >=22`.

## Stop conditions

- Stop before changing the engine range if Node 22 fails; report the concrete incompatibility as
  a separate compatibility decision.
