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

if (parsed.document) {
  const validation = validateAssessmentItem(parsed.document);
  const session = createItemSession(parsed.document);

  session.respond("RESPONSE", "A");
  const result = session.score();

  console.log(validation.diagnostics);
  console.log(result.outcomes);
  console.log(result.state);
}
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

The redactor removes correct responses, response and area mappings, response
processing, and authored feedback subtrees. It also reports secure-delivery v1
blockers such as template processing, set-correct-response, and adaptive response
processing.

Byte-range redaction aligns element boundaries to the same stax parse tree used by
`parseQtiXml`. End-tag lookup ignores matches inside XML comments and CDATA sections,
but hosts should still treat redacted XML as untrusted presentation input.

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
server results.

## Scope

- Parse QTI XML into a typed item model.
- Validate item-level QTI behavior and emit structured diagnostics.
- Score supported response-processing patterns without a DOM.
- Serialize and restore attempt state through `qti3.attempt-state.v1`.
- Preserve QTI 3 Portable Custom Interaction metadata and opaque PCI interaction state.
- Publish support metadata for current and deprecated item interactions.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
