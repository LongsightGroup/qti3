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

## Scope

- Parse QTI XML into a typed item model.
- Validate item-level QTI behavior and emit structured diagnostics.
- Score supported response-processing patterns without a DOM.
- Serialize and restore attempt state through `qti3.attempt-state.v1`.
- Publish support metadata for current and deprecated item interactions.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
