# @longsightgroup/qti3-cli

Command-line tools for QTI 3 item parsing, validation, scoring, package inspection,
fixture generation, support reporting, and release checks.

The CLI has zero third-party runtime dependencies. Package manifest parsing uses the same
dependency-free XML parser as `@longsightgroup/qti3-core`.

## Install

```sh
npm install -D @longsightgroup/qti3-cli
```

## Use

```sh
qti3 validate item.xml
qti3 score item.xml --responses trusted-responses.json
qti3 score-correct item.xml
qti3 prepare-delivery item.xml --out candidate.xml
qti3 prepare-delivery adaptive.xml --mode server-materialized-adaptive --state trusted-state.json --out candidate.xml
qti3 inspect-package package.zip
qti3 validate-package package.zip
qti3 certification import-basic-items --qti-root /path/to/qti-conformance/qti3.0
qti3 certification import-basic-tests --qti-root /path/to/qti-conformance/qti3.0
qti3 support-matrix
qti3 a11y-proof
qti3 run-fixtures
```

## Commands

- `parse <item.xml>` emits the parsed item model as JSON.
- `validate <item.xml>` emits validation diagnostics as JSON.
- `score <item.xml> --responses <responses.json>` applies a server-trusted response object and
  emits the complete scoring result, including diagnostics, state, responses, outcomes, and score.
- `score-correct <item.xml>` scores an item using its authored correct response.
- `prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>]
[--out <candidate.xml>]` prepares candidate-safe XML. Static mode is the default and rejects a
  state file. Adaptive mode requires a state object containing `outcomes` and optional
  `templateValues`. Without `--out`, the command emits the complete preparation result; with
  `--out`, it writes XML only after successful preparation and emits a JSON summary.
- `inspect-package <package.zip>` inspects a QTI package zip and item references.
- `validate-package <package.zip>` performs strict package validation for conformance
  checks.
- `certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>]`
  runs the QTI 3 Basic IMPORT item-only evidence map against a checked-out 1EdTech
  conformance tree. The report reads the official package zips, filters manifest item
  resources, and ignores convenience test resources.
- `certification import-basic-tests --qti-root <qti-conformance/qti3.0>` runs the QTI 3
  Basic IMPORT test-structure evidence map against the official T4/T7 package.
- `write-fixtures <directory>` writes the canonical fixture XML files.
- `support-matrix` emits supported, deprecated, and processing support metadata.
- `a11y-proof` emits accessibility proof metadata.
- `assert-support` checks release support evidence.
- `run-fixtures` runs the canonical fixture suite.

The response and adaptive-state JSON files are trusted server inputs. Do not pass browser-submitted
outcomes or template values to these commands without validating them at the host trust boundary.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
