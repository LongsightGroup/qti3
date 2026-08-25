# Plan 032: Reuse core package-path normalization in the CLI

## Status

TODO — P3, S effort.

## Why

The CLI duplicates core's package-relative path normalization. The broader package inspection
code is not a clean duplicate: it has CLI-specific reporting and archive traversal behavior.
This plan centralizes only the shared security policy and leaves those workflows intact.

## Scope

- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- Core exports only if `normalizePackagePath` is not already public

## Implementation

1. Import core's `normalizePackagePath` into the CLI and remove the duplicated normalization
   algorithm.
2. Add a small CLI adapter that supplies a diagnostics array and converts a failed normalization
   into the CLI's existing error/reporting control flow. Preserve externally visible messages and
   exit behavior unless a test demonstrates they are currently inconsistent.
3. Route all existing CLI callers of the local function through that adapter.
4. Add CLI regression cases for absolute paths, URI-like paths, root escapes, dot segments,
   repeated separators, and valid relative paths.

## Acceptance criteria

- Core is the single implementation of package-relative path normalization.
- CLI package inspection rejects the same unsafe paths and accepts the same safe paths as before.
- Existing CLI JSON/report shapes and exit codes remain stable.
- No manifest walker or resource-selection logic is moved into core.

## Stop conditions

- Stop before exporting a new helper if doing so would expose a CLI-specific exception contract;
  keep the adapter in the CLI and expose only typed diagnostics from core.
