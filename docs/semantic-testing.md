# Semantic testing pilots

These pilots exercise execution routing, adaptive attempt sequences, and QTI 1.2 choice
migration. They extend the independent-oracle rules in [spec regression testing](spec-regression-testing.md).
They do not establish complete QTI conformance or replace browser, schema, and external certification checks.

## Deterministic PR checks

`pnpm test:semantic` runs the focused suites. They also run under `pnpm verify`.

- Execution acceptance checks twelve unsupported features both with and without a declared
  outcome, through both public parser entry points. Existing positive cases check fixed delivery
  and default outcome initialization. Diagnostic codes and severity must agree; source offsets
  correctly change when XML changes.
- Adaptive sessions enumerate every sequence of one to three actions from respond, begin,
  score, finish, suspend, and restore (258 sequences). An independently authored XML fixture
  awards one point per accepted processing turn and completes only on finish. The test model
  tracks only earned points and closure. Every rejected action must leave the entire serialized
  state unchanged. Restoration crosses JSON and the public state validator. A frozen clock
  removes timing noise. The fixture also runs through the pinned official schema gate.
- Choice migration covers all combinations of two source response identifiers, two shuffle
  settings, three correct answers, and three pinned positions (36 cases). Each case exercises
  eight presentation seeds and every valid single response, including unanswered. The source
  scoring program explicitly awards one point for its named answer. Migration normalizes the
  response identifier to RESPONSE. Grade expectations never come from the migrated answer key.
  Tests validate migrated items and preserve presentation through JSON restoration with a
  different supplied seed. Both pinned correct answers and pinned distractors are covered.

The existing migration scoring-fidelity suite also runs in the pilot command. It checks explicit
source grades and refusal of unpreserved scoring programs under both normal and safe repair.

The [synthetic challenge collection](../tests/fixtures/challenges/README.md) also runs in this
command. It combines bounded partial credit across multiple responses and adaptive hints,
penalties, retries, feedback, and completion. Literal grade tables and step-by-step journey
expectations remain independent of the implementation. Each scenario also runs with JSON
restoration at action boundaries; the exact fixture XML is registered in the official schema gate.

The existing Playwright test `restored adaptive completion locks responses and reports rejected
host mutations` in `tests/browser/player-lifecycle.spec.ts` covers browser locks and events.
It remains part of the full release check; Node sequences make no DOM claim.

## Semantic mutation gate

`pnpm check:semantic-mutations /tmp/semantic-mutations.json` first requires every pilot test
in a temporary source copy to pass. It then injects nineteen curated faults, one at a time:

- ignore declared outcomes when choosing test execution;
- allow mutations after adaptive completion;
- discard restored outcomes;
- invent the first choice as the migrated answer key;
- discard imported shuffle;
- discard pinned-choice attributes;
- ignore mapping upper bounds in the partial-credit challenge;
- retain non-adaptive outcomes between scoring invocations;
- reset adaptive outcomes between scoring invocations;
- retain a stale hint trigger when another action submits the item.

The [ten-question challenge collection](../packages/fixtures/CHALLENGES.md) adds nine faults:
discard template answer keys, include an excluded tolerance boundary, shift ordered indexes,
drop default mapping penalties, ignore string case policy, count overlapping target areas,
include an excluded lookup boundary, use population variance for sample variance, and ignore
an adaptive stage's exit rule. These faults must fail assertions in the new collection.

Each fault must produce a failure in its designated behavioral suite, with the same collected
cases as the baseline. Skips, collection errors, timeouts, and a changed mutation anchor fail the
check. A surviving fault fails the gate. The optional JSON report records the actual failing
case names; these are replay inputs, not a coverage percentage. Dependencies are reused, but
source edits occur only in the temporary copy, removed on exit.

`pnpm release:check` includes this gate, so ordinary PR CI runs it. When production code changes
shape, review the fault's meaning and update its exact source anchor. Do not remove a surviving
fault just to make CI pass. A syntactically invalid fault is an invalid experiment, not evidence
of regression protection.

## Extended scheduled checks and reproduction

The nightly and manually dispatchable `Extended semantic tests` workflow runs:

```sh
QTI3_EXTENDED_SEMANTICS=1 pnpm test:semantic
```

This enumerates all sequences up to length five (9,330 sequences) and uses 64 presentation seeds.
The workflow uploads test results and mutation evidence. Sequence names contain the complete
ordered replay. Migration assertion messages contain the source parameters, presentation seed,
and response. Run a sequence again with Vitest's `-t` filter and the same extended setting.

Sequences are enumerated shortest first, so the report includes shorter failing cases where
available; there is no automatic general-purpose shrinker. Seed loops report the first failing
seed within each matrix case. Keep a minimized permanent regression whenever a new defect is
found, even if generation also detects it.

## Next boundaries

The bounded pilots deliberately do not model all session behavior. Extend them with independent
models for attempt counts, advancing clocks, template visibility, feedback triggers, and PCI
state. Add multiple-response and partial-credit source scoring programs to migration coverage,
including explicit refusal under safe repair. Register new precise spec claims in the existing
conformance ledger rather than creating a second support catalog. Review expected behavior
separately from implementation changes; automated generation cannot establish that its oracle
is correct.
