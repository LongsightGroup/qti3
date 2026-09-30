# Ten QTI 3 challenge questions

These are ten new MIT-licensed questions, in addition to the earlier planets and hints/retries
fixtures. Each has its own XML document, subject matter, and scoring program.

Start `pnpm dev`, open the displayed local URL, and select a **Challenge** from the reference
fixture picker. Challenges 01–09 are under **Processing references**; Challenge 10 is under
**Adaptive references**. Click **Load fixture**. Use **Score attempt** for 01–09 and
**Check mission** for 10. Reset between independent scenarios. Choice positions may shuffle;
identify choices by their names.

## Questions and answers

| Question                                                        | Try this                                                        | Expected result                                          | Boundary exercised                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [01 — Garden](xml/challenge-garden.xml)                         | Area 12, perimeter 14                                           | 3 points; area alone earns 2                             | Two template-derived answer keys, printed variables, MathML substitution, and restoration                         |
| [02 — Sensor](xml/challenge-sensor.xml)                         | 99.5 and Celsius; then 101 and Celsius                          | 1 point, then 3                                          | Asymmetric tolerance with excluded lower and included upper bounds, plus an independently scored unit             |
| [03 — Spaceflight](xml/challenge-flight-order.xml)              | Ignition, Liftoff, Enter orbit, Landing                         | 4; swapping the middle two earns 2                       | Positional partial credit over an ordered response, shuffled presentation, and keyboard reordering                |
| [04 — Planet types](xml/challenge-planet-types.xml)             | Mercury and Venus → Rocky planet; Jupiter → Gas giant           | 9; Mercury → Gas giant alone earns −2                    | Reused matching targets, directed pairs, unequal weights, and negative scores without a floor                     |
| [05 — Water cycle](xml/challenge-water-cycle.xml)               | water, water vapor, water                                       | 3; replacing water vapor with ice earns 1                | A reusable source token fills two distinct gaps; partial assignments and restored pair collections                |
| [06 — Names and symbols](xml/challenge-unicode.xml)             | Co and QUÉBEC                                                   | 3; CO and Québec earns 1                                 | Different case policies across responses, accented text, and significant spaces                                   |
| [07 — Target](xml/challenge-target.xml)                         | One shot in the centre circle and one in the surrounding square | 3; two shots in the circle earn 2                        | Overlapping areas, authored priority, deduplication by region, and penalties for misses                           |
| [08 — Lab badge](xml/challenge-lab-badge.xml)                   | 80; then 80.001                                                 | Silver; then gold                                        | Exclusive interpolation boundary driving modal feedback; zero and NULL also covered                               |
| [09 — Weather statistics](xml/challenge-weather-statistics.xml) | Mean 2, sample variance 21                                      | 3; using population variance 14 earns only 1             | Statistics over an ordered numeric template container, derived keys, and a denominator-error control              |
| [10 — Mars mission](xml/challenge-mission.xml)                  | Choose Mars and check; enter 2 moons and check again            | 1 point after stage one, 3 and completed after stage two | Integrated feedback reveals a new interaction; retained stage state, early exit, restoration, and completion lock |

For the target question, the centre is at (80,80), the circle radius is 30, and the square
runs from (20,20) to (140,140). The manual supplies `challenge-target.svg`; standalone users
must provide that image alongside the XML.

The sensor's tolerance is an authored acceptance rule, not a claim about actual instrument
accuracy. The lab badge question is an interactive classification exercise: scores above 80
receive gold, 50 through 80 receive silver, and lower scores receive retry feedback.

## Why these tests were added

Existing suites such as `processing-mapping.test.ts`, `processing-template.test.ts`,
`order-response-contracts.test.ts`, and `player-mathml.spec.ts` cover individual operators and
interactions. The added evidence is their composition into full items: grading after each
response crosses JSON restoration, then browser entry, scoring, and restoration of that same
item. This is additional coverage of selected combinations, not a claim that those features
previously had no tests.

The Node suite has 53 fixed-answer cases and one multi-turn mission sequence. Expected scores
are literal values independent of the parser and scorer. For the weather data −3, 3, 6, the mean
is 2 and the squared deviations sum to 42; sample variance is 42 ÷ 2 = 21. The garden's area
is 3 × 4 = 12 and perimeter is 2 × (3 + 4) = 14.

The browser suite loads all ten through the picker, enters answers through controls, checks
scores and restoration, and runs axe before and after interaction. It also checks MathML
namespaces and substituted numeric tokens, keyboard ordering, reused match/gap choices,
target-image loading, selected feedback, and the mission's hidden/revealed field and completion
lock. These checks do not replace manual screen-reader testing or establish full QTI conformance.

Run:

```sh
pnpm test:semantic
pnpm exec playwright test tests/browser/player-challenges.spec.ts --project=chromium
pnpm check:test-xsd
pnpm check:semantic-mutations
```

The exact fixture XML is checked against the pinned official schema. Nine additional mutation
checks prove detection of dropped template keys, tolerance and lookup boundary mistakes,
wrong ordered indexes, lost penalties, wrong case policy, overlapping area double counting,
the variance denominator error, and ignored adaptive exit rules. Faults are injected only into
temporary source copies.

Semantics follow the [QTI 3.0.1 information model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html)
and the repository's [independent regression rules](../../docs/spec-regression-testing.md).
