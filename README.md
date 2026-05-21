# qti3

`qti3` is a dependency-light, framework-neutral TypeScript reference implementation for QTI 3 assessment items.

The project is being prepared for its first public release. The release target is a clean,
auditable item engine that can parse, validate, render, score, serialize, restore, and test
QTI 3 items across products without binding the core implementation to a UI framework.

This is not another framework-specific item player. The public project is focused on QTI
item and question-type conformance. Runners, controllers, LMS shells, candidate attempt
policy, analytics, proctoring, rostering, and gradebook integrations are expected to be
owned by host products.

## First Release Goals

For 0.1.0, the priorities are practical:

- A strict TypeScript core for parsing, validation, response processing, scoring, and saved attempt state.
- A native web component player that host products can embed without adopting a framework.
- Public, synthetic fixtures for every supported current QTI 3 item interaction.
- Machine-readable support metadata instead of marketing-only compatibility claims.
- Explicit diagnostics for unsupported, deprecated, invalid, or ambiguous item behavior.
- Small, justified dependencies with release checks that block formatting, linting, type, test, accessibility, conformance, browser, package, and dependency-policy failures.

## Question-Type Support

The target is the current public QTI 3 item interaction set described by the
[1EdTech QTI 3 Implementation Guide](https://www.imsglobal.org/spec/qti/v3p0/impl)
with element names from the
[QTI 3 XML Binding](https://www.imsglobal.org/spec/qti/v3p0/bind/) and tracked
internally as the `QTI 3.0.1 ASI item profile`.

In this README, **Supported** means the interaction is parsed into the typed model,
validated against its response and element contract, rendered by the browser player,
processed/scored by the core runtime, covered by a public reference fixture, covered by
fixture/conformance tests, covered by accessibility metadata, and exercised by browser
rendering tests.

| Spec interaction  | QTI element                         | qti3 status           | Evidence                                                                          |
| ----------------- | ----------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| Choice            | `qti-choice-interaction`            | Supported             | `choice-reference.xml`; core, fixture, conformance, a11y, browser tests           |
| Text Entry        | `qti-text-entry-interaction`        | Supported             | `textEntry-reference.xml`; core, fixture, conformance, a11y, browser tests        |
| Extended Text     | `qti-extended-text-interaction`     | Supported             | `extendedText-reference.xml`; core, fixture, conformance, a11y, browser tests     |
| Gap Match         | `qti-gap-match-interaction`         | Supported             | `gapMatch-reference.xml`; core, fixture, conformance, a11y, browser tests         |
| Hotspot           | `qti-hotspot-interaction`           | Supported             | `hotspot-reference.xml`; core, fixture, conformance, a11y, browser tests          |
| Hot Text          | `qti-hottext-interaction`           | Supported             | `hottext-reference.xml`; core, fixture, conformance, a11y, browser tests          |
| Inline Choice     | `qti-inline-choice-interaction`     | Supported             | `inlineChoice-reference.xml`; core, fixture, conformance, a11y, browser tests     |
| Match             | `qti-match-interaction`             | Supported             | `match-reference.xml`; core, fixture, conformance, a11y, browser tests            |
| Order             | `qti-order-interaction`             | Supported             | `order-reference.xml`; core, fixture, conformance, a11y, browser tests            |
| Graphic Order     | `qti-graphic-order-interaction`     | Supported             | `graphicOrder-reference.xml`; core, fixture, conformance, a11y, browser tests     |
| Associate         | `qti-associate-interaction`         | Supported             | `associate-reference.xml`; core, fixture, conformance, a11y, browser tests        |
| Graphic Associate | `qti-graphic-associate-interaction` | Supported             | `graphicAssociate-reference.xml`; core, fixture, conformance, a11y, browser tests |
| Graphic Gap Match | `qti-graphic-gap-match-interaction` | Supported             | `graphicGapMatch-reference.xml`; core, fixture, conformance, a11y, browser tests  |
| Media             | `qti-media-interaction`             | Supported             | `media-reference.xml`; core, fixture, conformance, a11y, browser tests            |
| Position Object   | `qti-position-object-interaction`   | Supported             | `positionObject-reference.xml`; core, fixture, conformance, a11y, browser tests   |
| Select Point      | `qti-select-point-interaction`      | Supported             | `selectPoint-reference.xml`; core, fixture, conformance, a11y, browser tests      |
| Slider            | `qti-slider-interaction`            | Supported             | `slider-reference.xml`; core, fixture, conformance, a11y, browser tests           |
| Upload            | `qti-upload-interaction`            | Supported             | `upload-reference.xml`; core, fixture, conformance, a11y, browser tests           |
| Drawing           | `qti-drawing-interaction`           | Supported             | `drawing-reference.xml`; core, fixture, conformance, a11y, browser tests          |
| Portable Custom   | `qti-portable-custom-interaction`   | Supported             | `portableCustom-reference.xml`; core, fixture, conformance, a11y, browser tests   |
| Custom            | `qti-custom-interaction`            | Deprecated diagnostic | Parsed for explicit warning; not a supported runtime target                       |
| End Attempt       | `qti-end-attempt-interaction`       | Supported             | `endAttempt-reference.xml`; core, fixture, conformance, a11y, browser tests       |

For automated review, the same support matrix is available as JSON:

```sh
node packages/cli/dist/index.js support-matrix
```

## Goals

- Implement the latest public QTI 3 item behavior faithfully and explicitly, tracking QTI 3.0.1 ASI documents where applicable.
- Support all QTI 3 interaction/question types in the target item profile.
- Make scoring and response processing runnable in Node without a browser.
- Provide an accessible, style-neutral web component player that can be embedded in any product.
- Publish a reusable conformance test suite.
- Load QTI package zips and assessment-test item references where useful for item-focused testing.
- Keep dependencies as small and justified as possible.
- Make unsupported or invalid behavior visible through structured diagnostics.

## Non-Goals

- No dependency on a heavy UI framework such as React or Vue.
- No Lit dependency for the browser player (native custom elements keep the surface small).
- No reusable LMS runner/controller.
- No product-owned attempt policy, proctoring, analytics, rostering, gradebook, or LTI integration.
- No hidden fallback behavior for required production configuration.
- No compiling QTI XML as framework templates.
- No global singleton state store (multiple players should not share a brain).
- No implementation support for deprecated QTI elements, beyond diagnostics and support-matrix awareness.
- No runtime XSD or schema validation (semantic diagnostics stay fast and embeddable).

## Packages

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

The browser player surface is a native web component:

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

## Styling

The browser player is style-neutral by design. It ships only the structural styles needed
for layout, focus visibility, forced-colors support, and accessible interaction behavior.
Product typography, spacing, borders, colors, and surrounding chrome belong to the host
application.

The player renders in light DOM, so host CSS can style it directly:

```css
qti-assessment-item-player {
  font:
    16px/1.5 system-ui,
    sans-serif;
  color: #1f2937;
}

qti-assessment-item-player .qti3-interaction {
  margin-block: 1rem;
}

qti-assessment-item-player .qti3-choice-option[data-selected="true"] {
  border-color: currentColor;
}
```

Rendered elements use `qti3-*` class names for player structure, such as
`qti3-player`, `qti3-item-body`, `qti3-interaction`, and interaction-specific classes
like `qti3-choice`, `qti3-textEntry`, and `qti3-hotspot`. Authored QTI shared-vocabulary
classes that start with `qti-` are preserved on rendered interactions where applicable.

QTI shared vocabulary classes are authoring hints defined by the specification, not
product theme classes. For example, classes such as `qti-labels-none`,
`qti-labels-decimal`, `qti-selections-light`, and `qti-unselected-hidden` describe
portable item-level presentation preferences. `qti3` preserves those classes so host
products can reflect the item author's choices while still applying their own visual system.
See the 1EdTech
[QTI 3 Standardized Shared Vocabulary and CSS Classes](https://www.imsglobal.org/node/218713)
document for the normative shared vocabulary and example CSS.

Framework adapters may be added later, but they should wrap the web component or core API. They must not own the QTI implementation.

The initial player should use native custom elements directly. Lit is not part of the initial stack and should be reconsidered only if plain custom element code creates a clear maintenance problem that outweighs the dependency and abstraction cost.

## Platform

- ESM-only packages.
- Node.js 22+.
- Modern browsers.
- Deno 2+.
- Light DOM for the default player (rendered into the page DOM so host CSS and tooling can inspect and style it directly).

## Tooling Choices

- TypeScript 6+
- pnpm
- Vite 8+
- Vitest
- Playwright
- axe-core
- oxfmt
- oxlint

## Checks

Every change should pass the same checks locally and in CI:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:conformance
pnpm test:a11y
pnpm check:deps
pnpm build
pnpm check:exports
pnpm test:browser
```

The browser harness is available with:

```sh
pnpm dev
```

From a source checkout, run `pnpm build` before using the built CLI entry point.
Published packages expose the same commands through the `qti3` binary.

The CLI can parse local QTI directories, including external reference sets:

```sh
node packages/cli/dist/index.js parse-dir /path/to/items
```

Use validation when diagnostics should fail the command:

```sh
node packages/cli/dist/index.js validate-dir /path/to/items
```

It can also score each item by applying its declared correct responses:

```sh
node packages/cli/dist/index.js score-correct-dir /path/to/items
```

For package-level inspection without creating an open-source runner, use:

```sh
node packages/cli/dist/index.js inspect-package /path/to/package.zip
```

This enumerates XML files, assets, manifest/test item references, and parse diagnostics
for loadable assessment items.

It can also write standalone canonical reference items for targeted interactions,
processing patterns, and adaptive behavior:

```sh
node packages/cli/dist/index.js write-fixtures packages/fixtures/xml
```

The support matrix is machine-readable and includes interaction, deprecated
interaction, and processing element evidence:

```sh
node packages/cli/dist/index.js support-matrix
```

The accessibility proof matrix is also machine-readable. It lists each interaction's role,
keyboard contract, automated evidence, and manual assistive-technology scripts:

```sh
node packages/cli/dist/index.js a11y-proof
```

Quality expectations are part of the public contract:

- Supported interactions need parser, validation, scoring, rendering, keyboard, and accessibility evidence.
- Accessibility checks cover real operation, not just automated scans.
- Dependencies are kept small, exact, and reviewed.
- Published packages use explicit npm `files` allowlists so package contents stay small and deliberate.
- Release checks must pass before publishing.

## Status

This repository is a reference implementation for QTI 3 item behavior. It has a strict TypeScript core, a native web component player, fixture-based scoring, a manual browser harness, automated accessibility checks, Playwright coverage, and standalone canonical XML reference items under `packages/fixtures/xml`.

### Attempt State

Serialized attempt state uses `qti3.attempt-state.v1`. It captures responses, outcomes,
generated template values, validation messages, lifecycle status, and QTI's built-in
`completionStatus` outcome.

- Hosts can save, restore, and review attempts through this state contract.
- Restored JSON can be checked with `isQtiAttemptStateV1()` or `assertQtiAttemptStateV1()`.
- Non-adaptive items reset authored outcomes before each scoring run.
- Adaptive items retain outcome values across response-processing runs.
- For non-adaptive items, `endAttempt()` completes the item after a valid score run.
- For adaptive items, `endAttempt()` runs response processing and leaves the item open unless processing sets `completionStatus` to `"completed"`.
- Templated items restore saved template values before deriving generated correct responses, so resume does not require the original random seed.

## Reference Coverage

- Every current, non-deprecated QTI 3 item interaction has a public fixture, response-shape assertions, scoring coverage, browser rendering coverage, keyboard coverage, and accessibility proof metadata.
- Processing coverage includes response processing, template processing, feedback, printed variables, MathML/template variables, catalogs, shared CSS vocabulary, advanced numeric/container/point expressions, and adaptive `completionStatus` behavior.
- Serialized attempt state is the public save/resume/review contract. Core and player APIs clone returned state and score values so hosts do not depend on or mutate private runtime state.
- The manual harness debugger exposes responses, outcomes, template values, diagnostics, validation messages, serialized state, package item navigation, action history, and accessibility proof scripts.
- Public fixtures are synthetic and MIT-licensed. Private, generated, or customer packages stay outside this repository unless explicitly scrubbed and licensed for publication.
- Package and assessment-test support is limited to item discovery, item-reference traversal, asset resolution, validation, and item loading. A full runner/controller remains a host-product concern.

## Publishing

Packages publish under the `longsightgroup` npm organization:

- `@longsightgroup/qti3-core`
- `@longsightgroup/qti3-player`
- `@longsightgroup/qti3-fixtures`
- `@longsightgroup/qti3-conformance`
- `@longsightgroup/qti3-a11y`
- `@longsightgroup/qti3-cli`

Releases are published from the `longsightgroup/qti3` repository after the full release
check passes. Package tarballs are generated from the same checked build output that CI
verifies.
