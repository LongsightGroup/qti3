# Own XML Parser: Remove the stax-xml Dependency

> **Status: DELIVERED** ([v0.8.0](../../CHANGELOG.md#080---2026-06-12)). Kept for design
> rationale; behavior now lives in `packages/core/src/xml.ts`.

## Summary

Replace `stax-xml` with a small, purpose-built XML parser inside `@longsightgroup/qti3-core`,
making core (and the CLI) zero-runtime-dependency. The parser is minimal by design: it
supports exactly what QTI item and package XML needs, produces the existing `XmlNode` tree
with native source offsets, preserves character data verbatim, and fully decodes predefined
and numeric character references (decimal and hexadecimal).

## Why

`stax-xml` is a poor fit that we currently paper over with three layers of workarounds in
`packages/core/src/xml.ts`:

1. **No source offsets.** Every `QtiDiagnostic` needs line/column/offset, and
   `delivery-security.ts` slices raw XML by element ranges. Because stax-xml exposes
   neither, `scanXmlTagTokens()` re-tokenizes the whole document by hand and aligns its
   tokens against the stax-xml event stream, with an "XML source range alignment failed"
   error path when the two parsers desync. We already parse every document twice.
2. **Trimmed mixed content.** stax-xml trims boundary whitespace around child elements, so
   `restoreMixedContentFromSource()` / `restoreLeafTextFromSource()` re-slice text from the
   raw source and re-decode entities with our own decoder (`decodeXmlCharacterData`) — a
   third partial parser.
3. **Supply chain.** stax-xml is the _only_ runtime dependency of a published assessment
   library (first published 2025-06, single maintainer, 0.7.0 with 1.0.0-rc churn ahead).

The hand-written tokenizer in `xml.ts` already handles comments, CDATA, processing
instructions, DOCTYPE with internal subsets, and quoted attribute values. Promoting it to a
full parser deletes the dual-parse alignment and the whitespace-restoration layer instead of
maintaining them forever.

## Scope: Minimal Feature Set

Driven by what the codebase actually consumes (`XmlNode` fields, `parser.ts`,
`delivery-security.ts`, CLI manifest parsing). Anything not listed is a non-goal.

| Feature               | Behavior                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XML declaration / PIs | Skipped, never surfaced as content                                                                                                                                                                                         |
| Comments              | Skipped, never surfaced as content (existing test pins this)                                                                                                                                                               |
| DOCTYPE               | Skipped, including internal subsets with quoted strings and `[...]` (existing logic in `findMarkupDeclarationEndOffset`); declared entities are **not** processed                                                          |
| Elements              | Start / end / self-closing tags; qualified `name`, `localName`, `prefix`                                                                                                                                                   |
| Namespaces            | Minimal resolution: a prefix→URI stack built from `xmlns` / `xmlns:*` attributes so `XmlNode.uri` resolves (consumed by the root `qti-assessment-item` namespace check in `parser.ts:76`). Attribute-level URIs not needed |
| Attributes            | Single- or double-quoted values, entity decoding inside values, last duplicate wins (current `Record` behavior), `xmlns` attributes remain visible in `attributes`                                                         |
| Character data        | **Verbatim — no trimming.** Mixed-content fidelity comes from the parser itself, not a restoration pass                                                                                                                    |
| CDATA                 | Content appended verbatim; entities inside CDATA are **not** decoded; `]]>` terminates                                                                                                                                     |
| Entities              | See "Entity Decoding" below                                                                                                                                                                                                |
| Source info           | `source` (line/column/offset/path), `endSource`, and `sourceRange` (`startOffset`, `startTagEndOffset`, `endOffset`) populated natively during the single pass                                                             |
| Errors                | Collected into `errors: Error[]`; `parser.ts` already treats any error as fatal (`xml.parse` diagnostic, `ok: false`)                                                                                                      |
| Encoding              | Input is a JS string (decoding already happened); strip a leading BOM (`﻿`)                                                                                                                                                |

## Entity Decoding

A single decoder, applied to text content and attribute values (never CDATA), replacing the
current duplicate logic:

- **Predefined entities:** `&amp;` `&lt;` `&gt;` `&apos;` `&quot;`.
- **Decimal numeric character references:** `&#937;` → `Ω`. Any sequence of decimal digits.
- **Hexadecimal numeric character references:** `&#x3A9;` / `&#X3A9;` → `Ω`,
  case-insensitive in both the `x` and the hex digits.
- **Astral-plane code points** via `String.fromCodePoint`: `&#x1F600;` → 😀 (one code
  point, two UTF-16 units).
- **Validation:** a numeric reference must decode to a valid XML `Char`
  (code point ≤ `0x10FFFF`, not a surrogate `0xD800–0xDFFF`). The current code calls
  `String.fromCodePoint` guarded only by `Number.isFinite`, so `&#x110000;` or `&#xD800;`
  would **throw a RangeError today** — a latent bug this plan fixes. Invalid references are
  left verbatim in the output and recorded as a recoverable parse error.
- **Unknown named entities** (e.g. `&nbsp;`, DTD-declared entities) are left verbatim —
  this matches current behavior and the existing test asserting `&amp;#x398;` decodes to
  the literal text `&#x398;` (double-decoding must not happen: decode in one pass, never
  re-scan replaced text).
- A bare `&` not forming an entity is left verbatim (lenient, matches current decoder).

## Architecture

All changes stay behind the existing public surface of `xml.ts` — `parseXmlTree()`,
`XmlNode`, `XmlSourceLocation`, `XmlSourceRange`, `childElements`, `descendants`,
`textContent` keep their exact signatures, so no parser module outside `xml.ts` changes.

New internal module `packages/core/src/xml-tokenizer.ts` (or keep everything in `xml.ts` if
it stays readable; implementer's choice):

1. **Tokenizer** — promote the existing `scanXmlTagTokens` machinery (`findTagEndOffset`
   with quote awareness, `findMarkupDeclarationEndOffset`, `skipPastSequence`,
   `isSelfClosingStartTag`, `readTagName`) and extend it to also emit text spans, CDATA
   spans, and parsed attributes. Single forward pass, offsets free.
2. **Attribute scanner** — the genuinely new code: within a start tag, parse
   `name = "value"` pairs (whitespace-tolerant around `=`), both quote styles, decode
   entities in values. Unterminated quote or garbage in the tag → parse error.
3. **Tree builder** — replaces the stax-xml event loop in `parseXmlTree`: maintains the
   element stack, namespace-prefix stack, builds `XmlNode`s with `source`/`sourceRange`
   filled in directly (no alignment step possible to fail), appends verbatim text/CDATA to
   `text` and `content`.
4. **Line/column** — replace the per-node `O(offset)` scan in `sourceLocation()` with a
   line-start offset table computed once per document plus binary search (the current
   approach is quadratic in document size across nodes).

**Error semantics** (all collected, parse continues where safe):

- Mismatched closing tag (`</b>` closing `<a>`) — error; recover by popping to the nearest
  matching open element or treating as stray.
- Unclosed elements at EOF — keep the exact current message
  (`Unexpected end of document. Missing closing tag for <x>.`).
- Multiple root elements, content after the root, no root element — error.
- Malformed tags, unterminated comments/CDATA/DOCTYPE, invalid numeric references — error.

Strictness beyond this is a non-goal: `parseQtiXml` already fails the document on any XML
error, so we need detection, not spec-complete recovery.

**Deletions** (the payoff):

- `import { StaxXmlParserSync, XmlEventType } from "stax-xml"` and the event loop
- The tag-token/event alignment logic and its "alignment failed" error paths
- `restoreMixedContentFromSource`, `restoreLeafTextFromSource`,
  `appendDecodedTextSegment`, `shouldRestoreMixedContentWhitespace`, and the
  `inlineMixedContentChildNames` allowlist (whitespace is simply never lost)
- The `stripNonCharacterMarkup` regex pass (comments/PIs never enter content)

`decodeXmlCharacterData` survives as the single entity decoder, extended per above.

## CLI Migration

`packages/cli/src/index.ts:892` (`parsePackageXmlTree`) duplicates the same stax-xml event
loop to parse `imsmanifest.xml` and friends into a `PackageXmlNode` shape
(`localName`, `attributes`, `children`, `text`). The CLI already depends on core: replace
`parsePackageXmlTree` with core's `parseXmlTree` (mapping errors to `string[]` and using
`XmlNode` directly or via a thin adapter), then remove `stax-xml` from
`packages/cli/package.json`.

## Behavioral Risk: Whitespace in `node.text`

The one intentional behavior change: today, elements whose children are _not_ in the
inline-restoration allowlist get stax-xml's trimmed text; the new parser preserves all
character data, so `node.text` on structural elements (e.g. `qti-item-body` with block
children) gains the whitespace between child tags. `textContent()` already normalizes
whitespace, but direct `.text` consumers (`content-text.ts:24`, the
`normalizeInlineContext(parent.text)` call in `parser.ts:481`, choice/asset text fallbacks)
must be audited.

Mitigation is the baseline-diff step below plus the full `pnpm verify` matrix (unit,
conformance, a11y, player suites). Any consumer found depending on trimmed text gets
explicit normalization at the call site — fidelity belongs in the tree, normalization in
the consumer.

## Security Notes

Worth stating for an assessment-delivery product: this design is structurally immune to
XXE (no external entity resolution, no DTD entity processing, no network/filesystem access)
and to billion-laughs expansion (custom entity declarations are skipped, numeric references
expand to exactly one code point). The existing test that a DOCTYPE-declared decoy entity
is ignored stays green. Document this in the parser module header.

## Test Plan

Existing tests in `xml.test.ts` already pin the hard cases (decoy closing tags in comments
/ CDATA / PIs, DOCTYPE internal subsets, quoted `>` in attributes, prefixed names, numeric
references, fatal-on-malformed) — all must pass unchanged.

New tests in `xml.test.ts` (or a new `xml-tokenizer.test.ts`):

**Entities** (the requested focus):

- Decimal: `&#937;`, `&#0;`-adjacent boundaries, leading zeros (`&#0060;` → `<`)
- Hex: `&#x3A9;`, `&#X3a9;` (case variants)
- Astral: `&#x1F600;` → 😀 with correct `.length === 2`
- Predefined five; mixed entities and text in one node
- Entities in attribute values: `title="A &amp; B &#x2192; C"`
- Invalid code points (`&#x110000;`, `&#xD800;`) → left verbatim + parse error, **no throw**
- Unknown named entity `&nbsp;` left verbatim; no double-decoding (`&amp;#x398;` → `&#x398;`)
- Entities inside CDATA are not decoded

**Attributes:** single quotes, whitespace around `=`, duplicate attribute (last wins),
unterminated quote → error, `xmlns`/`xmlns:p` visible in `attributes`.

**Namespaces:** default `xmlns` inherited and overridden in nested scopes; prefixed element
resolves `uri`; unbound prefix → `uri` undefined (not an error); the `parser.ts` root
namespace check works against the new resolution.

**Whitespace:** boundary whitespace preserved around inline children _without_ the
allowlist; inter-block whitespace present in `node.text` of structural elements (pinning
the intentional change); leading BOM stripped.

**Malformed input:** mismatched close tag, multiple roots, text before root, `<` at EOF,
unterminated comment/CDATA — each yields errors and `parseQtiXml(...).ok === false`.

**Migration baseline diff (one-time, the most important gate):**
Before swapping the implementation, capture `JSON.stringify(parseQtiXml(xml))` for every
item in `packages/fixtures/xml/` and the conformance corpus on `main`. After the swap, diff
against the baseline. Expected diffs: only `source`-location values that the old aligner
got wrong (if any) and `text` whitespace on structural nodes per the section above — every
diff must be explained or fixed. Delete the baseline script after migration (or keep it as
a conformance test if cheap).

Run before completion:

```text
pnpm vitest run packages/core/src/xml.test.ts packages/core/src/core.test.ts packages/core/src/content-text.test.ts packages/core/src/delivery-security.test.ts
pnpm verify
```

(`pnpm verify` includes `check:deps`, the conformance suite, a11y, and player tests —
the real safety net for this change.)

## Rollout Steps

1. Capture the parse baseline for fixtures + conformance corpus (script, committed
   temporarily or run ad hoc).
2. Implement tokenizer/attribute scanner/tree builder behind the unchanged
   `parseXmlTree()` API; extend the entity decoder; keep stax-xml in place until green.
3. Swap `parseXmlTree` internals to the new parser; delete the alignment and restoration
   layers; run the baseline diff and full suite; fix or document every diff.
4. Migrate the CLI's `parsePackageXmlTree` to core's `parseXmlTree`.
5. Remove `stax-xml` from `packages/core/package.json` and
   `packages/cli/package.json`; `pnpm install` to update the lockfile.
6. `pnpm verify`. Update `packages/core/README.md` to state zero runtime dependencies
   (it's a selling point), and note the change in the changelog/release notes.

## Non-Goals

- DTD validation, schema validation, or processing DTD-declared entities.
- External entity resolution of any kind (XXE stays structurally impossible).
- Preserving comments or processing instructions in the tree.
- XML 1.1, alternate encodings (input is already a decoded JS string).
- Streaming/incremental parsing — QTI items are small; sync whole-string parsing stands.
- Spec-complete error recovery; we detect and fail, matching `parseQtiXml` semantics.
- Publishing the parser as a separate package.

## Acceptance Criteria

- `stax-xml` is absent from all `package.json` files and the lockfile; core and CLI have
  zero runtime dependencies.
- `parseXmlTree()` public API and `XmlNode` shape are unchanged; no module outside
  `xml.ts` (and the CLI adapter) is modified to accommodate the parser.
- Numeric character references (decimal and hex, including astral plane) decode correctly
  in text and attributes; invalid references produce parse errors instead of throwing.
- The alignment and whitespace-restoration layers are deleted, not bypassed.
- Baseline diff over fixtures + conformance corpus shows no unexplained changes.
- `pnpm verify` passes.
