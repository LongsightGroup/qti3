# Agent Instructions

This directory is the source workspace for `qti3`, a framework-neutral QTI 3 reference implementation.

## Project Goals

- Build a dependency-light, TypeScript-first QTI 3 reference implementation.
- Treat conformance, accessibility, testability, and embeddability as product requirements, not polish.
- Keep framework adapters optional. The core implementation must not depend on Vue, React, Svelte, Angular, Lit, or any app framework.
- Prefer explicit behavior and structured diagnostics over silent fallback behavior.

## Boundaries

- This directory may reference lessons from existing repositories, but it should stand alone as a clean project.
- Do not keep private coordination notes in this Git repo.
- Keep private, generated, and customer QTI packages outside this repository unless they have been explicitly scrubbed and licensed for publication.

## Technical Preferences

- Language: TypeScript 6+.
- Module format: ESM-only.
- Runtime targets: Node.js 22+, modern browsers, and Deno 2+.
- Package manager: pnpm.
- Build/dev tooling: Vite where useful, with package builds kept simple and inspectable.
- Test runner: Vitest for unit and fixture tests.
- Browser tests: Playwright.
- Accessibility tests: axe-core plus explicit keyboard, focus, ARIA, contrast, reflow, and forced-colors checks.
- Formatting: oxfmt.
- Linting: oxlint.
- Public API: stable, typed, framework-neutral.
- CI: GitHub Actions.

## Dependency Policy

- Add dependencies only when they materially improve conformance, security, accessibility, or maintenance.
- Keep `qti3-core` free of UI, browser framework, alert, editor, HTTP, and drag/drop dependencies.
- Prefer browser-native APIs and small explicit adapters.
- Make integrations optional packages, not core requirements.
- Record dependency decisions in design notes or ADRs once implementation starts.
- Prefer MIT dependencies. Block GPL and AGPL dependencies. Require explicit review for EPL, MPL, LGPL, or similarly reciprocal licenses.

## Engineering Rules

- Separate parsing, validation, processing, rendering, state, and host integration.
- Scoring must be testable in Node without a DOM.
- Rendering must not be required for response processing.
- QTI XML must be parsed as data, not compiled as application templates.
- Every supported QTI element needs parser behavior, validation behavior, tests, and support-matrix documentation.
- Accessibility behavior must be specified per interaction type before broad implementation.
- Target the latest public QTI 3 item line and track QTI 3.0.1 ASI documents where applicable.
- Deprecated QTI elements should be recognized in diagnostics and support metadata, but not implemented as supported runtime behavior.
- Runtime XSD/schema validation is out of scope.
- The default browser player uses light DOM.
- The initial browser player uses native Web Components directly without Lit.
- Serialized attempt state is a versioned public JSON contract.
- Normal parse, validation, response, and processing failures should return typed diagnostics rather than throw.

## Quality Gate Rules

- Treat `pnpm verify` as the minimum local pre-merge check once implementation exists.
- Do not mark an interaction or element supported without fixture tests and support-matrix metadata.
- Every supported current, non-deprecated QTI 3 item interaction needs response-shape assertions, scoring coverage, browser rendering coverage, keyboard coverage, and accessibility proof metadata.
- Processing coverage should include response processing, template processing, feedback, printed variables, MathML/template variables, catalogs, shared CSS vocabulary, advanced numeric/container/point expressions, and adaptive `completionStatus` behavior.
- Public fixtures must be synthetic and MIT-licensed.
- Do not accept lint warnings, type errors, skipped tests, or broad `any` usage in public APIs.
- Keep core tests DOM-free.
- Add Playwright and axe-core coverage for browser-facing behavior.
- Enforce accessibility with semantic assertions, not only screenshot comparison or axe-core scans.
- Do not add dependencies to `qti3-core` without documented rationale.
- Shared vocabulary classes with an enforced support level (`isEnforcedSharedVocabularyLevel` in `packages/core`) must be validated by `tests/browser/shared-vocabulary-matrix/coverage-policy.ts` and `tests/browser/player-shared-vocabulary.spec.ts`. Prefer a direct matrix fixture for each supported class. Generated stylesheet families may use representative matrix cases only when `sharedVocabularyMatrixCoverageFamilies` in `packages/core/src/shared-vocabulary-generated-families.ts` names the family, lists representative covered classes, and explains the rationale. Conditional classes should have direct matrix coverage unless they are explicitly documented as a generated family exception.

## Testing Rules

- Run Vitest in the Node environment by default. Do not add, install, or use `happy-dom`, `jsdom`, or other DOM shims; do not use `@vitest-environment happy-dom` or `@vitest-environment jsdom`. Test DOM behavior in Playwright only.
- If Vitest optional peers pull `happy-dom` or `jsdom` into `pnpm-lock.yaml`, review and allow the exact versions in `scripts/dependency-policy.json` `lockfilePackages` only. Do not add them to root `devDependencies`.
- Keep Vitest coverage DOM-free for parsing, scoring, processing, diagnostics, and other non-rendering logic.
- Test anything that creates or mutates DOM nodes, custom elements, ARIA state, or browser events in Playwright under `tests/browser/`.
- Keep focused DOM regression coverage in `tests/browser/player-dom-behavior.spec.ts`; use `tests/browser/player-helpers.ts` for shared harness helpers instead of growing `player.spec.ts`.
- Keep host chrome locale coverage in `tests/browser/player-chrome-locale.spec.ts` and graphic-specific locale coverage in `tests/browser/player-graphic-locale.spec.ts`.
- Split other focused browser suites into `tests/browser/player-validation.spec.ts`, `tests/browser/player-lifecycle.spec.ts`, `tests/browser/player-portable-custom.spec.ts`, `tests/browser/player-package.spec.ts`, `tests/browser/player-keyboard-a11y.spec.ts`, and `tests/browser/player-graphic.spec.ts` when adding related coverage.
- Prefer pure-function tests with plain data or minimal typed stubs when a helper only reads simple fields such as `dataset`.
- When moving behavior from Vitest to Playwright, preserve the assertion intent: visible DOM state, accessibility attributes, and serialized player state should still be covered.
