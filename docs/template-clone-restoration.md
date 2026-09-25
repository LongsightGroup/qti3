# Template clone restoration

Attempts with template-processing rules include this field in `qti3.attempt-state.v1`:

```json
{
  "templateProcessing": {
    "schema": "qti3.template-processing.v1",
    "seed": "candidate-item-seed",
    "environment": {
      "numAttempts": 0,
      "duration": null,
      "context": {
        "candidateIdentifier": "",
        "testIdentifier": "",
        "environmentIdentifier": ""
      }
    }
  }
}
```

The seed is a string or finite number. It is the seed used by the initial session:
the host's `randomSeed`, or the item identifier when no seed was provided. Restore
uses the saved seed even when the host supplies a different `randomSeed` option.
Generation also uses the saved built-in environment, even when the resumed session's
attempt count, timing, or host context has changed. Response processing continues to
read the current built-ins. Duration is frozen at generation start for template
processing; response processing retains the live duration clock.
Malformed metadata and unknown metadata versions are rejected by attempt-state
validation. Restoring a templated item without generation metadata is rejected;
saved template values alone cannot reconstruct random operations that directly
assigned correct responses or defaults.

Restore runs template processing once, starting from the authored declarations and
saved seed. This reconstructs the generated template values, correct responses,
response defaults, and outcome defaults before restoring candidate responses and
current outcomes. It also reconstructs the default-value expression overrides used
by response processing. Constraint retries consume the same random sequence.

Replay requires the same authored item and deterministic custom
operators. Hosts must keep the item's processing rules and custom operator behavior
stable throughout an attempt. External nondeterministic custom operators are outside this replay
contract. This metadata preserves template generation; it does not checkpoint the
random sequence of subsequent response-processing runs.

The metadata contains no generated answer keys or declaration defaults. Treat it,
like the rest of authoritative attempt state, as trusted host persistence when
scoring on a server; validating the shape does not authenticate its provenance.
Keep the full authored item and its processing rules on the server when answers
must remain private. Candidate-safe delivery continues to strip those rules and
answer material. A generation seed is not an encryption key or a secrecy boundary.
