# Plan 017: Separate XML textContent semantics from visible-text flattening

> Audit every call site before changing the shared helper and update `plans/README.md`.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/core/src/xml.ts packages/core/src/content-text.ts packages/core/src/parser.ts packages/core/src/parser-declarations.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug / accessibility
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

The XML helper inserts spaces at every element boundary, turning `bo<em>ld</em>ly` into
`bo ld ly`. Simply switching to `join("")` would fix inline words but can turn adjacent visible
blocks into `onetwo`. Literal XML text extraction and accessibility-oriented visible text need
separate, named behavior.

## Scope and steps

1. Inventory all `textContent(...)` calls. Classify declaration values, processing base values, and
   href fields as literal XML text; classify prompts, choices, body text, and labels as visible text.
2. Make `xml.ts` text extraction match DOM-style concatenation without invented separators.
3. Route visible-content consumers through a boundary-aware helper in `content-text.ts`: preserve
   inline adjacency, add separation for block boundaries, normalize authored whitespace, and retain
   image/object accessible labels.
4. Add focused tests for split inline words, inline elements with authored spaces, adjacent blocks,
   nested blocks, declaration values, and prompt/choice accessible labels.

## Verification and done criteria

- Literal `<qti-value>bo<em>ld</em>ly</qti-value>` becomes `boldly`.
- Visible `<p>one</p><p>two</p>` becomes `one two`.
- `pnpm verify && pnpm test:browser` exit 0.

## STOP conditions

Stop if any changed expectation cannot be classified as removal of an invented space or insertion of
a visible block boundary.
