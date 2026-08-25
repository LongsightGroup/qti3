# Plan 028: Add an EditorConfig matching repository formatting

## Status

TODO — P3, S effort.

## Why

The repository has automated formatting but no editor-neutral defaults for line endings,
indentation, trailing whitespace, or final newlines. Adding those defaults prevents avoidable
churn before oxfmt runs.

## Scope

- `.editorconfig` (new)
- Formatting documentation only if it lists editor setup

## Implementation

1. Add a root `.editorconfig` with UTF-8, LF, final newline, trailing-whitespace trimming,
   spaces, and two-space indentation for the repository's text formats.
2. Add file-type exceptions only when an existing tracked file requires one (for example,
   tab-indented Makefiles). Do not invent language-specific style that conflicts with oxfmt.
3. Run `pnpm format:check` and inspect `git diff --check`; adding the config must not mechanically
   rewrite unrelated files.

## Acceptance criteria

- Common editors receive defaults consistent with the checked-in files and oxfmt.
- `pnpm format:check` and `git diff --check` pass.
- No source files change as a side effect of this plan.

## Out of scope

Adding `pnpm typecheck` to the pre-commit hook is rejected here: it changes commit latency and
needs separate timing and developer-workflow evidence.
