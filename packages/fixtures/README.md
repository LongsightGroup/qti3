# @longsightgroup/qti3-fixtures

Public synthetic QTI 3 fixtures for qti3.

This package provides canonical item XML and expected scoring outcomes for supported
QTI 3 item interactions, response-processing patterns, template behavior, and adaptive
feedback behavior.

## Install

```sh
npm install @longsightgroup/qti3-fixtures
```

## Use

```ts
import { canonicalFixtures, getFixtureById } from "@longsightgroup/qti3-fixtures";

const choice = getFixtureById("choice-reference");
console.log(canonicalFixtures.length);
console.log(choice?.xml);
console.log(choice?.attempts);
```

Fixtures distinguish automatic scoring, external grading, and unscored interactions. The essay
fixture declares human grading and returns no automatic score. Planning hints use a separate
End Attempt response and leave scored answers unchanged. Expected attempts describe each fixture's
response shape and scoring intent.

## XML Files

The package also publishes standalone XML files under:

```text
@longsightgroup/qti3-fixtures/xml/*.xml
```

These files are useful for browser harnesses, external validators, and fixture-based
conformance tests that need real files instead of in-memory fixture objects.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
