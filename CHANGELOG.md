# Changelog

## Unreleased

### Added

- Parse flat fixed-test section ordering with `parseQtiFixedTestOrdering` and generate or
  restore per-attempt question orders with `prepareQtiFixedTestOrder`. Fixed reference
  positions and part/section boundaries remain intact. Invalid saved permutations and
  unsupported selection, branching or nested-section policies return diagnostics.
- Write section shuffle rules and fixed item-reference hints with the fixed-test writer,
  preserving authored question order in the canonical XML.

### Fixed

- Emit modal feedback inside the required QTI content-body element. Plain and rich
  feedback now pass official schema validation while retaining visibility and safe rendering.

## 0.13.2 - 2026-10-07

### Added

- Parse static assessment, part and section rubrics with `parseQtiTestRubrics`, preserving
  their authored owners. `createCandidateTestRubricDelivery` filters candidate audiences
  through the existing safe content projection. Dynamic rubric content and test execution
  with rubrics remain explicit unsupported cases.
- Decode serialized host content with `parseSafeContentProjection`. The typed boundary
  checks tree shapes and limits, reapplies sanitization and resolves authorized assets.

### Fixed

- Validate and resolve video poster URLs through the image asset policy. Discover package
  poster references, diagnose missing images and preserve posters in media interaction
  rendering. Packaged posters decode with their original bytes and media type.
- Apply each rendered attribute's URL policy to host-resolved assets. Resolvers must return
  URLs suitable for the image, navigation, object, media or track sink; incompatible data
  URLs are removed.
- Pin reviewed transitive development security patches without weakening the dependency
  audit or changing runtime dependencies.

## 0.13.1 - 2026-10-01

### Added

- Add twelve synthetic, MIT-licensed challenge items covering partial credit, negative
  mappings, adaptive hints and retries, positional scoring, numeric tolerance boundaries,
  reused matching and gap choices, Unicode case policies, overlapping target regions,
  lookup feedback, template-derived statistics, and staged completion. Fixed expected
  results, browser regressions, official schema checks, and semantic mutation checks
  exercise these combinations. See [the ten-question challenge guide](packages/fixtures/CHALLENGES.md)
  and [partial-credit and retry scenarios](tests/fixtures/challenges/README.md).
- Add scoring rules and example answers for the ten manual challenges. Flight ordering
  reports the number of stages in the correct position; lab results report the earned badge.
- Add a separate [integration guide](https://longsightgroup.github.io/qti3/integration.html)
  with player installation, XML loading, scoring, and links to core and framework adapters.

### Changed

- Place host scoring controls and results beneath the item in the interactive manual.
  Organize responses, outcomes, XML, diagnostics, events, metadata, and accessibility
  evidence into keyboard-accessible tabs. Collapse the PNP editor and event logs initially.
- Run schema-heavy area-scoring scenarios as individual tests so each schema validation
  has its own timeout. Preserve the existing scoring and diagnostic assertions.

### Fixed

- Preserve QTI 2.0 choice grades when response processing uses the QTI 2.0 or QTI 2.1
  `match_correct` template. Unsupported scoring programs remain explicit migration failures.
- Preserve QTI 2 item language, surrounding content order, hottext response cardinality,
  and extended-text pattern masks during migration. Keep hotspot instructions, region
  labels, and object descriptions.
- Reject migrations that would discard QTI 2 modal feedback, change response declaration
  types, lose matching-group restrictions, or omit QTI 1.2 responses. These failures return
  typed diagnostics and withhold successful migrated XML, including with safe repair enabled.
- Preserve ordered QTI 1.2 material content, including HTML text and images. Keep plain text
  literal instead of interpreting it as markup. Reject malformed HTML, unsupported text
  types, and material references that cannot be preserved.
- Allow dragging plain order choices from their visible labels. Buttons and links inside
  those choices remain excluded from dragging. A Chromium regression checks reordering
  in both directions and the resulting partial-credit scores.
- Clear stale manual scoring results and challenge explanations when an attempt resets
  or is restored.

### Compatibility notes

- Migration now rejects additional inputs whose content or scoring constraints cannot be
  preserved. Review the returned diagnostics when a previously accepted item no longer
  produces migrated XML.

## 0.13.0 - 2026-09-27

### Added

- Score an end-attempt interaction with `session.score({ endAttemptResponseIdentifier })`.
  That response is true for the invocation and every other end-attempt response is false.
  Ordinary `session.score()` sets all of them to false. Declaration defaults are ignored.
  Server scoring, adaptive turns, submission materialization, and the browser player accept
  the same identifier. An unknown identifier returns `session.endAttempt.identifier` and
  leaves the session unchanged.
- Record successful response processing on attempt state as optional
  `responseProcessingCompleted`. An absent marker means processing has not been recorded.
  `session.initialOutcomeValue(identifier)` returns the effective initial outcome after
  template processing, independently of restored or scored outcomes.
- Place surrounding item content with writer `itemBodyHtml`. The fragment must contain
  exactly one empty `<qti-interaction-placeholder/>`. Malformed templates return
  `invalid_item_body_template`. `buildQti3RubricBlock()` writes a validated rubric
  fragment. Core exports `validateQtiRubricFragment()`, `QTI_RUBRIC_VIEWS`, and
  `QTI_RUBRIC_USES`.
- Check reviewed QTI 3.0.1 information-model claims with `pnpm check:information-model`.
  `pnpm test:semantic` and `pnpm check:semantic-mutations` exercise execution routing,
  adaptive attempt sequences, and QTI 1.2 choice migration, including curated fault
  injection. `pnpm release:check` runs the mutation gate. See
  [information-model conformance](docs/information-model-conformance.md) and
  [semantic testing](docs/semantic-testing.md).

### Changed

- `beginAttempt()`, `respond()`, `setInteractionState()`, and `setStatus()` return
  diagnostics. An empty array means the mutation was accepted. A completed adaptive
  session rejects further responses and scoring with `session.completed` and stays
  closed after restore. Read-only adaptive-turn refreshes remain available.
- Bind standard writer scoring to the authored response identifier. The `RESPONSE`
  identifier still uses the standard template. Other identifiers use equivalent inline
  rules, and unanswered `map_response` and `map_response_point` scores are 0. Choice
  feedback uses the same NULL-safe mapping rules.
- Resolve numeric operator attributes, including `{identifier}` references, for
  `qti-round-to` figures, `qti-equal` tolerances, and `qti-random-integer` /
  `qti-random-float` bounds and integer step. A zero step, inverted bounds, or other
  invalid runtime value yields NULL.
- Require order and graphic-order responses to contain every available choice exactly
  once, unless `min-choices` requests a subset. Incomplete saves may contain partial
  orders, but never duplicate or unknown identifiers. Response validation of a
  template-controlled choice domain requires explicit `templateValues` and returns
  `response.templateValues.required` when that clone context is omitted. Restore uses
  the saved clone's values.
- Require each rubric block to have `view`, `use`, and one `qti-content-body`. Nested
  rubrics and interactions inside rubrics are errors. A valid `ext:` use warns that no
  custom policy is configured. Rubric-local stylesheets and catalogs return
  `rubric.resource.unsupported`. Candidate rubric sections keep source order. Both
  `qti-rubric-inline` and `qti-rubric-discretionary-placement` pass through; the default
  player does not relocate them.
- Validate test delivery with the same closed profile as `parseQtiTest`. Declared
  outcomes or outcome processing select the test runtime even without branching. A
  `fixed` result requires one linear, individually submitted part with flat visible
  sections. Time limits, inherited item-session controls, test and part feedback, test
  rubrics, nested or referenced sections, weights, variable mappings, template defaults,
  and unknown extensions are rejected. Package interchange can still preserve that
  metadata. See the
  [test execution acceptance review](docs/test-execution-profile-review.md).
- Reject QTI 2 migration that would invent scoring, discard outcomes, drop nonzero
  `matchMin`, change correct responses, or drop template declarations and template
  processing (`qti2_response_processing_not_preserved`, `qti2_outcomes_not_preserved`,
  `qti2_match_min_not_preserved`, `qti2_correct_response_not_preserved`,
  `qti2_template_not_preserved`). Adaptive items return `qti2_adaptive_not_preserved`.
  QTI 2 rubric blocks keep their `view` audiences, gain a `qti-content-body`, and use
  `use="instructions"`. Hottext and gap match keep prompts, surrounding body content,
  and the original interaction position. Explicit numeric zero defaults match implicit
  numeric zero defaults. XML Boolean `fixed`, including `fixed="1"`, pins a choice.
  These failures withhold migrated XML unless the caller requests a review stub.

### Fixed

- Compare unordered response containers with an ordering consistent with exact value
  equality. Reordering composed and decomposed Unicode strings no longer changes
  `qti-match` results; ordered containers and duplicate counts remain significant.
- Check assignment types and numeric operand types before processing. Dynamic results
  from custom operators and record fields are checked before assignment, so invalid
  values cannot produce a successful score that fails on restore. Numeric operators
  no longer coerce Boolean or string operands into numbers.
- Return NULL with `processing.numeric.nonFinite` when an expression produces a
  non-finite number, keeping overflow out of subsequent operators and saved attempt
  state. Prevent GCD and LCM from hanging on non-finite inputs or intermediate results.
  Compute LCM by dividing before multiplying to avoid unnecessary overflow.
- Use the requested mapping when a response declares both `qti-mapping` and
  `qti-area-mapping`. Standard mapping templates use the same evaluator as inline
  expressions, including its overflow checks.
- Score default area mappings against the associated image bounds, preserving area priority
  and once-per-area counting. Report missing image dimensions instead of guessing.
- Reject non-finite test outcomes and branch expressions without committing a submission.
  `startQtiTest` now returns `QtiTestResult<QtiTestSession>` so startup processing failures
  use the same diagnostic channel as submission and restoration.
- Require explicit numeric assignment conversions, Boolean processing conditions, and typed
  lookup inputs with a declared table. Reject variance and standard deviation inputs with
  fewer than two observations instead of returning zero.
- Validate lookup-table targets and defaults against the declared outcome base type.
  Invalid text values can no longer pass validation for numeric outcomes.
- Evaluate `acot` as `atan(1/x)`, `acsc` as `asin(1/x)`, and `asec` as `acos(1/x)`.
  Values outside the real domain still return NULL.
- Keep modal feedback tied to successful response processing. Response edits retain the
  marker. Starting another processing invocation clears it, and only a successful
  invocation sets it again. Failed rescoring does not present modal feedback from
  partially updated outcomes. Fresh attempts, including after restoration, have no modal
  feedback. Completed nonadaptive review with `sessionControl.showFeedback: false`
  suppresses modal feedback and uses the effective initial outcome defaults. Adaptive
  review keeps final feedback when that flag is false.
- Keep a player scoring failure from marking the attempt completed. Host error reporting
  is unchanged.

### Compatibility

- Processing programs with incompatible assignment types or numeric operands now return
  `processing.assignment.type` or `processing.operand.type`. Dynamic violations return
  NULL with an error diagnostic. The template-processing reference fixture now declares
  its numeric response as `integer` to match its generated answer.
- Inline `qti-map-response` and `qti-map-response-point` require their corresponding
  mapping. A missing mapping returns `processing.mapping.required`; an answer key or
  the other mapping type no longer substitutes for it.
- `beginAttempt()`, `respond()`, `setInteractionState()`, and `setStatus()` return
  `QtiDiagnostic[]`. Completed adaptive items reject those mutations and further
  `score()` calls with `session.completed`.
- End-attempt responses no longer keep declaration defaults. Each `score()` invocation
  sets exactly one trigger to true, or all of them to false for ordinary host submission.
- Parsed `qti-random-integer`, `qti-random-float`, `qti-round-to`, and `qti-equal-rounded`
  figure and bound fields keep their source attributes, including variable references,
  instead of numbers resolved at parse time.
- `acot`, `acsc`, and `asec` now use the reciprocal inverse functions.
- Tests that previously classified as `fixed` while carrying time limits, session
  controls, feedback, rubrics, nested sections, weights, variable mappings, or template
  defaults are rejected at execution. Interchange can still store them.
- Order responses that are not a complete permutation of the available choices fail
  validation, except partial orders allowed by `min-choices` or incomplete saves.
  Template-controlled domains require `templateValues`.
- QTI 2 items that migrated by inventing an answer key, dropping outcomes, dropping
  `matchMin`, or dropping template processing are now refused.
- Attempt states saved before 0.13.0 omit `responseProcessingCompleted`. Restore treats
  that absence as processing not recorded, so modal feedback stays hidden until the
  attempt is scored successfully again.

## 0.12.3 - 2026-09-25

### Added

- Shuffle choice, order, inline choice, associate, match, and gap match for the life of an
  attempt. Missing `shuffle`, `false`, and `0` keep authored order. `true` and `1` shuffle.
  `fixed="true"` keeps an eligible choice at its initial index. Graphic coordinates and passage
  gaps stay in authored positions. Template-hidden choices leave the set before the remaining
  choices are ordered.
- Save the resolved order in attempt state as `presentation` (`qti3.presentation.v1`).
  `sessionOptions.presentationSeed` reproduces a fresh presentation and is independent of
  processing `randomSeed`. Restore requires that saved order. Incompatible identifiers return
  typed diagnostics and leave the previous session in place. Headless hosts read
  `session.presentation()` before rendering. Scoring uses the response, separate from display
  order. See [interaction shuffling](docs/interaction-shuffling.md).

### Changed

- Restore a templated item by replaying template processing once from saved
  `templateProcessing` metadata (`qti3.template-processing.v1`). Replay uses the original seed
  and the built-in environment from generation time, including when the host later supplies a
  different `randomSeed`. The same item and deterministic custom operators are required.
- Treat empty strings and empty containers as NULL for every expression result, including
  intermediate values. The standard `map_response` and `map_response_point` templates score an
  unanswered response as 0 and skip mapping bounds. A direct `qti-map-response` of NULL starts
  at 0 and then applies authored bounds. Numeric, Boolean, pair, and directedPair map keys
  match by typed value, so integer `01` matches `1` and an unordered pair matches in either
  order. String keys follow each entry's `case-sensitive` setting. A space-only string stays a
  string.
- Keep multiple and ordered declaration defaults as containers, including empty containers,
  through processing and restore.
- Preserve significant whitespace in string text-entry correct responses and mapping keys.
  Integer and float values are trimmed before they are written.
- Reject QTI 2 response mappings, defaults, and response-processing programs the writer cannot
  reproduce. That includes weighted choice mappings, changed inline rules, and unknown or
  altered templates. Reject QTI 1.2 scoring beyond one positive conjunction that sets `SCORE`
  to 1 with a zero default, including Canvas matching that adds points per pair. These
  diagnostics withhold migrated XML unless the caller requests a review stub. Safe repair keeps
  the rejection.
- Preserve QTI 1.2 `shuffle`, and convert `rshuffle="No"` to fixed choices. Canvas matching can
  keep one shared target shuffle with fixed sources. Conflicting list settings return
  `qti12_canvas_match_shuffle_conflict`. An explicit `shuffle` on graphic gap match, including
  a false value, returns `qti2_graphic_gap_shuffle_unsupported`.

### Fixed

- Allow one placement in each ordinary gap. `qti-gap` has no `match-max`, so `match-max="0"` on
  a gap-match source does not open a second slot in the same gap. A graphic gap target with
  `match-max="0"` accepts repeated placements.
- Render MathML in the MathML namespace, including `ci`, `cn`, `annotation`, and
  `annotation-xml`. When `math-variable` is `true` or `1`, replace an `mi` template identifier
  with `mn` and a `ci` identifier with `cn`, using the template number as the token text.
  `false` and `0` leave the identifier tokens unchanged.
- Render a `qti-rubric-block` when its `view` list includes `candidate`. Scorer, author, and
  other audience-only rubrics stay out of the rendered DOM, including their links and controls.
  The source XML is left unchanged.

### Compatibility

- Shuffled items saved before 0.12.3 have no `presentation` orders, so restore fails closed.
  Items that do not shuffle load as before.
- Templated attempt states without `templateProcessing` metadata are rejected. Generate the
  variant again and save the new state. See
  [template clone restoration](docs/template-clone-restoration.md).
- Empty strings and empty containers now evaluate as NULL. A standard mapping template scores
  them 0 even when mapping bounds would have applied to that unanswered value. Integer, float,
  Boolean, and unordered pair map keys match equivalent values, including different lexical
  forms. Directed pairs stay ordered.
- Written string text-entry answers keep their surrounding whitespace.

## 0.12.2 - 2026-09-24

### Added

- Write item-level `qti-modal-feedback` for every supported interaction. Declare identifier
  outcomes, show or hide entries, optional titles, and plain text or trusted XHTML. Choice items
  can map each selected choice to its own feedback, including multiple-response selections.
  Invalid configurations return typed diagnostics. The choice `feedback` helper and generic
  `modalFeedback` field cannot be combined, and feedback outcome names must differ from response
  identifiers.
- Parse modal feedback as structured content and flattened text. `parseQtiModalFeedbackFragment()`
  parses a standalone fragment. Forbidden interactions are diagnosed and left out of the content
  tree. With `showFeedback` enabled, the player renders visible feedback, including titles and
  printed variables. The manual includes `rich-modal-feedback-reference` and
  `multiple-choice-modal-feedback-reference`.
- Support `qti-input-width-5` for certification compatibility, without an unsupported-width
  warning or a five-character response limit.

### Changed

- Show compact imported QTI tables in the saved-package library, including attributes,
  declarations, mappings, interactions, and processing. Omit parser bookkeeping and duplicate
  content trees while keeping the original XML available after saving and reopening.
- Write `max-choices="0"` for multiple-response choice items when `maxChoices` is omitted, so
  selection stays unlimited. An explicit `maxChoices` value still takes precedence.

## 0.12.1 - 2026-09-22

### Added

- Show the authored question title above the player in the saved-package library.
- Add response submission and attempt reset to the saved-package library, with scores,
  authored feedback, validation messages, and inspectable response and outcome details.

### Changed

- Validate every manifest-declared item, including items omitted from an assessment test.
  The saved-package library saves and reopens valid questions from mixed packages, excludes
  invalid questions, and reports rejection counts and failing filenames. Package structure errors
  still block import; original files and validation diagnostics remain available after reopening.
- Require certification rejection evidence to come from the packaged item; loose XML can no
  longer substitute for a missing item in the ZIP. Exercise official Basic packages in the library
  when external certification inputs are configured.
- Separate the closed `QtiTestExpression` language from item processing, including parsing,
  type checking, evaluation, and serialization. Preserve test routing and snapshot replay.
- Replace `serializeProcessingExpression()` with `serializeTestExpression()` for test expressions.
- Return binary-choice inspection data in the shared result `value` field, typed as
  `QtiBinaryChoicePolicy`.

### Fixed

- Keep `qti-portable-custom-interaction` on the PCI host for every response cardinality and
  base type, including ordered, multiple, pair, and record responses. Deprecated
  `qti-custom-interaction` remains unsupported.

## 0.12.0 - 2026-09-17

### Added

- Parse and validate finite QTI 3 tests with linear individual submission, fixed item
  references, test outcome processing, forward section branches, and explicit test exit.
  Unsupported routing, backward targets, unresolved references, and invalid expressions
  return structured diagnostics.
- Start, advance, snapshot, and restore a test session with deterministic test outcome processing.
  Restoration replays committed item scores against the pinned test definition.
- Write supported fixed and branching assessment tests from typed models, including
  existing fixed-test timing, instructions, and feedback.
- Inspect whether an ordinary single-choice item produces an authoritative binary score.
- Add synthetic 15- and 100-answer branching fixtures, every reachable score transition,
  package round trips, and an official QTI 3 schema validation check.

This release supplies finite test sequencing. It does not implement a CAT service,
statistical ability estimation, or runtime random item selection.

## 0.11.0 - 2026-09-17

### Added

- Add `readQtiPackageZipEntriesAsync()` with the same archive validation and resource limits
  as the synchronous reader, plus `parseQtiPackageFromEntries()` for importing extracted files.
- Expose `xmlFiles` and `QtiPackageXmlFileSummary` on batch package results so callers can
  classify XML roots and inspect syntax diagnostics without parsing those files again.
- Add a local saved-package library at `/library.html`. It stores original package files in
  IndexedDB and restores item models, XML, media, stylesheets, and diagnostics through core.
- Verify supported official validator reports against the exact package and an explicitly trusted
  report digest. Generate reproducible Basic IMPORT evidence for item models and original asset bytes
  using externally supplied certification content.
- Export `isQtiItemResource()`, `scopeDiagnosticToPackagePath()`, `uniqueDiagnostics()`, and
  `diagnosticKey()` from core for shared package classification and diagnostic handling.

### Changed

- Use core's package graph, ZIP validation, asset resolution, and diagnostics in CLI inspection
  and reference pages. CLI inspect mode still discovers unreferenced items; strict validation rejects
  them. Reference pages require `imsmanifest.xml` for ZIP imports.

### Fixed

- Initialize single integer and float outcomes without an authored default to zero. Preserve
  effective template-set defaults across processing and discard values from rejected template attempts.
- Honor each string mapping entry's case-sensitivity setting, map repeated response values once,
  and use the first authored matching area for each point.
- Evaluate numeric equality tolerances, inclusive bounds, and variable tolerances; return NULL for
  nonnumeric `qti-equal` operands. Resolve `qti-equal-rounded` defaults and variable figures.
- Evaluate arbitrary `qti-is-null` operands and select `qti-random` values from evaluated containers.
  Preserve contiguous ordering for ordered `qti-contains` and apply authored interpolation thresholds.
- Invert `show-hide="hide"` conditions for modal feedback and adaptive candidate XML.
- Resolve and preserve built-in attempt counts, duration, and context across scoring, suspension,
  resume, and state restoration.
- Preserve repeated Graphic Gap Match placements and reject restored responses that exceed
  `match-max` or `max-associations`.
- Implement XML Schema pattern syntax, including name escapes, Unicode classes, and class subtraction,
  with explicit diagnostics for unsupported syntax and resource limits.
- Validate assessment-item child order in core, preserve LOM package titles, and emit schema-valid
  writer package manifests.
- Share diagnostic identity and package-path scoping across core, CLI, and conformance, preserving
  distinct fields containing newlines and keeping diagnostic paths and source locations aligned.

### Compatibility

- A declared numeric `SCORE` without an authored default now starts at `0`. Hosts that used NULL
  to mean unscored should use lifecycle or scoring-disposition information. `qti-default(SCORE)`
  still returns NULL when no default was authored.
- Duplicate mapped values no longer earn repeated credit, and overlapping areas no longer apply
  more than one mapping entry to the same point.
- Use `qti-match` for identifier comparisons; `qti-equal` requires numeric operands.
- Interpolation tables now follow authored descending thresholds. Tables built around the previous
  low-to-high behavior need review.

## 0.10.6 - 2026-09-17

### Added

- Add `createPnpPlayerOptions()` to map resolved personal needs and preferences to keyword
  emphasis and exact catalog selections, with remaining requirements returned for host handling.
- Add exact catalog selection by catalog ID, support, and entry language to core resolution and
  player request policies.
- Add a public manual page for creating QTI 3 items, migrating legacy items, and converting QTI 3
  to explicit QTI 1.2, 2.1, and 2.2 profiles, with diagnostics and previews.
- Export `captureQtiTextResponse()`, `formatQtiTextResponse()`, and `qtiTextResponseString()` from
  `@longsightgroup/qti3-core` for text capture and restoration in custom renderers.

### Changed

- Make core response validation enforce QTI constraints without requiring an answer solely because
  it has a correct response. Hosts can enable `requireScoredResponses`; the browser player enables
  it by default. Explicitly authored zero minimums remain optional.

### Fixed

- Support numeric and record Text Entry responses and single, multiple, ordered, and record
  Extended Text responses, including authored bases, raw-text companions, and string-count limits.
- Restore numeric text in its authored base, reject empty required record responses, and preserve
  original text with null numeric fields when record metadata exceeds safe integer bounds.
- Accept single and multiple association responses, enforce unordered `pair` values for Associate
  and Graphic Associate, and emit Associate choices as direct children.
- Enforce QTI default response maxima and per-choice `match-min` constraints during final response
  validation. Require hotspot targets for Graphic Gap Match and diagnose inline text gaps.
- Parse and render graphic `img` and `picture` assets. QTI 2 exports use legacy `object` elements
  and report a lossy conversion when responsive sources are omitted.
- Lift legacy essay fallbacks out of nested inline containers while preserving surrounding text,
  formatting, and unique IDs.
- Keep release receipt verification synchronized with the expanded graphic and nested-fallback
  schema variants.
- Preserve external grading intent: human- and external-machine-scored items return `score: null`
  and require host grading instead of treating an authored default as a completed grade.
- Ignore response events from controls belonging to a replaced attempt session after restore,
  reset, or item replacement.
- Run the CLI when its entry point is reached through a symlink or a path containing spaces,
  while keeping library imports inert.
- Correct fixture and writer XML structure for End Attempt, Position Object, template declarations,
  MathML, shared-vocabulary Text Entry, and instructional rubric blocks.
- Correct the Match fixture's four-pair answer key, preserve human scoring for the essay fixture,
  and keep planning hints separate from scored answers.

## 0.10.5 - 2026-09-10

### Added

- Add `parseQtiPackageStream()` to `@longsightgroup/qti3-core` for bounded, sequential package
  parsing through a caller-owned entry inventory and `readEntry(path, maxBytes)` function.
- Export `QtiPackageSource`, `QtiPackageStreamLimits`, `QtiPackageStreamEvent`, and
  `QtiPackageStreamSummary` for incremental package staging workflows.

### Changed

- Share package manifest inspection, item parsing, and summary assembly across sync and incremental
  package parsers through `inspectPackageManifest()`, `parsePackageItem()`, and
  `buildPackageSummary()`.

### Fixed

- Upgrade Vitest to `4.1.11` to address a moderate path-traversal advisory in
  `@vitest/mocker` redirect mocks (GHSA-82fw-gwwq-j7x9).

## 0.10.4 - 2026-09-08

### Added

- Add configurable ZIP resource limits for entry counts, expanded sizes, and compression ratios,
  with exported `QtiPackageResourceLimits` and `DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS`.
- Export `QTI_ASI_NAMESPACE` and `MATHML_NAMESPACE` constants from `@longsightgroup/qti3-core`.

### Changed

- Require custom ZIP inflaters to enforce the `maxOutputLength` supplied in their context.
- Upgrade `@xmldom/xmldom` to `0.9.12` in the migrator and transcoder.

### Fixed

- Reject malformed numeric values and unsupported float lexical forms instead of accepting
  partially parsed numbers.
- Validate submitted response base types and authored interaction domains, including choice
  identifiers, directed-pair source and target roles, and slider bounds and steps.
- Normalize validated response values before trusted scoring while preserving the existing
  `validateQtiResponseVariables()` result contract.
- Canonicalize unordered pair values for comparison and mapping, and preserve type and ordering
  information through compound processing expressions.
- Enforce QTI item and package XML namespaces and reject duplicate XML attributes.
- Preserve content namespaces through parsing, serialization, and browser rendering, including
  prefixed MathML content.
- Reject invalid ZIP entries in the CLI and bound package expansion in core and migration paths.
- Normalize writer choice and order identifier references to match emitted identifiers.

## 0.10.3 - 2026-08-25

### Added

- Export context-specific `escapeXmlText` and `escapeXmlAttribute` helpers from
  `@longsightgroup/qti3-core` for dependency-free XML serialization.
- Add `qti3 score` and `qti3 prepare-delivery` commands for server-trusted scoring inputs and
  candidate-safe static or server-materialized adaptive XML.
- Add a typed media play-count domain with native control metadata, pause timing, attempt-state
  support, and browser tests for play counts and pause timers.
- Add a typed slider value domain with decimal-safe bounds and steps, keyboard operation, reverse
  direction, validation, and cross-browser rendering coverage.

### Changed

- Preserve player session options across reset and restore operations, including React and Preact
  adapter reloads.
- Split CLI commands, core tests, and transcoder evidence snapshots into smaller modules. CLI
  commands now share typed parsing, package inspection, and output failures.
- Upgrade Vite and add dependency-advisory, Node.js version-boundary, Playwright artifact, and
  package-export checks to the release pipeline.

### Fixed

- Unload stale player state after a failed item reload and reject unsafe interaction asset URL
  protocols before they reach browser rendering.
- Correct area-mapping multi-match behavior, exact decimal rounding, and `equal-rounded` guard
  boundaries.
- Reject malformed numeric declarations, mixed declaration values, invalid processing arity,
  incomplete `any-n` bounds, and excessive repeat expansion with structured diagnostics.
- Preserve visible text separators during content extraction and reuse canonical package-path
  normalization across CLI package inspection.

## 0.10.2 - 2026-07-28

### Added

- Add a source-derived `canvas-new-quizzes@1` transcoder profile for direct Canvas New Quizzes QTI
  import, with native ordered responses and an explicit unverified product-import evidence status.
- Add `blackboard-question-banks@1` and `brightspace-course-import@1` QTI 2.1 transcoder profiles
  with conservative native mappings, diagnosed manual and text-entry fallbacks, executable support
  evidence, and explicit unverified product-import status.

### Changed

- Make target-specific interaction policies the canonical serializer contract for QTI 1.2, QTI
  2.1, QTI 2.2, Canvas, and Moodle output.
- Split generated transcoder support evidence into per-profile reports while retaining a concise
  generated support index.

## 0.10.1 - 2026-07-24

### Changed

- Treat QTI 3 manifests that declare an assessment-test resource and its dependent item resources
  as assessment packages and resolve their items from the assessment-test structure.

### Fixed

- Preserve declared item-resource identifiers and standards metadata when transcoding assessment
  packages.
- Keep QTI 1.2 assessment containers out of migrated item results by resolving `itemref` entries
  through manifest resource identifiers.
- Honor Sakai QTI 1.2 `qmd_itemtype=Essay` metadata before inferring an interaction from placeholder
  choice markup.
- Use the same slider mapping for packaged and standalone QTI 2.1 migration, including integer
  bounds, steps, correct responses, and mapped scoring values.

## 0.10.0 - 2026-07-24

### Added

- Add `@longsightgroup/qti3-transcoder`, a profile-driven package for converting QTI 3 items and
  packages to QTI 1.2, QTI 2.1, QTI 2.2, Canvas Classic Quizzes, and Moodle XML.
- Add explicit, versioned standard and product profiles with typed per-interaction mapping reports,
  deterministic generated assets, package and assessment-test preservation, and declared fallback
  behavior.
- Add executable profile/interaction evidence, SHA-256-locked legacy schema closures, XSD
  validation for QTI targets, and release checks that keep published support claims synchronized
  with generated output.
- Add native Moodle XML question-bank output and a source-backed Canvas Classic Quizzes
  compatibility profile.

### Changed

- Expand legacy QTI migration coverage and share explicit repair-policy handling across the
  migrator and transcoder.
- Normalize XML boolean parsing across core declarations, processing, catalogs, validation, and
  attempt-state handling.

## 0.9.10 - 2026-07-21

### Added

- Retain raw package entry bytes on `QtiPackageParseResult` for single-pass importer workflows.
- Parse typed assessment-test parts, nested sections, item references, time limits, item session
  controls, and IMS curriculum-standards metadata with structured diagnostics.
- Add public package-content asset discovery and response-processing expression collection helpers.

### Changed

- Evaluate Basic IMPORT conformance from the typed assessment-test hierarchy.
- Expand package media-type detection for HTML, JSON, and M4A importer assets.

## 0.9.9 - 2026-07-21

### Added

- Add catalog host delivery to `@longsightgroup/qti3-player`, including sanitized
  `getCatalogDeliveryResolution()`, live `getRenderedCatalogReferences()`, opt-in
  `catalogRequestPolicy`, native request controls, `requestCatalog()`, and the
  `qti-catalogrequest` event with composed `{ reference, delivery, activation }` detail.
- Add `createCatalogSupportResolution()` language ranking, stable catalog `referenceId`
  identities, nested `data-catalog-idref` discovery inside catalog HTML, and card-level
  language metadata in `@longsightgroup/qti3-core`.
- Add catalog validation for mixed direct card content, card entries, and multiple default
  entries.
- Add synthetic catalog fixtures and browser coverage for request lifecycle, suspend/restore,
  and safe content delivery.

### Changed

- Extract catalog host orchestration into `CatalogHost`, shared safe content projection, and
  focused request-control modules in the player package.
- Extend player content sanitization for catalog media elements and package-relative asset
  resolution through `sanitizeContentAttributes()`.

## 0.9.7 - 2026-07-06

### Added

- Add item-bank QTI 3 package emission to `@longsightgroup/qti3-writer`, including
  `imsmanifest.xml`, item XML files, item-owned asset files, and deterministic ZIP output.
- Add migrator package projection so `@longsightgroup/qti3-migrator` can preserve source manifest
  item paths and asset paths while handing package output directly to the writer.

### Changed

- Split the writer package-emission layer into focused build, manifest, ZIP, and public type modules.
- Reuse core package path normalization and manifest constants across core, writer, and migrator.

## 0.9.6 - 2026-07-05

### Added

- Add `@longsightgroup/qti3-writer`, a framework-neutral QTI 3 authoring XML writer
  with typed diagnostics, support metadata, round-trip validation through `qti3-core`,
  and builders for the currently migrated item interaction families.
- Add `@longsightgroup/qti3-migrator`, a framework-neutral QTI 1.2 and QTI 2.x
  migration package that detects source packages/items, produces QTI-shaped authoring
  items, and writes QTI 3 XML through `@longsightgroup/qti3-writer`.
- Add migration coverage for Canvas-style QTI 1.2 matching structures alongside the
  package/item detection, manifest parsing, asset collection, and diagnostic reporting
  needed for legacy QTI import workflows.
- Export the core UTF-8 package decoding helper used by package and migration tooling.

### Changed

- Document the writer and migrator package boundaries in the root package overview.

## 0.9.5 - 2026-06-30

### Fixed

- Enforce `required="true"` in `validateQtiResponseVariables()` for interactions that do
  not author explicit minimum response counts or correct responses.
- Validate malformed interaction `required` attributes as boolean authoring errors.

## 0.9.4 - 2026-06-30

### Added

- Add a neutral QTI package manifest parser model and expose package media-type detection for
  host package import and delivery tooling.
- Add `validateQtiResponseVariables()` for checking host-supplied response payloads against parsed
  item declarations before scoring.
- Add `prepareQtiDeliveryXml()` as the high-level secure delivery facade for static and
  server-materialized adaptive candidate XML preparation.
- Add `materializeQtiItemSubmission()` for reusable server-side response validation, scoring, and
  attempt-state materialization.
- Add server-side adaptive template presentation materialization for candidate-safe XML, preserving
  template-derived prompt state while stripping generated answer keys and processing rules.
- Add package-local `qti-stylesheet` browser delivery evidence, including host-resolved CSS blob
  attachment through package upload.

### Changed

- Normalize `prepareQtiDeliveryXml()` diagnostics under `delivery.preparation.*` while keeping
  lower-level delivery and adaptive materialization diagnostics stable.
- Consolidate manual package asset MIME detection on the core package media-type helper.

### Fixed

- Keep package-local caption tracks on the manual package path served as `text/vtt`.
- Harden shared-vocabulary gallery loading so browser evidence waits for the selected case, not a
  stale load result.

## 0.9.3 - 2026-06-26

### Changed

- Enrich the public fixture and manual harness item content with more realistic classroom,
  field-study, media-review, and planning scenarios while preserving synthetic MIT-licensed
  fixture coverage.
- Simplify plain order interaction row styling so each row presents one theme-aware,
  host-overridable boundary instead of nested borders.

### Fixed

- Keep order and graphic-order browser expectations aligned with the richer fixture content and
  four-choice ordering examples.

## 0.9.2 - 2026-06-19

### Added

- Add secure adaptive turn processing in `@longsightgroup/qti3-core` through
  `processQtiAdaptiveItemTurn()`, preserving authoritative attempt state across turns while
  returning candidate-safe XML for delivery.
- Add adaptive candidate materialization that strips answer, scoring, mapping, lookup, and
  response-processing material while preserving outcome-visible feedback from trusted server-side
  outcomes.

### Changed

- Share delivery redaction parsing, source-range removal, diagnostics, and policy analysis between
  static secure delivery redaction and adaptive candidate materialization.
- Keep core package source fixture helpers out of published package files.

### Fixed

- Keep forged or undeclared browser-submitted outcome values from influencing adaptive scoring or
  materialized feedback visibility.
- Keep adaptive items that require template-processing materialization fail-closed until supported.

## 0.9.1 - 2026-06-17

### Added

- Add host-resolved `qti-stylesheet` delivery support in the player, including the
  `resolveStylesheet` load option, browser evidence that resolved CSS affects rendered item
  content, and support-matrix metadata for rendered stylesheet delivery.

### Fixed

- Resolve packaged item assets for dynamically rendered graphic gap match assignments without
  reprocessing unchanged asset URLs.
- Keep graphic gap match image choices usable when `match-max` allows repeated placements, including
  replenishing source choices until their authored limit is reached.
- Remove the implicit one-response default for graphic gap match interactions when
  `max-associations` is omitted.
- Enforce authored `match-max` limits consistently across gap match, graphic gap match, associate,
  match, and graphic associate interactions.
- Keep assigned gap match choices visible in dark mode.

## 0.9.0 - 2026-06-15

### Added

- Add `@longsightgroup/qti3-pnp`, a dependency-free QTI 3 Personal Needs and Preferences
  parser, normalizer, validator, and resolver that accepts host-provided PNP XML or object input
  and returns player-neutral display, tool, media, session, catalog, unresolved, and diagnostic
  output.
- Add QTI 3 PNP support definitions, predefined catalog support metadata, extension preservation,
  profile-aware diagnostics, capability resolution, catalog matching, conflict handling, and
  privacy-safe diagnostic defaults.
- Document the PNP package boundary: qti3 resolves PNP data supplied by the host, while LMS
  identity, storage, LTI/service access, consent, authorization, and institutional policy remain
  host responsibilities.

### Fixed

- Keep gap-match assigned gap text visible in dark mode by giving gap buttons player-owned
  foreground, background, and border colors.
- Keep shared-vocabulary gap width stress cases contained without widening the surrounding player
  layout.
- Keep drawing interaction pen-color labels readable in dark mode while preserving the white drawing
  canvas and light native color input.

## 0.8.2 - 2026-06-15

### Added

- Parse `qti-digital-material` companion materials into the core item metadata model, including
  structured `qti-file-href`, optional `qti-resource-icon`, preserved element attributes,
  parse/validation diagnostics, fixture coverage, and support-matrix metadata.
- Add `createCompanionMaterialsResolution()` in `@longsightgroup/qti3-core` and
  `getCompanionMaterialsResolution()` on the player web component, React/Preact adapters, and
  adapter handle so hosts can read physical and digital companion materials for LMS or runner
  chrome without rendering them inside the item body.
- Resolve packaged relative `fileHref` and `resourceIcon` URLs through the same `resolveAsset`
  hook used for item assets, with per-call overrides supported on resolution requests.
- Export `isResolvableAssetUrl` from core for shared relative-asset URL classification.

### Changed

- Document companion-material host integration in the player README and root README, including the
  trust boundary that the player parses materials as metadata but does not render a materials panel.
- Add a companion-materials debug panel to the manual harness.
- Centralize conformance parse-diagnostic classification in `isConformanceParseDiagnostic` so
  digital companion-material parse warnings are fixture-stable alongside existing metadata
  diagnostics.
- Extend Basic item-player tolerance fixture coverage with a digital companion material.

## 0.8.1 - 2026-06-13

### Changed

- Expose `data-choices-container-width` and `data-first-column-header` through the core
  shared-vocabulary authoring registry, including support metadata and matrix coverage.
- Unify positive-number handling for shared-vocabulary attribute parsing, validation, and player
  runtime behavior.

## 0.8.0 - 2026-06-12

### Added

- Add XHTML extended-text editing support with a browser toolbar, sanitization, shared-vocabulary
  fixture coverage, localized toolbar messages, and Playwright coverage.
- Add rich inline-choice rendering so inline choices can preserve authored inline content, including
  MathML and accessible text.
- Add pen color support for drawing interactions, including accessibility metadata and browser
  coverage.
- Add a 1EdTech manual example harness and fixture navigation entry.

### Changed

- Replace the `stax-xml` runtime dependency with the dependency-free core XML parser used by
  both item parsing and CLI package manifest parsing.
- Document the zero third-party runtime dependency posture for core and CLI in embedded
  delivery systems.
- Preserve rich authored content in prompts, choice content, order choices, MathML rendering, and
  match/pair summaries.
- Improve tabular match and directed-pair rendering with shared pair-chip/list behavior and stronger
  keyboard/browser coverage.
- Expand browser accessibility coverage with axe sweeps across question items and focused MathML,
  lifecycle, validation, inline-choice, and graphic interaction suites.
- Install the project formatting pre-commit hook through the existing `prepare` workflow.

### Fixed

- Decode decimal, hexadecimal, and astral-plane XML numeric character references without throwing
  on invalid XML character references.
- Validate only visible adaptive responses so hidden adaptive controls do not block submission.
- Preserve text choice accessible names when rendering rich choice content.
- Render inline end-attempt controls correctly.
- Fix shared-vocabulary player CSS regressions.
- Document that non-conformant `patternMask` values are ignored.

### Removed

- Remove the final third-party runtime dependency from `@longsightgroup/qti3-core` and
  `@longsightgroup/qti3-cli`.

## 0.7.2 - 2026-06-07

### Added

- Add text-entry and extended-text `placeholder-text` and `pattern-mask` support, including
  authored pattern-mask messages, input masking, authoring diagnostics, shared-vocabulary fixtures,
  and browser coverage.

### Changed

- Align extended-text shared-vocabulary counters with QTI 3: counters are opt-in via
  `qti-counter-up` / `qti-counter-down`, use `expected-length`, and display character counts rather
  than word counts.

## 0.7.1 - 2026-06-05

### Changed

- Refine order-orientation helpers with domain-neutral names and explicit defaults: plain order
  interactions default to vertical, while shared-vocabulary split bank/target order layouts default
  to horizontal.

### Fixed

- Honor authored horizontal order layouts for plain and shared-vocabulary order interactions,
  including left/right move controls, drag/reorder behavior, focus restoration, and movement
  announcements.
- Avoid duplicated visible text in shared-vocabulary order target empty slots by rendering the
  positional label separately from the empty-state copy while preserving fallback context for
  `qti-labels-none`.

## 0.7.0 - 2026-06-05

### Added

- Add core QTI shared-vocabulary parsing, validation, generated class families, and
  machine-readable support metadata exposed through the support matrix.
- Add player support for shared-vocabulary content classes, including layout rows/columns/offsets,
  alignment, full-width content, hidden and visually-hidden content, writing modes, floats, bordered
  and well treatments, list styles, underline, italic, inline-block display, and conditional
  `qti-keyword-emphasis`.
- Add host-controlled keyword-emphasis support on the web component and React/Preact adapters via
  `keywordEmphasisEnabled` / `data-keyword-emphasis`.
- Add shared-vocabulary choice and order presentation support for label styles and suffixes,
  orientation, choice stacking, hidden input controls, writing orientation, selection light/dark
  styling, and unselected-hidden behavior.
- Add shared-vocabulary choices-bank positioning and `data-choices-container-width` support for
  match, gap match, graphic gap match, and order interactions.
- Add shared-vocabulary order layouts with separate choices banks and target slots, removable
  ordered choices, keyboard movement controls, drag/drop placement, and localized selection
  summaries.
- Add match table rendering for `qti-match-tabular`, including first-column/header vocabulary
  behavior and keyboard pair creation/removal coverage.
- Add gap match shared-vocabulary placement support, gap/input width handling, and graphic gap match
  selection presentation.
- Add shared-vocabulary support for text controls: `qti-input-width-*` on text entry and inline
  choice, plus extended-text height and counter classes.
- Add media-interaction shared-vocabulary support for `data-qti-media-player-controls`,
  `data-qti-media-player-pause-delay`, and `data-qti-media-player-pause-duration`.
- Add authored order/choice validation message overrides for minimum and maximum selection
  constraints.
- Add image-backed graphic gap choices so draggable labels can render authored object images rather
  than plain text tokens.
- Add synthetic shared-vocabulary matrix fixtures, browser assertions, coverage policy tests, and a
  Vite-powered shared-vocabulary gallery linked from the manual harness and Pages build.

### Changed

- Move adapter and player lifecycle DOM coverage out of DOM shims and into browser/Playwright
  coverage.
- Improve manual fixture navigation and default harness styling, including shared-vocabulary gallery
  navigation.
- Improve match interaction keyboard behavior for selecting sources, choosing targets, and removing
  selected pairs.
- Expand Basic item-player shared-vocabulary fixture coverage and support-matrix evidence.
- Rework README release-goal detail into this changelog and document shared-vocabulary support
  discovery through the CLI support matrix.

### Fixed

- Preserve whitespace around inline emphasis in parsed item body content.
- Fix browser fixture navigation regressions in manual and browser test harnesses.
- Let left-positioned shared-vocabulary choices layouts remain left-positioned in small viewports.
- Fix graphic gap match drag-back-to-bank behavior and drag image correction against authored target
  images.
- Validate and surface custom order selection messages during browser response validation.

- Remove the local happy-dom adapter test harness package and related DOM-shim tests; browser-facing
  adapter behavior is now covered in Playwright.

## 0.6.0 - 2026-05-25

This release supersedes the attempted `0.5.2` through `0.5.5` release line, which had npm
publication and package metadata issues.

### Fixed

- Include nested `dist/**` build outputs in published `@longsightgroup/qti3-player` tarballs so
  `dist/player-element.js` can resolve its split renderer modules without relying on shipped source.
- Validate packed package exports and relative `dist/` import graphs during release checks.
- Publish exact versioned tarball names in the GitHub workflow so
  `longsightgroup-qti3-player-*.tgz` does not also match the Preact and React adapter packages.
- Point package export `types` entries at `./dist/index.d.ts` instead of `./src/index.ts`, so
  downstream projects consume generated declarations instead of type-checking package source.
- Make the publish workflow skip package versions that already exist on npm, allowing a partial
  publish to be rerun after npm package settings are corrected.
- Build generated declarations before type-aware linting so clean checkouts do not report unresolved
  workspace package types as `any` / error-type lint failures.

### Changed

- Add checked-in `.oxfmtrc.json` for deterministic formatting.

## 0.5.1 - 2026-05-24

### Added

- Add a minimal React adapter manual harness at `examples/manual/adapter-react.html`
  (`pnpm dev:adapter-react`).

### Changed

- Rename adapter chrome sync helper to `syncQtiAssessmentItemPlayerAdapterChrome`.
- Document declarative `xml` clearing, empty-string load behavior, stable `messageCatalog` /
  `loadOptions` references, and JSON state reload keys.
- Strengthen adapter contract and element load-lifecycle tests for superseded async loads.

## 0.5.0 - 2026-05-24

### Added

- Add `@longsightgroup/qti3-player-preact` and `@longsightgroup/qti3-player-react`
  TSX adapters for lifecycle-safe framework use of the web component player.
- Add shared adapter helpers in `@longsightgroup/qti3-player` (`bindQtiAssessmentItemPlayerAdapterEvents`,
  `createQtiAssessmentItemPlayerAdapterLoadSync`, `qtiAssessmentItemPlayerLoadStateKey`) and
  `clearItem()` on the web component.
- Framework adapters accept declarative `messageCatalog` for host-owned locale chrome.

### Changed

- **Breaking:** Remove built-in non-English player chrome catalogs (Spanish, Swedish, German,
  Portuguese, French). English defaults come from `defaultPlayerMessageCatalog`; hosts supply
  other locales via `player.messageCatalog` JSON files.
- **Breaking:** Remove the method-per-key chrome API. Chrome is `PlayerMessageResolver.message(key, params?)`
  backed by `PLAYER_MESSAGE_MANIFEST`; use `createPlayerMessageResolver(catalog)` or
  `resolvePlayerMessages(locale, overrides, catalog)`.
- `language-of-interface` is metadata only and no longer selects packaged locale catalogs.
- Add `player.messageCatalog`, `validatePlayerMessageCatalog()`, and manifest-driven placeholder
  validation (allowed vs required placeholders per English default).
- Cache the resolved resolver on the player element; dev warnings when locale is non-English without
  a catalog or when a catalog key is missing.
- Add `PLAYER_MESSAGE_MANIFEST` as the single source of truth for chrome message ids and resolver
  behavior.
- Add `validatePlayerMessageCatalog()` with structured diagnostics for unknown keys and placeholder
  mistakes; split browser locale tests into `player-chrome-locale.spec.ts` and
  `player-graphic-locale.spec.ts`.

### Removed

- Per-locale `*InteractionTypes` tables and `player-chrome-messages` locale matrices from the
  player package.

## 0.4.0 - 2026-05-24

### Added

- Add `@longsightgroup/qti3-core` delivery security analysis and redaction APIs for candidate-safe item XML.
- Add `scoreQtiItemServerSide` for authoritative server scoring from full item XML and trusted response variables.
- Add public `isQtiValue` and `readQtiJsonValue` helpers for validating JSON-shaped QTI values.

### Changed

- Document the player scoring trust boundary: browser scoring is local convenience only for high-stakes delivery.
- Treat delivery-security forbidden elements as error-severity diagnostics.
- Give unsupported adaptive response-processing its own delivery-security diagnostic code.
- Redact response and area mappings during secure delivery preparation.
- Redact outcome lookup tables and hidden response/outcome/template declaration default
  values during secure delivery preparation while documenting intentionally displayed
  point values as host/content policy.
- Clarify delivery-safe API semantics, server-scoring response-validation scope, and the
  lack of delivery/security CLI commands in the `0.5.x` release line.
- Replace delivery redaction's string-search range lookup with a private XML tag scanner
  aligned to the stax parse tree, including comment, CDATA, processing-instruction,
  prefixed-tag, self-closing-tag, and doctype coverage.
- Treat XML parse/source-range alignment errors as fatal `parseQtiXml` errors without
  returning a partial parsed document.

## 0.3.0 - 2026-05-23

### Added

- Add the Basic item-player readiness profile with fixture evidence, item-only package fixtures, CLI `basic-item-player-report`, and Playwright coverage for the narrow 1EdTech Basic item-player scope.
- Add `readiness:basic:item-player` as a single local verification entry point for that readiness profile.
- Add load-time interaction diagnostics for unsupported interactions, missing choices, and unsupported embeds, mirrored into player validation UI and serialized state handling.
- Add a unified interaction registry as the single dispatch source for player rendering, with routing unit tests.
- Add player orchestration modules for content state, dynamic body, feedback panel, interaction rendering, render shell, asset resolution, default XML fetch, and validation message merging.
- Add domain-split player stylesheets and extract portable custom interaction rendering into its own module.
- Add explicit oxlint configuration with type-aware linting (`oxlint-tsgolint`), Vitest CI guardrails, and `no-explicit-any` enforcement.
- Add shared `QtiValue` formatting helpers in `@longsightgroup/qti3-core` for safe scalar and record stringification.
- Add expanded player chrome localization for control labels, empty selection status messages, and graphic interaction copy, with `player-locale` unit coverage.
- Add qti3 project architecture diagrams in repository documentation.

### Changed

- Refactor `@longsightgroup/qti3-player` from a monolithic index module into per-interaction renderers, shared content infrastructure, and a slim `player-element` lifecycle shell.
- Replace tsconfig `baseUrl` / `paths` aliases with workspace package exports that resolve TypeScript types from source while keeping runtime imports on built `dist` output.
- Run the GitHub Pages workflow with `verify`, `build`, and `pages:build` instead of full `release:check`, so Pages deploy does not require official external 1EdTech conformance content.
- Gate external QTI parse and score conformance tests on a configured `QTI3_EXTERNAL_QTI_DIR`.
- Filter serialized response validation messages when restoring or loading player attempt state so authoring diagnostics are not duplicated in the UI.
- Apply oxfmt across the player package and extract `defaultFetchXml` for shared XML loading.

### Fixed

- Keep package release checks publish-safe by leaving official 1EdTech certification artifacts in the explicit `certification:check` gate.
- Fix restore validation deduplication when reloading serialized player state.
- Unify graphic object image rendering and reflow behavior after resize.
- Fix block interaction routing for nested interaction content.
- Fix QTI conformance validation and response-processing edge cases, including composite items, inline choice handling, and session expression evaluation.
- Keep drawing strokes visible in dark and forced-colors presentation modes.
- Improve keyboard-only reorder operability for order and graphic order interactions.

## 0.2.1 - 2026-05-21

### Added

- Add `language-of-interface` / `languageOfInterface` player chrome localization support with browser and document language resolution.
- Add host message overrides and built-in player chrome catalogs for Spanish, Swedish, German, Portuguese, and French remove controls (removed in 0.5.0; hosts own non-English chrome).
- Add a manual harness language-of-interface selector for browser testing localized player chrome.

### Changed

- Render remove and movement controls as dependency-free inline SVG icon buttons while preserving accessible labels.

### Fixed

- Position graphic gap match hotspots over the authored image so candidates can drop labels on the visible target circles.
- Match copied Tabler SVG root attributes for player chrome icons so the rendered trash icon matches the supplied source more closely.

## 0.2.0 - 2026-05-21

### Added

- Add QTI 3 portable custom interaction parsing, validation, response/state retention, host mount events, and player fallback rendering.
- Add catalog support resolution APIs for `data-catalog-idref` content so hosts can select transcript, audio-description, sign-language, and media-alternative metadata by support and language.
- Add Data-SSML parsing, validation diagnostics, and text-to-speech traversal metadata for read-aloud integrations.
- Add shared QTI accessibility vocabulary handling for `qti-hidden`, `qti-visually-hidden`, `data-qti-suppress-tts`, `data-qti-aria-*`, and `data-qti-a11y-content-role`.
- Add graphic associate, graphic gap match, and position-object rendering improvements, including image-backed drag/drop and initial unplaced markers.

### Changed

- Preserve broader authored HTML accessibility and internationalization semantics in player content, including headings, Ruby markup, bidirectional text, `aria-*`, `dir`, `lang`, and `xml:lang`.
- Preserve QTI media `<source>` and `<track>` child metadata beyond native fields, including safe authored `id`, `class`, `title`, `media`, `sizes`, and `data-*` attributes.
- Clarify portable custom interaction host responsibilities and accessibility proof requirements in documentation and a11y metadata.

### Fixed

- Improve object-backed graphic interaction accessible names and image sizing behavior.
- Render graphic gap match hotspots against the authored image instead of an empty target surface.
- Keep position object markers unplaced until the candidate chooses a point.

## 0.1.2 - 2026-05-21

### Added

- Implement `qti-media-interaction` as a response-bearing interaction that records play-experience counts against `single` / `integer` response declarations.
- Render media interactions with native browser audio/video controls, authored sources and tracks, packaged asset resolution, `autostart`, `loop`, `min-plays`, `max-plays`, and media-control metadata handling.
- Add `qti-responsechange` to the exported player event detail map.
- Add drawing interaction support for `object`, `img`, and `picture` canvas assets, including picture source metadata parsing.
- Add browser coverage for SVG, raster, and packaged drawing response serialization and restore behavior.

### Changed

- Align `qti-drawing-interaction` with QTI file-response semantics: drawing responses now require `single` / `file` declarations and serialize as image file data URLs instead of private stroke-coordinate strings.
- Preserve editable stroke restore metadata inside qti3-generated SVG drawing responses while keeping raster drawing responses as flattened image files.
- Update the canonical drawing fixture to use a real canvas object and a file response declaration.

### Fixed

- Remove the built-in candidate-facing `Score` button from `qti3-player`; scoring remains available through host APIs and harness controls.
- Include packaged TypeScript source files referenced by published source maps.
- Add a release check that verifies package tarballs include every non-URL source referenced by shipped source maps.
- Reject source-only drawing canvases that cannot be rendered as a candidate drawing surface.
- Restore flattened raster drawing responses visibly after serialized state restore.

## 0.1.1 - 2026-05-21

### Changed

- Aligned qti3-player rendering with the Vue 3 player for match and gapMatch interactions.
- Stopped rendering `qti-assessment-item` `title` metadata as candidate-facing content.
- Removed generic interaction `fieldset` and `legend` wrappers from the web component output.
- Replaced visible `Up` and `Down` movement button text with arrow icon controls while preserving accessible labels.
- Made inline choice placeholders locale-neutral and serialize cleared selections as `null`.
- Coerced declaration default and correct values according to QTI `base-type`, so numeric outcomes such as `MAXSCORE` serialize as numbers.
- Coerced slider responses through their declared response base type.

### Added

- Added `scoreAttempt({ validateResponses: false })` and `endAttempt({ validateResponses: false })` so hosts can score or finalize skipped required responses when their delivery model allows it.
- Added serialized attempt state to `qti-validation` event details.
- Exported typed custom event detail contracts for key player events.
- Expanded browser and core regression coverage for validation, scoring, event state, rendering parity, and typed declaration defaults.

## 0.1.0 - 2026-05-20

### Added

- Initial public package release for the QTI 3 core parser/session, web component player, fixtures, conformance runner, accessibility metadata, and CLI packages.
