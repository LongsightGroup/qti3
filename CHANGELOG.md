# Changelog

## 0.1.2 - 2026-05-21

### Fixed

- Remove the built-in candidate-facing `Score` button from `qti3-player`; scoring remains available through host APIs and harness controls.
- Include packaged TypeScript source files referenced by published source maps.
- Add a release check that verifies package tarballs include every non-URL source referenced by shipped source maps.

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
