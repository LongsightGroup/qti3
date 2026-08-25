# Plan 037: Add CLI commands for trusted scoring and candidate-safe delivery XML

## Status

DONE — P2, M effort. Completed 2026-08-25.

The CLI now delegates server-trusted scoring and candidate-safe delivery preparation to the core
APIs with strict command-specific argument parsing and filename-specific JSON/I/O errors. Static
and adaptive result/output behavior, malformed inputs, core diagnostics, QTI value validation, and
write-failure safety are covered through `main`; full verification passes without dependency
changes.

## Why

Core exposes `scoreQtiItemServerSide` and `prepareQtiDeliveryXml`, but the zero-runtime-dependency
CLI does not expose them. Small file-oriented commands would make the trusted server boundary
usable in scripts without duplicating engine logic.

## Scope

- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- CLI README/usage documentation and package changelog, if present
- No core behavior changes

## Command contracts

### `qti3 score <item.xml> --responses <responses.json>`

The JSON file is an object keyed by response identifier. Each value uses core's `QtiValue` JSON
shape. The command reads item XML and calls:

```ts
scoreQtiItemServerSide({ itemXml, trustedResponses: responses });
```

It writes the complete `QtiServerScoringResult` as JSON. Exit 0 only when `result.ok` is true;
malformed arguments, unreadable/invalid JSON, invalid QTI, or failed scoring exit 1.

### `qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>]`

`static` is the default and rejects `--state`. Adaptive mode requires a state JSON object with
`outcomes` and optional `templateValues`, both using core `QtiValue` shapes. The command calls
`prepareQtiDeliveryXml` with the matching options. Without `--out`, it writes the full result JSON
including `candidateSafeXml`; with `--out`, it writes XML only when `ok` and
`candidateSafeXml !== undefined`, and prints a JSON summary without duplicating the XML. Exit 0
only on successful preparation and successful output write.

## Implementation

1. Import the two core functions and their input value types; do not reimplement scoring,
   response processing, redaction, or adaptive materialization.
2. Add strict argument parsers. Reject unknown, repeated, missing-value, and mode-incompatible
   flags with command-specific usage text.
3. Add a shared JSON-object reader that reports the filename and parse/type failure without a
   stack trace. Validate the top-level command shapes before calling core; let core diagnose QTI
   values and item semantics.
4. Add the commands to global usage and documentation, with examples that state the trust
   boundary: response/state files are server-trusted inputs, not browser submissions.
5. Test success and failure paths through `main`, capturing stdout/stderr and using temporary
   files. Cover malformed JSON, wrong top-level shape, missing required flags, static/adaptive
   mode errors, core diagnostics, output-file behavior, and exit codes.

## Acceptance criteria

- Both commands delegate to the existing core APIs and emit structured diagnostics.
- No command treats browser-provided outcomes or template values as trusted implicitly.
- Output files are written only on successful delivery preparation.
- Existing commands and exit codes remain unchanged.
- `qti3-core` and `qti3-cli` gain no third-party runtime dependency.

## Stop conditions

- Stop before inventing a second serialized attempt-state contract. If the CLI must accept a full
  `QtiAttemptStateV1`, define that as a separate versioned command/API design.
