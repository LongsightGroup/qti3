# Synthetic QTI 3 challenges

These MIT-licensed items combine supported features to test scoring and session behavior.
They complement the small reference fixtures. They do not establish browser rendering,
accessibility, or complete QTI conformance.

`packages/core/src/challenge-items.test.ts` exercises both XML files through parsing,
semantic validation, response submission, scoring, and JSON restoration. The official
schema gate validates the exact XML used by the tests.

## Partial credit

`partial-credit.xml` asks learners to select rocky planets and enter Uranus's position from
the Sun. The choices shuffle, so identify them by planet name rather than screen position.
Mars (internal identifier A) earns 3 points, Venus (B) earns 2, Jupiter (C) loses 4, and
Saturn (D) uses the default penalty of 1. The choice subtotal is bounded to 0–4.
Uranus is seventh from the Sun. The numeric answer earns 3 for seven,
loses 2 for an incorrect number, and earns zero when unanswered. The total is bounded to 0–5.

The suite checks ten evidence selections against four measurement responses, both with
and without restoration. Fixed expected results cover empty and unanswered responses,
reordered selections, penalties before clamping, unmapped choices, and zero as an actual
answer. Repeated scoring must not accumulate points. Clearing answers after scoring must
clear the previous grade. Restoration occurs between responses and after scoring, with a
different presentation seed so a regenerated shuffle cannot pass unnoticed.

## Adaptive hints and retries

`adaptive-retries.xml` awards six points for a correct answer, minus one for every hint and
failed submission, with a floor of zero. A hint does not count as a failed submission.
Three failed submissions close the item. These are authored item rules, not universal QTI rules.

Six independently specified journeys check immediate success, a hint followed by host
submission, interleaved hints and failures, clearing an incorrect response, exhausted retries,
and hints exceeding the available points. Each journey runs uninterrupted and with JSON
restoration before and after each significant action, including between answering and scoring.

Assertions cover scores, hint and failure counters, attempt counts, end-attempt trigger values,
the selected modal feedback, and completion. Completed sessions must reject subsequent
mutations without changing saved state. Feedback selection is checked in Node; visible DOM
and keyboard behavior require separate browser coverage.

## Verification and fault detection

Run `pnpm test:semantic` for the behavioral suite and `pnpm check:test-xsd` for official
schema validation. `pnpm check:semantic-mutations` injects four challenge-specific faults:
ignoring mapping upper bounds, retaining non-adaptive outcomes, resetting adaptive outcomes,
and retaining stale hint triggers. Each must fail a challenge assertion with the full test
collection intact. Faults are applied only in temporary source copies.

The independent-oracle and fixture rules are in
[spec regression testing](../../../docs/spec-regression-testing.md). Normative semantics come
from the [QTI 3.0.1 information model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html):
§4.6 response processing; §§5.88.1–2 and 7.22 response mappings and bounds;
§4.1.7 adaptive outcome retention; and §5.45 end-attempt interactions.
