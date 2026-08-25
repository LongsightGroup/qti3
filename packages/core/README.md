# @longsightgroup/qti3-core

Framework-neutral TypeScript core for QTI 3 assessment items.

This package handles dependency-free XML parsing, validation, response processing, scoring,
support metadata, and serialized attempt state. It has zero third-party runtime dependencies,
does not render UI, and does not depend on a browser framework.

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

For the same response-validation policy the browser player uses, call
`validateQtiResponseVariables()` against a parsed assessment item before scoring or
persisting a submission:

```ts
import { parseQtiXml, validateQtiResponseVariables } from "@longsightgroup/qti3-core";

const parsed = parseQtiXml(authoritativeItemXml);
if (!parsed.ok) throw new Error("invalid item");

const validation = validateQtiResponseVariables({
  item: parsed.document.item,
  responses: { RESPONSE: "A" },
  allowedUndeclaredResponseIdentifiers: ["duration"],
});

if (!validation.ok) {
  throw new Error(validation.diagnostics.map((item) => item.message).join("; "));
}
```

`validateQtiResponseVariables()` uses the same runtime diagnostic codes as the player
(`response.required`, `response.maximum`, `response.matchMax`, and related codes). It
checks cardinality shape, required responses, min/max choice and association bounds, and
per-choice `match-max` limits. It does not render custom validation messages in the DOM
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

Delivery redaction, server-style scoring, and secure adaptive turn handling are library
APIs. Dedicated CLI commands for those operations are planned separately.

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
