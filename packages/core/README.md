# @longsightgroup/qti3-core

Framework-neutral TypeScript core for QTI 3 assessment items.

This package handles dependency-free XML parsing, validation, response processing, scoring,
support metadata, and serialized attempt state. It has zero third-party runtime dependencies,
does not render UI, and does not depend on a browser framework.

The public `escapeXmlText()` and `escapeXmlAttribute()` helpers support dependency-free XML
serialization. Use the attribute helper only for values inside double-quoted attributes; it leaves
apostrophes literal while additionally escaping double quotes.

## Install

```sh
npm install @longsightgroup/qti3-core
```

## Use

```ts
import { createItemSession, parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";

const parsed = parseQtiXml(xml);

if (!parsed.ok || !parsed.document) {
  throw new Error(parsed.diagnostics.map((item) => item.message).join("; "));
}

const validation = validateAssessmentItem(parsed.document);
const session = createItemSession(parsed.document);

session.respond("RESPONSE", "A");
const result = session.score();

console.log(validation.diagnostics);
console.log(result.outcomes);
console.log(result.state);
```

### Text responses

Text Entry supports single string, integer, and float values, plus numeric records. Extended Text
also supports multiple and ordered collections; those collections require `max-strings`.

Use `captureQtiTextResponse(interaction, text)` in a custom renderer to convert one input using the
declared response type and authored `base`. Numeric records retain `stringValue`, `floatValue`,
`integerValue`, `leftDigits`, `rightDigits`, `ndp`, `nsf`, and `exponent`. If numeric conversion or
metadata cannot be represented safely, the record preserves the text and leaves numeric fields null.

Use `formatQtiTextResponse(interaction, value)` to restore editable scalar text in the authored base.
It preserves lexical text supplied by a numeric record or raw-text companion.
`qtiTextResponseString(value)` extracts record text or converts a scalar to a string without applying
an interaction's base. Declare `string-identifier` when a separate response should retain raw input.

### Randomized template items

QTI template processing can generate deterministic item variants with expressions such
as `qti-random-integer`, printed variables, and `qti-set-correct-response`:

```ts
const session = createItemSession(parsed.document, undefined, { randomSeed: "attempt-123" });
const state = session.serialize();

store(state);

const resumed = createItemSession(parsed.document, state, { randomSeed: "different-seed" });
```

For availability safety, one `qti-repeat` expression can produce at most
`MAX_QTI_REPEAT_RESULT_ELEMENTS` (10,000) scalar values. Literal counts that necessarily exceed the
limit are authoring errors. Variable counts are checked at evaluation time; invalid or excessive
counts return `null` without a partial container or console output.

The QTI 3.0.1 contracts for [`qti-sum`](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpSum),
[`qti-product`](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpProduct),
[`qti-min`](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpMin), and
[`qti-max`](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpMax) require
at least one child; [`qti-stats-operator`](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpStatsOp)
requires exactly one. The information model does not specify statistics for an empty numeric
container, so the core conservatively returns `null` for that case.

Persist the returned `qti3.attempt-state.v1` state for resume. Once an attempt exists,
saved `templateValues` are authoritative; they are restored before generated correct
responses are derived, so resuming does not depend on the original seed.
Graphic gap-match restoration preserves repeated placements and incomplete responses,
but rejects unknown source/target identifiers and responses exceeding `match-max` or
`max-associations`. It does not trim or move saved pairs to make them fit.

### XML Schema patterns

`qti-pattern-match` uses XML Schema 1.0 Appendix F syntax and matches the whole string.
It supports XML name escapes (`\i`, `\c` and their complements), Unicode general categories,
Unicode blocks (`\p{IsBasicLatin}`), character-class subtraction, groups, alternation,
and quantifiers. `^` and `$` are literal characters. JavaScript-only constructs such as
lookaround, backreferences, and lazy quantifiers are authoring errors.

Use `pattern="{PATTERN}"` to read a string variable; `pattern="PATTERN"` matches that literal
text. NULL operands or NULL pattern variables return NULL. Invalid runtime patterns return
NULL with `processing.pattern.syntax`; no other dialect is used as a fallback.

Name escapes use the XML 1.0 Second Edition character productions referenced by Appendix F.
Unicode categories follow the JavaScript runtime's Unicode database; block ranges use
Unicode 17.0.0 with the Appendix F legacy names. The bundled Unicode data and its permissive
license are in `src/xml-schema-regex-data.ts`; no runtime dependency is added.

Matching uses memoized position sets, with limits of 16,384 pattern code units, 64 nested
groups/classes, 100,000 input code units, and 1,000,000 evaluation steps. Finite quantifier
counts must be safe integers. Exceeding a limit returns `processing.pattern.limit`, never a
partial boolean result. These limits are resource constraints, not a different regex dialect.

### Built-in variables

`qti-variable` resolves `completionStatus`, `numAttempts`, and the `QTI_CONTEXT` record
without declarations. Context contains `candidateIdentifier`, `testIdentifier`, and
`environmentIdentifier`; pass their string values in `createItemSession` options `context`
before template processing runs. Unspecified fields are empty strings. Explicit declarations
of these reserved identifiers are rejected.

`beginAttempt()` starts an attempt without a response. Responding or entering the interacting
state also starts one; repeated edits and suspension/resume keep its count. Each `score()`
ends the current attempt, and the next starts a new count. Scoring an untouched non-adaptive
item keeps zero attempts and `not_attempted` completion status.

For time-dependent items, `duration` is accumulated **float seconds**. Supply either
`duration` for a scoring operation or `now: () => performance.now()` for live delivery.
The clock must return monotonic milliseconds; the engine excludes suspended and completed
time and truncates expression readings to milliseconds while retaining clock precision in saved state. Missing or invalid time produces NULL and a typed
diagnostic when duration is read. Non-timed expressions cannot read duration. Server scoring,
adaptive turns, and submission materialization accept the same inputs in `sessionEnvironment`.
These values come from the trusted host, not candidate response fields.

Saved `builtInVariables` retains the count, open-attempt flag, accumulated duration, and context;
restoring a timed session starts the supplied clock afresh from the saved duration. Keep this
record when persisting `qti3.attempt-state.v1`; state validation checks its field types and ranges.

### Candidate-safe delivery XML

High-stakes delivery systems can redact answer-bearing item XML before sending it to
a browser:

```ts
import { prepareQtiDeliveryXml } from "@longsightgroup/qti3-core";

const delivery = prepareQtiDeliveryXml(authoritativeItemXml, { mode: "static" });

if (!delivery.ok) {
  throw new Error(delivery.diagnostics.map((item) => item.message).join("; "));
}

sendToCandidate(delivery.candidateSafeXml);
```

Use `prepareQtiDeliveryXml().ok` for deliverability. The
`analyzeQtiDeliverySecurity().deliverySafe` flag describes the exact XML being analyzed,
so it is normally `false` for an authoritative scorable item before redaction and `true`
only for the redacted output.

The redactor removes correct responses, response and area mappings, outcome lookup
tables, response/outcome/template declaration default values, response processing, and
authored feedback subtrees. It also reports secure-delivery v1 blockers such as
template processing, set-correct-response, and adaptive response processing.

String-range redaction uses the same dependency-free XML parser as `parseQtiXml`, with
source ranges recorded during parsing. XML parse failures are reported as `xml.parse`
error diagnostics; hosts must treat those diagnostics, `parseQtiXml().ok === false`,
and `prepareQtiDeliveryXml().ok === false` as non-deliverable. The redacted output is
re-analyzed before `ok` is returned, but hosts should still treat redacted XML as
untrusted presentation input.

`prepareQtiDeliveryXml()` is the high-level host API. Use `mode: "static"` for
non-adaptive delivery where all response processing and feedback are removed. Use
`mode: "server-materialized-adaptive"` only after the server has authoritative outcomes
for the current adaptive view; pass those outcomes so visible feedback can be retained.
Pass `templateValues` when the item uses template-derived presentation (`qti-printed-variable`,
`qti-template-block`, or `qti-template-inline`). Adaptive turn processing supplies these
from session state automatically; hosts calling `prepareQtiDeliveryXml()` directly must
provide the same authoritative template snapshot. Generated answer keys, template and response
processing, mappings, lookup tables, declaration defaults, and hidden feedback are
stripped from candidate XML. Static delivery fails closed for adaptive response or
template processing where server materialization is required.

Use `analyzeQtiDeliverySecurity()` when a host only needs diagnostics about a specific
XML string, and `buildQtiDeliverySafeXml()` when a host explicitly wants the lower-level
static redaction primitive. Most delivery services should call `prepareQtiDeliveryXml()`
instead.

`prepareQtiDeliveryXml()` returns normalized `delivery.preparation.*` diagnostic codes
for delivery preparation failures across both modes. Hosts can key on
`result.diagnostics[].code` for logging, i18n, HTTP mapping, or telemetry when using the
facade. `result.analysis.findings[].kind` remains available as the structured semantic
contract for hosts that prefer mode-independent finding data. Lower-level APIs keep
their own diagnostic namespaces for callers that intentionally use those primitives.

The parser does not resolve external entities, process DTD entity declarations, or access
the network or filesystem. Unknown named entities are preserved verbatim, and numeric
character references expand to at most one valid XML character.

Candidate-safe XML is not a full content audit. It does not remove solution text an
author wrote directly into the item body, and it does not validate Portable Custom
Interaction module/config URLs or host runtime policy. If candidates should see item
point values, expose them intentionally through host metadata or visible item content;
do not rely on hidden QTI declaration defaults as the presentation channel.

### Server-side scoring

Use full authoritative item XML on the server and pass only trusted response variables:

```ts
import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";

const scored = scoreQtiItemServerSide({
  itemXml: authoritativeItemXml,
  trustedResponses: { RESPONSE: "A" },
});

if (!scored.ok) {
  throw new Error(scored.diagnostics.map((item) => item.message).join("; "));
}

console.log(scored.score);
console.log(scored.state);
```

This API does not accept restored outcomes or a full prior attempt state, so browser
submitted `SCORE`, `MAXSCORE`, or similar outcome variables cannot become trusted
server results. It validates trusted response identifiers and JSON-shaped QTI values,
then runs response processing. It does not run candidate response-validation policy such
as required interactions, cardinality limits, or min/max response counts; delivery hosts
should enforce that policy before accepting a submission or finalizing an attempt.

To validate responses before scoring or persisting a submission, call
`validateQtiResponseVariables()` against a parsed assessment item. Enable `requireScoredResponses`
to match the player's default policy:

```ts
import { parseQtiXml, validateQtiResponseVariables } from "@longsightgroup/qti3-core";

const parsed = parseQtiXml(authoritativeItemXml);
if (!parsed.ok) throw new Error("invalid item");

const validation = validateQtiResponseVariables({
  item: parsed.document.item,
  responses: { RESPONSE: "A" },
  allowedUndeclaredResponseIdentifiers: ["duration"],
  requireScoredResponses: true,
});

if (!validation.ok) {
  throw new Error(validation.diagnostics.map((item) => item.message).join("; "));
}
```

`validateQtiResponseVariables()` uses the same runtime diagnostic codes as the player
(`response.required`, `response.maximum`, `response.matchMax`, and related codes). It
checks cardinality shape, required responses, min/max choice and association bounds, and
per-choice `match-min` and `match-max` limits. Without `requireScoredResponses: true`, an answer key
alone does not make an optional response required. Explicitly authored zero minimums remain
optional under either policy. It does not render custom validation messages in the DOM
or validate media play counts beyond what the item model exposes.

Use `materializeQtiItemSubmission()` when a server needs the reusable QTI mechanics behind
finalization: response validation, trusted response application, response processing,
adaptive turn materialization, normalized response/outcome snapshots, and a generic scoring
disposition:

```ts
import { materializeQtiItemSubmission } from "@longsightgroup/qti3-core";

const materialized = materializeQtiItemSubmission({
  itemXml: authoritativeItemXml,
  existingState: priorAttemptState,
  trustedResponses: { RESPONSE: "A" },
});

if (!materialized.ok) {
  throw new Error(materialized.diagnostics.map((item) => item.message).join("; "));
}

console.log(materialized.scoringDisposition);
console.log(materialized.responseVariables);
console.log(materialized.outcomeVariables);
```

`scoringDisposition` uses a default generic taxonomy from `qti3-core`: `scored`,
`manual-scoring-required`, `unscored-reference`, or `invalid`. Host applications can map
these dispositions to product-specific finalization statuses, grading queues, result
aggregation, and external exports.

A `SCORE` outcome with `external-scored="human"` or `external-scored="externalMachine"`
returns `score: null` and `manual-scoring-required` until the host obtains an external grade.
The serialized outcomes retain authored defaults for round trips; those values are not proof
of a returned grade. The host owns external grading and finalization.

The `qti3 score` and `qti3 prepare-delivery` CLI commands expose file-oriented server scoring and
candidate-safe delivery preparation. Their response and state JSON files are server-trusted inputs,
not raw browser submissions. Secure adaptive turn handling remains a library API for hosts that
manage the versioned attempt-state contract.

### Secure adaptive turns

Adaptive item delivery should run each submitted turn against authoritative XML on the
server, preserving prior `qti3.attempt-state.v1` between turns:

```ts
import { processQtiAdaptiveItemTurn } from "@longsightgroup/qti3-core";

const turn = processQtiAdaptiveItemTurn({
  itemXml: authoritativeItemXml,
  priorState: savedAttemptState,
  trustedResponses: { RESPONSE: "A" },
});

if (!turn.ok) {
  throw new Error(turn.diagnostics.map((item) => item.message).join("; "));
}

store(turn.state);
sendToCandidate(turn.candidateSafeXml, turn.state);
```

Deliver both artifacts to the player on each adaptive turn:

- `candidateSafeXml` — server-materialized presentation for the current turn (outcome-visible feedback, secrets stripped)
- `state` — authoritative `qti3.attempt-state.v1` with trusted responses, outcomes, and interaction state

```ts
await player.loadXml(turn.candidateSafeXml);
player.restore(turn.state);
```

Refresh turns with no new submission still return updated materialized XML derived from restored outcomes, so a resume flow should load both values again even when the candidate does not submit a new response.

The static delivery redactor still fails closed for adaptive response processing. Use
`processQtiAdaptiveItemTurn()` when a host needs both a server-materialized candidate
view and updated authoritative outcomes for the next adaptive turn. Use
`prepareQtiDeliveryXml(..., { mode: "server-materialized-adaptive", outcomes })` only
when the host already owns the authoritative outcomes and needs to prepare candidate XML.

## Scope

- Parse QTI XML into a typed item model.
- Validate item-level QTI behavior and emit structured diagnostics.
- Score supported response-processing patterns without a DOM.
- Serialize and restore attempt state through `qti3.attempt-state.v1`.
- Preserve QTI 3 Portable Custom Interaction metadata and opaque PCI interaction state.
- Publish support metadata for current and deprecated item interactions.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3

### Shared vocabulary authoring

Authoring tools can build QTI shared-vocabulary controls from the core field registry instead of
maintaining local class-prefix logic:

```ts
import {
  parseSharedVocabularyClasses,
  serializeSharedVocabularyAttributes,
  serializeSharedVocabularyClassNames,
  sharedVocabularyFieldsForInteraction,
} from "@longsightgroup/qti3-core";

const fields = sharedVocabularyFieldsForInteraction("choice");
const state = parseSharedVocabularyClasses("qti-labels-decimal qti-orientation-horizontal");

const className = serializeSharedVocabularyClassNames({
  ...state,
  "input-control-hidden": true,
}).join(" ");

const attrs = serializeSharedVocabularyAttributes(
  { "media-player-controls": ["play", "captions"] },
  "media",
);
```

The registry models authoring-level fields such as `labels-style`, `choices-position`, and
`media-player-controls`; downstream products should keep UI labels, editor layout, and draft
property names in their own adapter layer.

## Batch import from extracted entries

`parseQtiPackageFromEntries(entries, { limits })` imports original or restored
`{ path, bytes }` entries into the same `QtiPackageParseResult` returned by
`parseQtiPackage`. It preserves all entry bytes and applies the same manifest,
assessment-test ordering, item, asset, and diagnostic semantics. No ZIP rebuilding
or stream-event collection is needed when the entries are already in memory.

The batch entry boundary rejects duplicate or noncanonical paths and enforces
entry-count, per-entry, and total byte limits before parsing XML. Compression
ratio limits apply only during ZIP extraction. Check `result.ok` before saving or
delivering items: parsing can return partial models with error diagnostics.

```ts
import { parseQtiPackageFromEntries } from "@longsightgroup/qti3-core";

const result = parseQtiPackageFromEntries(savedEntries);
if (result.ok) {
  showPackage(result);
} else {
  showDiagnostics(result.diagnostics);
}
```

## Incremental package parsing

`parseQtiPackageStream(source, limits)` reads an immutable package entry inventory
through a caller-owned `readEntry(path, maxBytes)` function. The host supplies ZIP
extraction or object-storage reads and must enforce `maxBytes` during extraction.
Core reads one item at a time and returns asset references without loading assets.

```ts
import { parseQtiPackageStream } from "@longsightgroup/qti3-core";

for await (const event of parseQtiPackageStream(source, {
  maxEntries: 10_000,
  maxEntryBytes: 8 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxDiagnostics: 10_000,
})) {
  if (event.kind === "item") {
    await stageItem(event.index, event.item);
  } else if (event.summary.ok) {
    await completeStaging(event.summary);
  } else {
    await failStaging(event.summary.diagnostics);
  }
}
```

Item events are provisional: a later entry can fail validation or storage reads.
Publish only after the terminal summary reports `ok`. Breaking iteration stops
further reads. Do not collect item events into an array when bounded memory is
required. The inventory, manifest/test structure, asset references, standards, and
bounded diagnostics remain in memory; item bodies and parsed models do not.
Choose entry and total budgets for the host runtime and enforce archive integrity
at the host's extraction boundary. The synchronous `parseQtiPackage` API still
returns a complete in-memory package for callers that need that representation.

## ZIP extraction in browsers and other async runtimes

`readQtiPackageZipEntriesAsync(bytes, { inflateRaw, limits }, diagnostics)` uses the
same archive reader as `readQtiPackageZipEntries`. Its inflater returns a promise;
the existing synchronous API is unchanged. Both readers validate central/local
headers, canonical paths, duplicate entries, overlapping bodies, and resource
budgets. Multi-disk archives, ZIP64, encryption, and unsupported compression
methods produce typed diagnostics. CRC checks are not currently performed.

The host inflater must enforce `context.maxOutputLength` **during** expansion.
The browser example uses a bounded `DecompressionStream` reader and cancels it
when output exceeds that budget. Entries returned by either reader are
provisional: reject the archive when `diagnostics` contains an error, even when
some entries were extracted. Limits must be positive safe integers; `Infinity`
explicitly disables a budget and should be reserved for trusted input.

`isQtiItemResource(type)` classifies manifest item resource types. Package content
uses `isResolvableAssetUrl` for relative references; external URLs and fragments
are not package inventory entries. Root-absolute content paths such as `/media/a.png`
produce `package.path.absolute` instead of being rebased beneath an item's directory.

`parseQtiXml` retains authored top-level child names and locations in
`item.sourceChildren`. `validateAssessmentItem` uses that source metadata to check
the QTI 3.0.1 assessment-item sequence and reject unsupported direct children with
`assessmentItem.child.order` and `assessmentItem.child.unsupported` diagnostics.
These checks apply to ordinary item parsing, package import, CLI inspection, and
fixture validation. Programmatically created items without source metadata have
no authored XML order to check. This is an explicit structural check, not runtime
XSD validation.
