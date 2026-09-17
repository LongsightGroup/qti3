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

Item reports distinguish `runScope: "full"` from a custom `"selection"` and include
`coverage` for every physical row in the pinned IMPORT worksheet. The 69 worksheet
rows have 66 distinct AC IDs: repeated IDs retain separate revision/sheet/row keys.
Single-choice class aliases match the required class rather than assuming the
workbook ID matches the fixture ID. Ambiguous choice rows require evidence for both
cardinalities, with an interpretation note retained for submission review. No row
is excluded. Q20 expected-length evidence uses an explicitly labeled synthetic ZIP
because the pinned official fixtures omit that attribute. Its acceptance as a
checklist supplement must be confirmed at submission. The conformance package
uses the workspace writer to build this probe; no third-party runtime dependency
is added. Supplemental rejection cases remain separate from checklist counts.
Missing, duplicate, substituted, and unknown evidence cannot establish complete
coverage; an empty selection fails. Passing a selection does not mean the full
checklist passed, and complete execution does not imply all results passed.

`QTI3_EXTERNAL_VALIDATOR_REPORT` may attach supplemental content-validation evidence.
IMPORT preservation evidence remains independent of content validation.

## Reproducible certification evidence

Item reports record the actual conformance commit, workbook SHA-256, package and XML
hashes, source/imported asset hashes, qti3 commit/version, runtime code hash, and
execution environment. `ok` describes executed checks. `automatedEvidenceReady`
additionally requires a full run, complete passing coverage, the reviewed unchanged
source inputs, and a clean identifiable candidate. It does not resolve human
submission questions or claim certification.

After building and committing the candidate, produce private evidence outside the
repository:

```sh
QTI3_EXTERNAL_QTI_DIR=/path/to/qti-conformance/qti3.0 \
QTI3_CERTIFICATION_OUTPUT_DIR=/private/evidence/candidate \
pnpm certification:evidence
```

The command writes JSON evidence, a readable row crosswalk, and a fresh comparison
result. If the output directory is omitted it creates a directory under the system
temporary directory. Preserve that directory in the maintainer's private evidence
storage. The full `pnpm certification:check` runs this after official fixture tests
and the release gate. It fails if the candidate is dirty or its source identity does
not match the reviewed checklist. Existing saved reports can be checked with:

```sh
qti3 certification check-import-report \
  --qti-root /path/to/qti-conformance/qti3.0 \
  --saved-report /private/evidence/candidate/basic-import-items.json
```

The checker reruns the importer and compares scope, coverage, values, diagnostics,
and input/build identity. Changed or stale evidence fails. Collection time and
machine location may differ. Official checklists and member reports remain external.

Run `pnpm certification:check` locally on a trusted machine with member-authorized
fixtures. Keep official inputs, logs, and generated reports outside this repository
and public Actions artifacts. Public GitHub Actions runs synthetic tests, browser
checks, and release validation. If recurring certification automation becomes useful,
run these same commands in private CI.

## Official validator reports

The verifier supports the JSON downloaded from the member tool's **QTI 3.0.1
Validator** (`Qti30Inspector`), observed on 2026-09-17. Its JSON specification version
is `3.0`; it does not identify a Basic/Advanced application certification profile.
Other inspectors, including SBAC, are rejected as different scopes. No certification
claim follows from a passing content report.

To collect verifiable evidence for one package:

1. Compute the ZIP's SHA-256 **before uploading** it to the member validator.
2. Set the optional report ID to `qti3-sha256-<package-sha256>` and upload those bytes.
3. Download the JSON report directly from that result page. Record its SHA-256,
   the package SHA-256, the tool URL, and collection time in a trusted external
   evidence record. Keep the uploaded bytes alongside the report.
4. Verify the report against those exact artifacts:

```sh
qti3 certification verify-validator \
  --validator-report /private/evidence/report.json \
  --validator-package /private/evidence/package.zip \
  --trusted-report-sha256 <digest-recorded-at-download>
```

A passing result is `verified-pass` with trust `operator-attested-download`.
The digest supplied by the operator is the trust input: parsing JSON, matching its
report ID, or hashing a file after the fact does **not** authenticate 1EdTech origin.
There is no supported signed-report verification or automated validator API in this
integration. Do not treat an arbitrary file's freshly computed digest as provenance.

Verification rejects failed or incomplete runs, inconsistent counters, warnings
pending review, different inspectors/versions, different filenames, changed package
bytes, and a missing or mismatched trusted report digest. A report covers exactly
one explicitly supplied package; it cannot certify an importer or other packages.

The item-import command accepts the same `--validator-report`, `--validator-package`,
`--trusted-report-sha256` arguments plus `--require-validator-evidence`. Its API uses
`validatorReport`, `validatorPackage`, `trustedValidatorReportSha256`, and
`requireValidatorEvidence`. Required evidence can now pass, but cannot override a
failed import case. Missing input is `unavailable`; a readable untrusted report is
`unverified`; invalid or unsuccessful trusted evidence is `rejected`.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
