# Changelog

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
