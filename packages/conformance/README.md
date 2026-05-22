# @longsightgroup/qti3-conformance

Fixture runner and conformance helpers for qti3 QTI 3 assessment items.

This package runs qti3 fixture objects through parsing, validation, scoring, diagnostics,
and expected-state checks.

## Install

```sh
npm install @longsightgroup/qti3-conformance
```

## Use

```ts
import { runFixture } from "@longsightgroup/qti3-conformance";
import { getFixtureById } from "@longsightgroup/qti3-fixtures";

const fixture = getFixtureById("choice-reference");

if (fixture) {
  const result = runFixture(fixture);
  console.log(result.ok);
  console.log(result.diagnostics);
}
```

## Scope

- Check expected parse diagnostics.
- Check expected validation diagnostics.
- Score fixture attempts and compare outcomes.
- Compare serialized attempt state when a fixture declares expected state.

## External 1EdTech Content

Local external-content smoke tests are optional:

```sh
QTI3_EXTERNAL_QTI_DIR=/path/to/official/qti pnpm test:external
```

Certification-oriented runs are required and fail fast without official inputs:

```sh
QTI3_EXTERNAL_QTI_DIR=/path/to/official/qti \
QTI3_EXTERNAL_VALIDATOR_REPORT=/path/to/validator-report.json \
pnpm test:external:required
```

Set `QTI3_EXTERNAL_SCORE_CORRECT=1` to also score every discovered assessment item with
its declared correct responses.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
