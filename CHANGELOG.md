# Changelog

## 0.9.10 - 2026-07-21

### Added

- Retain raw package entry bytes on `QtiPackageParseResult` for single-pass importer workflows.
- Parse typed assessment-test parts, nested sections, item references, time limits, item session
  controls, and IMS curriculum-standards metadata with structured diagnostics.
- Add public package-content asset discovery and response-processing expression collection helpers.

### Changed

- Evaluate Basic IMPORT conformance from the typed assessment-test hierarchy.
- Expand package media-type detection for HTML, JSON, and M4A importer assets.
- Align all workspace package versions on `0.9.10`.

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
- Align all workspace package versions on `0.9.9`.

## 0.9.7 - 2026-07-06

### Added

- Add item-bank QTI 3 package emission to `@longsightgroup/qti3-writer`, including
  `imsmanifest.xml`, item XML files, item-owned asset files, and deterministic ZIP output.
- Add migrator package projection so `@longsightgroup/qti3-migrator` can preserve source manifest
  item paths and asset paths while handing package output directly to the writer.

### Changed

- Split the writer package-emission layer into focused build, manifest, ZIP, and public type modules.
- Reuse core package path normalization and manifest constants across core, writer, and migrator.
- Align all workspace package versions on `0.9.7`.

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

- Align all workspace package versions on `0.9.6` so writer, migrator, core, player,
  adapters, conformance, fixtures, accessibility, CLI, and PNP packages can be published
  as a consistent release set.
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
- Align workspace package versions on `0.6.0`.

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
- Align workspace package versions on `0.5.0`.

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
