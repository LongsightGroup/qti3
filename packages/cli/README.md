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
qti3 score-correct item.xml
qti3 inspect-package package.zip
qti3 validate-package package.zip
qti3 support-matrix
qti3 a11y-proof
qti3 run-fixtures
```

## Commands

- `parse <item.xml>` emits the parsed item model as JSON.
- `validate <item.xml>` emits validation diagnostics as JSON.
- `score-correct <item.xml>` scores an item using its authored correct response.
- `inspect-package <package.zip>` inspects a QTI package zip and item references.
- `validate-package <package.zip>` performs strict package validation for conformance
  checks.
- `write-fixtures <directory>` writes the canonical fixture XML files.
- `support-matrix` emits supported, deprecated, and processing support metadata.
- `a11y-proof` emits accessibility proof metadata.
- `assert-support` checks release support evidence.
- `run-fixtures` runs the canonical fixture suite.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
