# @longsightgroup/qti3-player

Style-neutral web component player for QTI 3 assessment items.

This package renders one QTI item at a time, captures responses, validates responses,
scores attempts through `@longsightgroup/qti3-core`, and emits host-readable state events.

## Install

```sh
npm install @longsightgroup/qti3-player
```

## Use

```ts
import { defineQtiAssessmentItemPlayer } from "@longsightgroup/qti3-player";

defineQtiAssessmentItemPlayer();
```

```html
<qti-assessment-item-player id="player"></qti-assessment-item-player>
```

```ts
const player = document.querySelector("qti-assessment-item-player");

await player?.loadXml(xml, {
  status: "interacting",
  sessionControl: {
    validateResponses: true,
    showFeedback: true,
  },
});

player?.addEventListener("qti-statechange", (event) => {
  console.log(event.detail.state);
});
```

## Scoring Trust Boundary

The player can score attempts locally through `@longsightgroup/qti3-core`, but browser
scoring is a convenience for validation, feedback, previews, and response snapshots.
High-stakes assessment systems must treat browser outcomes as untrusted and recompute
scores server-side from authoritative QTI XML and trusted response variables.

## Player Chrome Messages (host-owned i18n)

The player keeps **authored QTI content** (prompts, choice labels, `title` on
end-attempt) separate from **player chrome** (remove buttons, aria labels, live-region
status, gap labels).

Only **English** ships in the package. `language-of-interface="sv-SE"` does **not**
change chrome by itself; the host loads a locale file.

### Locale files (recommended)

A host application or LMS maintains JSON (or ICU/Fluent exported to JSON) with the shape
`PlayerMessageCatalog`: a flat `strings` map, optional `interactionTypes`, and
`directions`. Copy `defaultPlayerMessageCatalog` from the package as the template; omit
keys you do not need to translate (missing keys fall back to English).

```ts
import type { PlayerMessageCatalog } from "@longsightgroup/qti3-player";

const sv = (await fetch("/locales/player/sv-SE.json")).json() as PlayerMessageCatalog;

player.languageOfInterface = "sv-SE";
player.messageCatalog = sv;
await player.loadXml(xml);
```

Example entries:

```json
{
  "locale": "sv-SE",
  "strings": {
    "remove": "Ta bort",
    "removePair": "Ta bort {label}",
    "associationPairLabel": "{source} med {target}",
    "extendedTextCounter": "{count} av {expectedLength}",
    "sliderNoResponse": "Inget svar valt",
    "associationsMade.one": "{count} koppling skapad.",
    "associationsMade.other": "{count} kopplingar skapade."
  },
  "interactionTypes": {
    "graphicOrder": "Grafisk ordning"
  },
  "directions": { "up": "upp", "down": "ner", "left": "vänster", "right": "höger" }
}
```

Templates use `{placeholder}` names. For English-style singular/plural, use
`messageKey.one` and `messageKey.other` (for example `associationsMade.one`). Languages
that do not inflect by count can use a single key for plural message ids.

Validate locale files in CI with `validatePlayerMessageCatalog()` — pass `JSON.parse` output
directly (`unknown`). Shape errors (non-object root, missing `strings`, numeric templates, bad
`directions` / `interactionTypes`) return diagnostics instead of throwing:

```ts
import { validatePlayerMessageCatalog } from "@longsightgroup/qti3-player";

const raw = JSON.parse(await readFile("locales/player/sv-SE.json", "utf8"));
const result = validatePlayerMessageCatalog(raw);
if (!result.valid) {
  for (const issue of result.diagnostics) {
    console.error(`${issue.code} ${issue.key}: ${issue.message}`);
  }
  process.exit(1);
}
```

Use `requireAllKeys: true` only for complete locale files forked from `defaultPlayerMessageCatalog`.
Partial delivery catalogs should omit that flag.

Reference exports:

- `PLAYER_MESSAGE_KEYS` — message ids from `PLAYER_MESSAGE_MANIFEST`
- `PLAYER_MESSAGE_STRING_KEYS` — all keys in `defaultPlayerMessageCatalog.strings`
- `defaultPlayerMessageCatalog` — English template to fork
- `allowedCatalogPlaceholders(entry)` — placeholders a template may use
- `requiredCatalogPlaceholders(catalogKey)` — placeholders required for that key per English default
- `createPlayerMessageResolver(catalog)` — canonical key-driven runtime API
- `PlayerMessageParams<K>` — typed params for `message(key, params)`

Resolver kinds in the manifest (hosts only edit `strings`; behavior is fixed):

| Resolver            | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `plain`             | Static string                                        |
| `template`          | `{placeholder}` interpolation from params            |
| `plural`            | Uses `key.one` / `key.other` when `count` is present |
| `typeLabel`         | Interaction type short name from `interactionTypes`  |
| `typeTemplate`      | Template with `{typeName}` derived from `type`       |
| `directionTemplate` | Template with localized `{direction}`                |

### Runtime API

Chrome resolves to a key-driven `PlayerMessageResolver`:

```ts
const messages = resolvePlayerMessages(locale, {}, catalog);

messages.message("remove");
messages.message("removePair", { label: pairLabel });
messages.message("associationsMade", { count: 2 });
```

`createPlayerMessageResolver(catalog)` builds the same resolver directly from a locale file.

### Per-message overrides

`player.messages` accepts `QtiPlayerMessageOverrides` — each key uses the same param types as
`message(key, params)` (for example `removePair: ({ label }) => ...`). Use only when a catalog
entry is not enough; composed strings (for example `removePair` using `associationPairLabel`
text) are easy to break.

### Item language vs interface language

Do not copy item `xml:lang` onto `<qti-assessment-item-player lang="...">` unless you
intentionally want the player element's `lang` attribute to influence
`defaultPlayerLocale()`. Prefer `player.messageCatalog` for UI chrome.

## Slider behavior

The slider presentation is custom, but its only operable element is a native
`<input type="range">`. This preserves browser pointer, touch, keyboard, and accessibility
semantics while supporting QTI `orientation`, `reverse`, and `step-label` presentation.

An interaction without a default or restored response remains null: the thumb and fill are hidden,
and the localized `sliderNoResponse` message is shown until the candidate acts. Boundary keys and
pointer release still commit the lower bound when the native range value itself does not move.

Aligned discrete sliders preserve the authored native range step. Continuous sliders and sliders
whose upper bound sits outside the regular step sequence use `step="any"`, with core snapping
pointer and keyboard values onto the authored domain. Arrow keys on either axis move along that
domain; reverse only flips physical direction. Restored responses outside the authored domain are
rejected before rendering.

Lower and upper labels are always shown. With `step-label="true"`, the player shows every step when
there are at most nine positions; denser ranges are sampled to at most nine evenly distributed
labels, including both bounds, to avoid overlapping text and unbounded DOM growth.

Slider attributes are refined by the core before rendering. Invalid value domains render a
non-operable authoring error. Integer bounds follow the QTI floor/ceiling rules, and float sliders
with no authored step remain approximately continuous.

## Media behavior

The media presentation is a native `<audio>` or `<video>` element. That is the only operable
control; the QTI response is a play-experience count, not media time.

Native HTML `loop` is used only when `max-plays` is unlimited. A finite play limit keeps looping
off so each play experience can be counted. Invalid play-domain attributes render a non-operable
authoring error.

## Portable Custom Interactions

For `qti-portable-custom-interaction`, the player renders a
`qti3-portable-custom-host` element, passes small module/configuration metadata through
`dataset` attributes, and emits `qti-portable-custom-mount` with the full parsed
definition. Host code can attach a PCI runtime and send response/state updates back with
`qti3-portable-custom-response`.
Production sandboxing, CSP, origin policy, and audit logging belong to the host delivery
system.

## Framework adapters

Optional React and Preact TSX wrappers ship as separate packages. They keep the web component as
the rendering primitive and only handle framework lifecycle wiring:

- `@longsightgroup/qti3-player-react`
- `@longsightgroup/qti3-player-preact`

Use the native element directly when you do not need React or Preact integration.

Local manual proof for the React adapter: from the repo root run
`pnpm dev:adapter-react` and open `/adapter-react.html` (linked from the main manual harness).

## Clearing a loaded item

`clearItem()` (or omitting declarative `xml` on the adapters) removes rendered content and in-memory
session state. It does not emit `qti-statechange` or other player events because no item is loaded.
Hosts should treat the prop transition or imperative call as the source of truth.

The last committed item remains available while a replacement `loadUrl()` request is pending. If
the latest load reaches a handled fetch, parse, or restored-state error, the player displays its
error alert and transitions to an unloaded state. `serialize()` and item getters then return
`undefined` or an empty collection according to their existing return types. A failure from a
superseded load cannot clear a newer item.

This error transition does not emit `qti-statechange`. Hosts can observe the typed `qti-diagnostics`
event and the rendered alert when coordinating load-error UI.

Framework adapters treat `xml={undefined}` as a clear and `xml=""` as a load attempt. An empty
string shows the parse error view when the XML is invalid.

Restored `loadOptions.state` reload keys use JSON serialization: equivalent content with different
object references does not reload, but key order follows construction order and in-place mutation
without a reload key change is not detected.

## Interaction regions

Hosts that need overlays, accessibility evidence, proctoring, analytics, or support tooling can
query stable rendered regions without depending on private player classes:

```ts
const regions = player.getInteractionRegions();
```

Each region includes `kind`, `interactionType`, optional response/choice identifiers, an optional
label, a fresh viewport-relative `bounds` snapshot from `getBoundingClientRect()`, and the rendered
`element`. Every supported interaction exposes at least one `interaction` region. Renderers expose
additional `choice`, `control`, `source`, `target`, `surface`, or `placement` regions where that
granularity is meaningful.

The same contract is available as public DOM markers:

```html
data-qti-player-region data-qti-player-region-kind="choice"
data-qti-player-interaction-type="choice" data-qti-player-response-identifier="RESPONSE"
data-qti-player-choice-identifier="A"
```

Only `data-qti-player-*` markers are stable for host querying. Internal `qti3-*` classes and generic
renderer attributes such as `data-choice-identifier` may change across releases.

Region bounds are layout snapshots. Re-query after scrolling, resizing, rerendering, font loading,
opening or closing popups, or response changes that affect layout. Hidden regions are excluded; for
example, inline-choice options are returned only while the listbox is open.

### Nested regions and hit testing

`getInteractionRegions()` returns every visible marked element. Ancestor `interaction` regions often
wrap descendant `choice`, `control`, `source`, `target`, `surface`, or `placement` regions. For
example, inline-choice exposes a `control` wrapper and `choice` options inside it; graphic
interactions expose a `surface` plus per-hotspot `choice` or `placement` regions.

For overlays, proctoring hit targets, or analytics element counts, prefer the most specific visible
region for the interaction you care about:

- Use leaf `choice`, `control`, `source`, `target`, `surface`, or `placement` regions for per-option
  or per-control hit testing.
- Use the ancestor `interaction` region when you need the full interaction chrome (prompt, response
  area, and validation messaging) as one box.

Region `label` values come from `aria-label`, `title`, and finally trimmed `textContent`.

### Region kind semantics

| Kind          | Typical use                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `interaction` | Full interaction wrapper (block or embedded section)                                    |
| `choice`      | Selectable option, hotspot, or hottext token                                            |
| `control`     | Text input, slider, upload, media element, end-attempt button, or other primary control |
| `source`      | Draggable token in a source bank                                                        |
| `target`      | Drop target, gap, or match target                                                       |
| `surface`     | Graphic canvas, drawing surface, or coordinate picking area                             |
| `placement`   | Placed token or movable marker on a graphic surface                                     |

Tabular match interactions expose one `control` region per matrix cell toggle rather than separate
`source` and `target` regions.

## Catalog support (host chrome)

Catalog cards are dormant metadata until the host opts into specific supports. The player does not
choose a glossary popup, translation panel, audio player, or other presentation on the host's
behalf.

Use `getRenderedCatalogReferences()` to relate authored `data-catalog-idref` values to current live
elements without querying private player markup. Each result has a stable `referenceId`, the
`catalogId`, authored `qtiName`, source location, and current `element`. Re-query after a rerender;
the identifier remains stable for the loaded item, while the element may be replaced.

Use `getCatalogDeliveryResolution()` for sanitized, structured support content. Inline HTML is an
allowlisted node tree rather than an HTML string. Package-relative URLs pass through the
`resolveAsset` supplied at load time, while media fragments and authored MIME types are preserved.
Unsafe elements, attributes, URLs, and unsafe resolver output are omitted.

To expose candidate request controls, provide an explicit policy:

```ts
player.catalogRequestPolicy = {
  supports: ["glossary-on-screen", "keyword-translation"],
  languages: ["fr-CA", "fr"],
  includeDefaultFallback: true,
};

player.addEventListener("qti-catalogrequest", (event) => {
  const { reference, delivery, activation } = event.detail;
  showSupportInHostChrome({
    matches: delivery.matches,
    origin: reference.element,
    activation,
  });
});
```

The opt-in adds a localized native button adjacent to each matching rendered reference, giving
pointer and keyboard requests the same event contract. `activation` is `"pointer"`, `"keyboard"`,
or `"programmatic"`. Hosts can call `requestCatalog(referenceId)` for their own affordances. A
request returns `false` when the reference is unavailable, has no policy match, or the attempt is
suspended or completed.

`getCatalogSupportResolution()` remains available when a host needs the raw parsed core model.
React and Preact expose the same `catalogRequestPolicy`, `onCatalogRequest`, and imperative handle
methods as the Web Component.

## Companion materials (host chrome)

`qti-companion-materials-info` is item metadata, not item-body content. The player parses
physical and digital companion materials into the core model but does not render a materials panel.
Hosts read them after load and present them in product chrome such as a sidebar, pre-test screen,
or printable instructions view.

```ts
const resolution = player.getCompanionMaterialsResolution();
```

`physicalMaterials` contains non-empty instruction text such as "Bring a printed formula sheet."
`digitalMaterials` contains authored `fileHref` values plus optional `label`, `mimeType`, and
`resourceIcon` metadata lifted from element attributes. `unparsedChildren` lists unsupported
companion material elements that were preserved for tolerance diagnostics.

When items are delivered from a QTI package, pass `resolveAsset` in `loadXml` / `loadUrl` so
resolved URLs are available for host links:

```ts
await player.loadXml(xml, {
  resolveAsset: (url) => packageAssetUrlFor(url),
  resolveStylesheet: (stylesheet) => ({
    href: packageStylesheetUrlFor(stylesheet.href),
  }),
});

const materials = player.getCompanionMaterialsResolution();
const reference = materials?.digitalMaterials[0];
const href = reference?.resolvedFileHref ?? reference?.fileHref;
```

You can also call `createCompanionMaterialsResolution()` from `@longsightgroup/qti3-core` in Node
for inspection or server-side delivery planning.

`qti-stylesheet` delivery uses `resolveStylesheet` instead of `resolveAsset`. Core preserves the
authored metadata, while the host resolves package-local CSS to a candidate-safe URL. The player
attaches only resolved stylesheets and reports `player.stylesheet.unresolved` when a supplied
resolver declines one. Package import, path validation, immutable asset storage, authorization, and
unsafe URL rejection remain host responsibilities.

When `resolveStylesheet` is omitted, the player does not attach item stylesheets and does not emit
`player.stylesheet.unresolved` diagnostics. That silence is intentional opt-out, not a delivery
failure.

## Styling

The player uses light DOM and is style-neutral by design. Host applications can style
the rendered `qti3-*` classes directly while preserving the item author's QTI shared
vocabulary classes.

### Keyword emphasis

`qti-keyword-emphasis` is candidate-conditional. The player preserves the authored class
without applying special visual styling by default. After the host delivery system resolves
the candidate's AfA/PNP and finds `keyword-emphasis`, opt in before or after loading the
item:

```ts
player.keywordEmphasisEnabled = true;
// Equivalent DOM API:
player.setAttribute("data-keyword-emphasis", "true");
```

When enabled, the rendered `.qti3-player` root receives `data-keyword-emphasis="true"` and
the bundled stylesheet visibly emphasizes `.qti-keyword-emphasis`. Set
`player.keywordEmphasisEnabled = false` or remove `data-keyword-emphasis` to return to the
default inert presentation.

Screen-reader status lines (`.qti3-selection-summary`, `aria-live="polite"`) are
visually hidden by default so LMS shells do not show reorder or selection announcements
to sighted users. They remain available to assistive technology. Set
`data-show-live-regions` on `qti-assessment-item-player` only in local debug or harness
pages when you want those messages visible on screen.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
