# Plan 004: Validate and drop unsafe interaction asset URLs

> Run the drift check first, use typed diagnostics, and update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/player/src/content/content-dom.ts packages/player/src/interactions packages/player/src/player-element.ts tests/browser/player-dom-behavior.spec.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

The player now applies one context-aware URL policy to item content and every authored interaction
asset sink. Unsafe values are omitted with source-located `interaction.asset.url.unsafe`
diagnostics, while sink-compatible relative, HTTP(S), and media data URLs remain supported. The
DOM-free policy and diagnostic tests, focused browser scenario, full verification suite, and all
471 Playwright tests pass.

## Why this matters

Item-body URLs pass through a safety gate, but interaction renderers assign parsed item URLs to
`img.src`, media/source/track `src`, and fallback-link `href` properties without the same check.
Protocol-relative URLs and scriptable schemes must not bypass the player boundary.

## Current state and conventions

- `packages/player/src/content/content-dom.ts` exports `isSafeUrl`/`isSafeContentUrl`; its generic
  `/` prefix currently also accepts `//host/path`.
- Raw assignments exist in `interactions/media-interaction.ts`, `graphic-context.ts`,
  `drawing-interaction.ts`, `shared.ts`, and `position-object-interaction.ts`.
- Load-time player diagnostics are collected by
  `interactions/interaction-diagnostics.ts` before rendering. Render helpers do not own an
  `emitDiagnostics` callback, so diagnostics belong in that existing collection pass.

## Scope

In scope: URL helper extraction/tightening, every interaction URL sink found by
`rg '\.(src|href)\s*=' packages/player/src/interactions`, interaction diagnostics, DOM-free helper
tests, and focused Playwright coverage. Out of scope: stylesheet resolver policy, host resolver
authorization, and core package-path behavior.

## Steps

1. Create a context-aware string helper that rejects `//`, non-allowlisted schemes, and SVG data
   URLs for object/embed or navigable contexts. Preserve ordinary relative/package paths and the
   existing image/audio/video data URL behavior where safe for that sink.
2. Extend `collectInteractionRenderDiagnostics` to report each unsafe authored asset with one
   dot-case diagnostic and source location. Do not log or throw.
3. Route every interaction `src`/`href` assignment through the helper; unsafe values are omitted.
4. Add string-only Vitest cases plus Playwright assertions that unsafe values never reach DOM
   properties, the diagnostic event fires, and the rest of the item remains usable.

## Verification and done criteria

- `rg '\.(src|href)\s*=' packages/player/src/interactions` shows every authored URL assignment is
  immediately guarded or receives an already-validated value.
- `pnpm verify && pnpm test:browser` exit 0.
- Existing valid package-relative media and graphic fixtures still render.

## STOP conditions

Stop if an existing documented fixture requires an unsafe URL class, or if a sink cannot be
classified without changing the public host resolver contract.
