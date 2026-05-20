# qti3-ts

`qti3-ts` is a dependency-light, framework-neutral TypeScript reference implementation for QTI 3 assessment items.

The goal is not to build another framework-specific item player. The goal is to build a clean, auditable implementation that can parse, validate, render, score, serialize, restore, and test QTI 3 items across products.

The public project is focused on QTI item/question-type conformance. Runners, controllers, LMS shells, candidate attempt policy, analytics, proctoring, rostering, and gradebook integrations are expected to be owned by host products.

## Goals

- Implement the latest public QTI 3 item behavior faithfully and explicitly, tracking QTI 3.0.1 ASI documents where applicable.
- Support all QTI 3 interaction/question types in the target item profile.
- Make scoring and response processing runnable in Node without a browser.
- Provide an accessible browser player that can be embedded in any product.
- Publish a reusable conformance test suite.
- Load QTI package zips and assessment-test item references where useful for item-focused testing.
- Keep dependencies as small and justified as possible.
- Make unsupported or invalid behavior visible through structured diagnostics.

## Non-Goals

- No Vue-centered rewrite.
- No React-centered rewrite.
- No dependency on a heavy UI framework such as React or Vue.
- No reusable LMS runner/controller.
- No product-owned attempt policy, proctoring, analytics, rostering, gradebook, or LTI integration.
- No hidden fallback behavior for required production configuration.
- No compiling QTI XML as framework templates.
- No global singleton state store.
- No implementation support for deprecated QTI elements, beyond diagnostics and support-matrix awareness.
- No runtime XSD or schema validation.

## Planned Packages

```text
packages/
  core/          # parser, typed model, validation, processing, scoring, state
  player/        # native custom element browser player
  conformance/   # fixture runner and support matrix tooling
  a11y/          # accessibility contracts and automated checks
  fixtures/      # QTI item fixtures and expected outcomes
  cli/           # validation, scoring, fixture, and support-matrix CLI
```

Assessment-test/package support belongs in tooling and examples only when it helps discover, load, and verify item references. The player package renders one item at a time and exposes state/events for host-owned runners.

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
    showFeedback: false,
  },
});

await player.loadUrl("/items/item-1.xml", {
  fetchXml: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    return response.text();
  },
});

await player.loadXml(packageItemXml, {
  resolveAsset: (url) => packageAssetUrlFor(url),
});

player.addEventListener("qti-statechange", (event) => {
  saveState(event.detail.state);
});
```

`resolveAsset` is a host hook for package or virtual-file environments. The player calls it for relative `src`, `href`, and `data` asset URLs after rendering the item; normal web-served items can omit it.

Framework adapters may be added later, but they should wrap the web component or core API. They must not own the QTI implementation.

The initial player should use native custom elements directly. Lit is not part of the initial stack and should be reconsidered only if plain custom element code creates a clear maintenance problem that outweighs the dependency and abstraction cost.

## Platform

- ESM-only packages.
- Node.js 22+.
- Modern browsers.
- Deno 2+.
- GitHub Actions for CI.
- Light DOM for the default player.

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
pnpm check:deps
pnpm test:browser
pnpm build
```

The browser harness is available with:

```sh
pnpm dev
```

The CLI can parse local QTI directories, including external reference sets:

```sh
pnpm --filter @qti3/cli exec qti3 parse-dir /path/to/items
```

Use validation when diagnostics should fail the command:

```sh
pnpm --filter @qti3/cli exec qti3 validate-dir /path/to/items
```

It can also score each item by applying its declared correct responses:

```sh
pnpm --filter @qti3/cli exec qti3 score-correct-dir /path/to/items
```

It can also write standalone reference items for every currently targeted interaction:

```sh
pnpm --filter @qti3/cli exec qti3 write-fixtures packages/fixtures/xml
```

The support matrix is intentionally machine-readable and includes interaction, deprecated
interaction, and processing element evidence:

```sh
pnpm --filter @qti3/cli exec qti3 support-matrix
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

This repository is an early reference implementation. It has a strict TypeScript core, a native web component player, fixture-based scoring, a manual browser harness, automated accessibility checks, Playwright coverage, and standalone XML reference items under `packages/fixtures/xml`.

Serialized attempt state uses `qti3.attempt-state.v1` and includes responses, outcomes, generated template values, validation messages, lifecycle status, and QTI's built-in `completionStatus` outcome. Adaptive items retain outcome values across response-processing runs; non-adaptive items reset authored outcomes before each scoring run.

## Roadmap Focus

- Bring every QTI 3 interaction/question type to reference quality.
- Complete item processing coverage for realistic QTI: template processing, response processing, feedback, printed variables, catalogs, and portable custom interaction boundaries.
- Harden item state serialization and restore for host-owned save/resume/review workflows.
- Continue improving the manual harness debugger with richer fixture/package inspection and manual accessibility scripts.
- Keep public fixtures synthetic and clearly licensed; keep private/generated/customer packages outside the public repository unless explicitly approved for publication.
- Keep assessment-test support limited to package traversal and item-reference loading unless a separate optional example runner is intentionally created.
