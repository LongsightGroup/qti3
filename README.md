# qti3-ts

`qti3-ts` is a planned dependency-light, framework-neutral TypeScript reference implementation for QTI 3 assessment items.

The goal is not to build another framework-specific item player. The goal is to build a clean, auditable implementation that can parse, validate, render, score, serialize, restore, and test QTI 3 items across products.

## Goals

- Implement QTI 3 item behavior faithfully and explicitly.
- Support all QTI 3 interaction types in the target item profile.
- Make scoring and response processing runnable in Node without a browser.
- Provide an accessible browser player that can be embedded in any product.
- Publish a reusable conformance test suite.
- Keep dependencies as small and justified as possible.
- Make unsupported or invalid behavior visible through structured diagnostics.

## Non-Goals

- No Vue-centered rewrite.
- No React-centered rewrite.
- No dependency on a heavy UI framework such as React or Vue.
- No hidden fallback behavior for required production configuration.
- No compiling QTI XML as framework templates.
- No global singleton state store.

## Planned Packages

```text
packages/
  qti3-core/          # parser, typed model, validation, processing, scoring, state
  qti3-dom/           # DOM rendering primitives and interaction controllers
  qti3-player/        # native custom element browser player
  qti3-conformance/   # fixture runner and support matrix tooling
  qti3-a11y/          # accessibility contracts and automated checks
  qti3-fixtures/      # QTI item fixtures and expected outcomes
  qti3-examples/      # plain HTML and product integration examples
```

The default embedding surface should be a native web component:

```html
<script type="module" src="/qti3-player.js"></script>
<qti-assessment-item-player id="player"></qti-assessment-item-player>
```

```js
const player = document.getElementById("player");

await player.loadXml(xml, {
  status: "interacting",
  sessionControl: {
    validateResponses: true,
    showFeedback: false
  }
});

player.addEventListener("qti-statechange", (event) => {
  saveState(event.detail.state);
});
```

Framework adapters may be added later, but they should wrap the web component or core API. They must not own the QTI implementation.

## Tooling Preferences

- TypeScript 6+
- pnpm
- Vite
- Vitest
- Playwright
- axe-core
- oxfmt
- oxlint

## Quality Gates

Every change should pass the same checks locally and in CI:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:conformance
pnpm test:a11y
pnpm test:browser
pnpm build
```

The intended enforcement model is strict:

- `oxfmt` is the only formatter.
- `oxlint` runs with zero warnings for source and tests.
- TypeScript runs in strict mode with no emitted JavaScript from failed type checks.
- Vitest covers pure core behavior and fixture-based scoring.
- Playwright covers browser interactions, keyboard flows, focus, and rendering.
- axe-core is required but not sufficient; accessibility tests must also assert keyboard behavior, accessible names, ARIA states, validation messaging, forced colors, and reflow.
- CI blocks release when formatting, linting, typing, tests, conformance, accessibility, browser checks, package builds, or dependency policy checks fail.

## Status

This directory currently contains planning documents only. Implementation should begin with `qti3-core`, fixtures, and conformance tests before browser UI work.
