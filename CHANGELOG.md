# Changelog

## 0.5.1 - 2026-05-24

### Added

- Add a minimal React adapter manual harness at `examples/manual/adapter-react.html`
  (`pnpm dev:adapter-react`).

### Changed

- Rename adapter chrome sync helper to `syncQtiAssessmentItemPlayerAdapterChrome` (old name kept
  as deprecated alias).
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
