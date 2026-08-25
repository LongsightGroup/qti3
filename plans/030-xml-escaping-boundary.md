# Plan 030: Consolidate XML escaping with explicit text and attribute APIs

## Status

DONE — P2, M effort. Completed 2026-08-25.

Core now publicly exports context-specific text and double-quoted-attribute escaping helpers, and
the fixtures, writer, migrator, and transcoder use them without generic local escape functions.
The 47 updated serializer snapshots differ only in quote/apostrophe lexical normalization; all 176
before/after snapshot XML documents are DOM-equivalent. Generated evidence hashes were refreshed
without changing any non-hash support evidence, and full verification passes.

## Why

Core already distinguishes XML text escaping from double-quoted attribute escaping, but those
helpers are internal. Other packages maintain overlapping helpers, sometimes using one function
for both contexts. Consolidation is useful only if it preserves each serializer's lexical and
semantic behavior and treats a new core export as a deliberate public-API decision.

## Scope

- `packages/core/src/xml.ts` and `packages/core/src/index.ts`
- XML-producing call sites in `packages/transcoder`, `packages/fixtures`, `packages/writer`, and
  `packages/migrator` found by the implementation inventory
- Unit and snapshot tests for affected serializers
- Public API documentation/changelog if required by repository policy

## Implementation

1. Inventory every local XML escape helper and classify every call site as element text,
   double-quoted attribute value, or intentional nested markup encoded as text.
2. Add direct core tests that define the contracts:
   - text escapes `&`, `<`, and `>`;
   - attribute escaping includes the text contract plus `"`;
   - apostrophes remain literal in double-quoted attributes.
3. Export clearly named `escapeXmlText` and `escapeXmlAttribute` from core. Document that this is a
   small framework-neutral serialization API addition.
4. Replace local helpers call-site by call-site using the correct context-specific API. Preserve
   intentional double escaping used to embed markup as text.
5. Delete a local helper only after all of its callers are migrated. Review every snapshot change;
   accept only escaping-normalization differences with equivalent parsed XML.

## Acceptance criteria

- No generic `escapeXml` helper remains in the scoped packages unless a documented non-XML
  dialect requires distinct behavior.
- Every interpolated XML value uses the context-appropriate helper.
- Serializer tests cover ampersands, angle brackets, quotes, apostrophes, and nested encoded markup.
- Generated outputs parse successfully and preserve their prior data values.
- Core and CLI retain zero third-party runtime dependencies.

## Stop conditions

- Stop and narrow the plan if a target format's escaping rules are not XML-compatible.
- Do not silently change nested-markup encoding or accept broad snapshot churn.
