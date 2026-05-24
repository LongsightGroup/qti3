# @longsightgroup/qti3-core

Framework-neutral TypeScript core for QTI 3 assessment items.

This package handles parsing, validation, response processing, scoring, support metadata,
and serialized attempt state. It does not render UI and does not depend on a browser
framework.

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

### Candidate-safe delivery XML

High-stakes delivery systems can redact answer-bearing item XML before sending it to
a browser:

```ts
import { buildQtiDeliverySafeXml } from "@longsightgroup/qti3-core";

const delivery = buildQtiDeliverySafeXml(authoritativeItemXml);

if (!delivery.ok) {
  throw new Error(delivery.diagnostics.map((item) => item.message).join("; "));
}

sendToCandidate(delivery.xml);
```

Use `buildQtiDeliverySafeXml().ok` for deliverability. The
`analyzeQtiDeliverySecurity().deliverySafe` flag describes the exact XML being analyzed,
so it is normally `false` for an authoritative scorable item before redaction and `true`
only for the redacted output.

The redactor removes correct responses, response and area mappings, outcome lookup
tables, response/outcome/template declaration default values, response processing, and
authored feedback subtrees. It also reports secure-delivery v1 blockers such as
template processing, set-correct-response, and adaptive response processing.

String-range redaction aligns a private XML tag scan to the same stax parse tree used by
`parseQtiXml`. Alignment failures are reported as `xml.parse` error diagnostics; hosts
must treat those diagnostics, `parseQtiXml().ok === false`, and
`buildQtiDeliverySafeXml().ok === false` as non-deliverable. The redacted output is
re-analyzed before `ok` is returned, but hosts should still treat redacted XML as
untrusted presentation input.

The scanner adds a second full pass over each XML string. That is acceptable for
item-scale delivery and scoring, but package-level batch redaction should treat XML
parsing as a hot path if whole packages are processed repeatedly.

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

The delivery redaction and server-scoring APIs are library APIs in `0.4.x`. CLI commands
for delivery-safe XML generation and server-style scoring are not part of this release
line yet.

## Scope

- Parse QTI XML into a typed item model.
- Validate item-level QTI behavior and emit structured diagnostics.
- Score supported response-processing patterns without a DOM.
- Serialize and restore attempt state through `qti3.attempt-state.v1`.
- Preserve QTI 3 Portable Custom Interaction metadata and opaque PCI interaction state.
- Publish support metadata for current and deprecated item interactions.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
