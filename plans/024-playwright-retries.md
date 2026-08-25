# Plan 024: Capture actionable Playwright failure artifacts with one CI retry

> Coordinate with any CI workflow edits and update the plan index.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- playwright.config.ts .github/workflows/ci.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

`trace: "on-first-retry"` is dead while retries are zero, and CI does not upload Playwright output.
A retry without retained artifacts can mask a flake; the goal is one diagnostic retry plus artifacts
that reviewers can inspect.

## Scope and steps

1. Set `retries: process.env.CI ? 1 : 0`. Keep local runs deterministic and keep the worker count.
2. Retain trace/video/screenshot data needed to inspect the first failure and retry result, using
   Playwright-supported settings that do not collect heavy artifacts for passing first attempts.
3. Add `actions/upload-artifact` to `.github/workflows/ci.yml` with `if: failure()` and
   `if-no-files-found: ignore`, uploading `playwright-report/` and `test-results/` under a short
   retention period.
4. Verify config listing and run a real focused Chromium suite selected by an existing spec path,
   e.g. `pnpm exec playwright test tests/browser/player-dom-behavior.spec.ts --project=chromium`.

## Verification and done criteria

- `pnpm exec playwright test --list` exits 0.
- Focused Chromium test passes locally; CI config contains one retry and failure-only artifact upload.
- A reviewer can force a temporary failure on a scratch branch and download its trace; remove that
  temporary change before completion.

## STOP conditions

Stop if the chosen trace mode omits first-attempt evidence or artifacts could contain private
external fixtures; restrict paths rather than uploading broadly.
