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
pnpm test:external:required
```

The Basic IMPORT evidence runners read official package zips from the conformance
tree. Item evidence filters manifest item resources and ignores convenience test
resources; test evidence imports the official T4/T7 test-structure package.
`QTI3_EXTERNAL_VALIDATOR_REPORT` may attach a supplemental report, but it is not
required for import proof. Attachments are labeled `unverified`: the runner does
not parse an official validator verdict or verify its scope. A missing or empty
attachment is `unavailable`. Setting `requireValidatorEvidence: true` fails with
`certification.validator.unverified` until a verified report integration exists;
independent import-row results remain available.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
