# Plan 002: Give media a core play-count domain and one native playback path

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving to the next step. If anything in the "STOP conditions"
> section occurs, stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 1bbedc3..HEAD -- packages/core/src/response-validation-policy.ts packages/core/src/validation-interactions.ts packages/core/src/index.ts packages/core/src/support-evidence.ts packages/player/src/interactions/object-asset.ts packages/player/src/interactions/interaction-registry.ts packages/player/src/response-limits.ts tests/browser/player-media.spec.ts packages/player/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts
> against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `1bbedc3`, 2026-08-14

## Why this matters

`qti-media-interaction` looks like a native `<audio>` / `<video>` control, but the QTI response is
an integer **play-experience count** with `min-plays`, `max-plays`, `autostart`, and `loop`. Today
core only re-reads those attributes for scoring limits, while the player re-parses booleans locally,
sets native `loop` even when `max-plays` is finite, and encodes “what counts as a play” as event
listeners (`currentTime <= 0.25`, `seeked`, pause-delay dataset flags).

That is the same failure mode slider had before `parseQtiSliderDefinition`: a native widget plus a
richer QTI domain, with the domain living in compensating listeners. After this plan, core owns the
plays policy and the play-session machine. The player feeds media events into that machine and sets
native `loop` only when QTI looping is actually unlimited.

## Current state

### Relevant files

- `packages/core/src/slider-definition.ts` — exemplar definition parser. Copy this _shape_
  (`parseQtiXDefinition` → `{ ok: true, value } | { ok: false, diagnostics }`), not slider fields.
- `packages/core/src/response-validation-policy.ts` — `mediaPlayCount`, `minimumMediaPlays`,
  `maximumMediaPlays` currently re-parse raw attributes.
- `packages/core/src/validation-interactions.ts` — media `min-plays` / `max-plays` / `autostart` /
  `loop` checks live in `validateInteractionLimitAttributes` as a special-case block.
- `packages/core/src/parser-values.ts` — canonical `parseXmlBoolean` (`true`/`false`/`1`/`0`).
- `packages/player/src/interactions/object-asset.ts` — the entire media renderer, misnamed. It is
  only imported by the media registry entry.
- `packages/player/src/interactions/interaction-registry.ts` — media calls `renderObjectAsset`.
- `packages/player/src/player-validation.ts` — `errorView` for non-operable authoring errors.
- `tests/browser/player-media.spec.ts` — native controls, pause timers, play-count, min-plays scoring.
- `packages/core/src/support-evidence.ts` — media browser evidence is only `player-media.spec.ts`.

### Player re-parses booleans and always applies native loop

At `packages/player/src/interactions/object-asset.ts:11-15` and `:86-87`:

```ts
function parseBooleanAttribute(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

media.autoplay = parseBooleanAttribute(interaction.attributes.autostart) ?? false;
media.loop = parseBooleanAttribute(interaction.attributes.loop) ?? false;
```

`parseXmlBoolean` already exists in core and also trims/lowercases. The local helper is a near-duplicate
and silently treats invalid `autostart`/`loop` as `false`.

The Playwright suite currently expects native `loop` whenever authored `loop="true"` and no
`max-plays` is present (`tests/browser/player-media.spec.ts:27-43`). There is **no** test for
`loop="true"` combined with a finite `max-plays`.

### Play-count policy is event-listener spaghetti

At `packages/player/src/interactions/object-asset.ts:308-364`, `bindMediaPlayCount`:

- skips increment when `dataset.qtiMediaPlayerPauseState === "delay"`
- pauses and refuses when `playCount >= maximum` and no session is active
- increments only when `!activePlaySession && (readyAfterEnded || currentTime <= 0.25)`
- `ended` clears the session and sets `readyAfterEnded`
- `seeked` to `currentTime <= 0.25` while paused clears the session without incrementing

That `0.25` threshold is load-bearing. Preserve it as a named core constant. Do not “improve” it.

### Core already has limit helpers, but not a definition

At `packages/core/src/response-validation-policy.ts:72-86`:

```ts
export function mediaPlayCount(value: QtiValue): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function minimumMediaPlays(interaction: QtiInteraction): number {
  const parsed = parseNonNegativeInteger(interaction.attributes["min-plays"]);
  if (parsed !== undefined) return parsed;
  return interactionRequiresResponse(interaction) ? 1 : 0;
}

function maximumMediaPlays(interaction: QtiInteraction): number | undefined {
  const parsed = parseNonNegativeInteger(interaction.attributes["max-plays"]);
  return parsed === undefined || parsed <= 0 ? undefined : parsed;
}
```

Authored `max-plays="0"` already means unlimited. Keep that. `required="true"` without `min-plays`
already defaults minimum plays to 1. Keep that.

Validation special-case at `packages/core/src/validation-interactions.ts:492-498`:

```ts
if (interaction.type === "media") {
  validateNonNegativeIntegerAttribute(interaction, "max-plays", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "min-plays", diagnostics);
  validateBooleanAttribute(interaction, "autostart", diagnostics);
  validateBooleanAttribute(interaction, "loop", diagnostics);
  validateMinMaxPair(interaction, "min-plays", "max-plays", diagnostics);
}
```

Slider already moved this pattern to `parseQtiSliderDefinition` called from
`validateInteractionRequiredAttributes` (`packages/core/src/validation-interactions.ts:307-310`).
Media should do the same. Do **not** add `interaction.type !== "media"` to the generic base-type
checker — media stays `single` / `integer` there.

### Conventions to match

- Definition parser: `packages/core/src/slider-definition.ts` and `slider-definition.test.ts`.
- Invalid interaction render: `packages/player/src/interactions/slider-interaction.ts` uses
  `errorView(...)` plus a type-specific class (`qti3-slider-invalid`).
- Player re-parses the definition; it does not assume item validation already ran.
- Core tests are DOM-free Vitest. Anything that creates media elements, ARIA, or browser events
  belongs in `tests/browser/player-media.spec.ts`. Do not add `happy-dom` / `jsdom`.
- Public core exports go through `packages/core/src/index.ts`.
- Formatting: `oxfmt`. Linting: `oxlint --deny-warnings`. Quality gate: `pnpm verify`.
- Commit style observed on this repo: `feat: harden slider interaction rendering`.

## Commands you will need

| Purpose       | Command                                                                                                                                                               | Expected on success     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Format        | `pnpm exec oxfmt --write <files>`                                                                                                                                     | exit 0                  |
| Typecheck     | `pnpm typecheck`                                                                                                                                                      | exit 0                  |
| Core tests    | `pnpm exec vitest run packages/core/src/media-definition.test.ts`                                                                                                     | all pass                |
| Policy tests  | `pnpm exec vitest run packages/core/src/response-validation-policy.test.ts packages/core/src/response-validation.test.ts packages/player/src/response-limits.test.ts` | all pass                |
| Browser tests | `pnpm exec playwright test tests/browser/player-media.spec.ts`                                                                                                        | all pass, including new |
| Lint          | `pnpm lint:raw`                                                                                                                                                       | exit 0                  |
| Full gate     | `pnpm verify`                                                                                                                                                         | exit 0                  |

## Suggested executor toolkit

- Follow `packages/core/src/slider-definition.ts` as the parser/result pattern.
- Follow AGENTS.md testing rules: Vitest stays Node/DOM-free; Playwright owns media element behavior.

## Scope

**In scope** (the only files you should modify, plus new files listed in steps):

- `packages/core/src/media-definition.ts` (create)
- `packages/core/src/media-definition.test.ts` (create)
- `packages/core/src/index.ts`
- `packages/core/src/validation-interactions.ts`
- `packages/core/src/response-validation-policy.ts`
- `packages/core/src/support-evidence.ts`
- `packages/player/src/interactions/media-interaction.ts` (create; replace `object-asset.ts`)
- `packages/player/src/interactions/object-asset.ts` (delete after the move, or leave a one-line re-export only if something still imports it — at plan time only `interaction-registry.ts` imports it)
- `packages/player/src/interactions/interaction-registry.ts`
- `tests/browser/player-media.spec.ts`
- `packages/player/README.md`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `packages/writer/src/media.ts` — writer keeps its own builder input; do not route it through `QtiInteraction`.
- Shared-vocabulary media control tokens, pause-delay, pause-duration validation
  (`packages/core/src/shared-vocabulary*.ts`). Pause _timers_ stay in the player.
- Custom media chrome. `data-qti-media-player-controls="none"` must remain “no native controls,
  no replacement UI”.
- Autoplay-policy workarounds. If the browser blocks `autostart`, that is not a player bug.
- Upload / drawing file-response work.
- Select-point / position-object coordinate domain work.
- Changing `mediaPlayCount`’s public return value for `0` / `null` / non-integers.

## Git workflow

- Branch: `advisor/002-media-play-domain`
- Commit per logical unit; message style: `feat: give media a core play-count domain`
- Do NOT push or open a PR unless the operator instructed it.

## Target model

```ts
export interface QtiMediaDefinition {
  readonly minPlays: number;
  readonly maxPlays: number | undefined; // undefined = unlimited, including authored 0
  readonly autostart: boolean;
  readonly loop: boolean;
  readonly required: boolean;
}

export type QtiMediaDefinitionResult =
  | { readonly ok: true; readonly value: QtiMediaDefinition }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Native HTML loop is allowed only when QTI looping is unlimited. */
export function qtiMediaAllowsNativeLoop(definition: QtiMediaDefinition): boolean {
  return definition.loop && definition.maxPlays === undefined;
}

export const QTI_MEDIA_RESTART_THRESHOLD_SECONDS = 0.25;

export interface QtiMediaPlaySession {
  readonly playCount: number;
  readonly active: boolean;
  readonly readyAfterEnded: boolean;
}

export type QtiMediaPlaybackEvent =
  | {
      readonly kind: "play";
      readonly currentTime: number;
      readonly pauseState?: "delay" | "pause";
    }
  | { readonly kind: "ended" }
  | { readonly kind: "seeked"; readonly currentTime: number; readonly paused: boolean };

export interface QtiMediaPlaybackResult {
  readonly session: QtiMediaPlaySession;
  readonly increment: boolean;
  readonly blockPlay: boolean;
}

export function applyQtiMediaPlaybackEvent(
  session: QtiMediaPlaySession,
  event: QtiMediaPlaybackEvent,
  definition: QtiMediaDefinition,
): QtiMediaPlaybackResult;
```

`applyQtiMediaPlaybackEvent` must reproduce today’s `bindMediaPlayCount` outcomes:

| Event                                                          | Condition   | Result                                                                     |
| -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `play`, `pauseState === "delay"`                               | —           | no increment, session unchanged enough that delay resume is not a new play |
| `play`, not active, `playCount >= maxPlays`                    | max defined | `blockPlay: true`, no increment                                            |
| `play`, not active, `readyAfterEnded \|\| currentTime <= 0.25` | under max   | increment, `active: true`                                                  |
| `play`, already active                                         | —           | no increment, stay active                                                  |
| `ended`                                                        | —           | `active: false`, `readyAfterEnded: true`                                   |
| `seeked`, paused, `currentTime <= 0.25`                        | —           | `active: false`, `readyAfterEnded: false`                                  |

Do not put pause-delay/duration seconds on the definition. Those are shared-vocabulary presentation.
The player keeps `bindMediaPauseTiming` and passes `pauseState` into the event.

## Steps

### Step 1: Add `parseQtiMediaDefinition` and the play-session machine

Create `packages/core/src/media-definition.ts`.

Parser rules:

- Collect every diagnostic, then return `ok: false` if any exist. Do not early-return before
  checking the other attributes.
- `min-plays` / `max-plays`: missing is allowed. Present value must be a non-negative integer.
  Diagnostic codes must stay `interaction.integerAttribute` / `interaction.minMax` so
  `packages/core/src/core.test.ts` media cases keep passing.
- `autostart` / `loop` / `required`: missing → `false`. Invalid → `interaction.booleanAttribute`
  with the same message shape as `validateBooleanAttribute`.
- If both min and max are present and finite, require `min <= max` (`interaction.minMax`).
- `maxPlays`: omit/`0` → `undefined` (unlimited).
- `minPlays`: omit → `required ? 1 : 0`.
- Do **not** emit `interaction.baseType`. The generic response-shape checker already requires
  integer.

Export the new symbols from `packages/core/src/index.ts` next to the slider definition exports.

Create `packages/core/src/media-definition.test.ts` modeled on `slider-definition.test.ts`:

- invalid `autostart` / `loop` / `min-plays` / inverted min>max each produce focused diagnostics
- `required="true"` without `min-plays` → `minPlays: 1`
- `max-plays="0"` → `maxPlays: undefined`
- `loop` true + unlimited max → `qtiMediaAllowsNativeLoop` true
- `loop` true + `max-plays="2"` → `qtiMediaAllowsNativeLoop` false
- session machine table above (increment, resume, ended restart, seek reset, delay skip, block at max)

**Verify**: `pnpm exec vitest run packages/core/src/media-definition.test.ts` → all pass.

### Step 2: Point validation and limit helpers at the definition

In `packages/core/src/validation-interactions.ts`:

- Import `parseQtiMediaDefinition`.
- In `validateInteractionRequiredAttributes`, add a media branch next to slider:

```ts
if (interaction.type === "media") {
  const definition = parseQtiMediaDefinition(interaction);
  if (!definition.ok) diagnostics.push(...definition.diagnostics);
}
```

- Delete the `if (interaction.type === "media") { ... }` block inside
  `validateInteractionLimitAttributes`. Leave the generic min-choices / required checks as they are.

In `packages/core/src/response-validation-policy.ts`, implement `minimumMediaPlays` /
`maximumMediaPlays` via the definition when `ok`, preserving today’s numeric results. Keep
`mediaPlayCount` behavior unchanged.

Do not add a media exception to `validateInteractionResponseShape`.

**Verify**:

```
pnpm exec vitest run packages/core/src/media-definition.test.ts packages/core/src/response-validation-policy.test.ts packages/core/src/response-validation.test.ts packages/core/src/core.test.ts
```

→ all pass, including the existing media validation case around `core.test.ts:2868` (`autostart="maybe"`, `loop="sometimes"`, `min-plays="3"` / `max-plays="2"`).

### Step 3: Move the player renderer onto the definition and one event path

1. Move `packages/player/src/interactions/object-asset.ts` to
   `packages/player/src/interactions/media-interaction.ts`.
2. Rename `renderObjectAsset` to `renderMediaResponse`.
3. Update `packages/player/src/interactions/interaction-registry.ts` to import
   `renderMediaResponse` from `./media-interaction.js`.
4. Delete `object-asset.ts` once nothing imports it (`rg renderObjectAsset packages` must be empty).
5. At the top of `renderMediaResponse`, parse the definition. If `!ok`, return `errorView(...)` with
   class `qti3-media-invalid`, same wording pattern as slider (`Slider interaction (RESPONSE) has
invalid authored attributes.` → media equivalent). Do not render an operable `<audio>`/`<video>`.
6. Delete local `parseBooleanAttribute`. Set:

```ts
media.autoplay = definition.autostart;
media.loop = qtiMediaAllowsNativeLoop(definition);
```

7. Replace the body of `bindMediaPlayCount` with a `QtiMediaPlaySession` variable. On `play` /
   `ended` / `seeked`, call `applyQtiMediaPlaybackEvent`. If `increment`, `update(session.playCount)`.
   If `blockPlay`, `media.pause()`. Keep writing `data-play-count` and `data-max-plays-reached` as
   today so existing Playwright assertions stay valid.
8. Keep `bindMediaPauseTiming` in this file. It must still set
   `dataset.qtiMediaPlayerPauseState` so the play event can pass `pauseState: "delay"`.
9. Image and fallback-link rendering for non-audio/video objects stays as-is (no play binding).

Do not let `media-interaction.ts` cross 1000 lines. Pause timing can remain a local function in the
same file; do not extract a third abstraction unless the file would otherwise exceed 1000 lines.

**Verify**: `pnpm typecheck` → exit 0. `rg parseBooleanAttribute packages/player` → no matches.

### Step 4: Browser coverage for loop vs max-plays and invalid attributes

In `tests/browser/player-media.spec.ts`:

- Keep the existing `loop="true"` without `max-plays` test expecting the `loop` attribute.
- Add a test: `loop="true" max-plays="2"` → native `loop` attribute **absent**, first two play
  experiences count, a third `ended`+`play` stays at 2 and sets `data-max-plays-reached`.
- Add a test: invalid `autostart="maybe"` / inverted plays → no `<audio>`/`<video>`,
  `.qti3-media-invalid` alert is shown.
- Existing pause-timing and resume-does-not-count tests must still pass.

In `packages/core/src/support-evidence.ts`, include
`packages/core/src/media-definition.test.ts` in media’s `interactionSupportTests` (same idea as
`pattern-mask.test.ts` for text entry). Keep `tests/browser/player-media.spec.ts` in
`browserTestsFor("media")`.

Add a short **Media behavior** section to `packages/player/README.md` (after the slider section if
present, otherwise near Portable Custom):

- Native audio/video is the only operable control.
- Response is play-experience count, not media time.
- Native `loop` is used only when `max-plays` is unlimited.
- Invalid play-domain attributes render a non-operable authoring error.

**Verify**: `pnpm exec playwright test tests/browser/player-media.spec.ts` → all pass.

### Step 5: Format, verify, update the index

Run `pnpm exec oxfmt --write` on every touched file, then `pnpm verify`.

Update this plan’s status row in `plans/README.md` to `DONE`.

**Verify**: `pnpm verify` → exit 0. `git status` shows only in-scope files.

## Test plan

New tests in `packages/core/src/media-definition.test.ts`:

- happy path: omitted plays + `autostart="false"` → `minPlays: 0`, `maxPlays: undefined`, `autostart: false`
- `required` default min plays
- unlimited `max-plays="0"`
- native-loop allowed / denied
- every session-machine row in the table above
- collect-all diagnostics for invalid boolean + inverted min/max together, with a **single**
  `interaction.booleanAttribute` per bad attribute (no duplicates)

New Playwright cases in `tests/browser/player-media.spec.ts` as in Step 4.

Pattern files:

- core: `packages/core/src/slider-definition.test.ts`
- browser: existing `counts media play experiences without counting pause resume` in
  `tests/browser/player-media.spec.ts`

Verification:

```
pnpm exec vitest run packages/core/src/media-definition.test.ts
pnpm exec playwright test tests/browser/player-media.spec.ts
pnpm verify
```

All pass, including the new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm exec vitest run packages/core/src/media-definition.test.ts` exits 0
- [ ] `pnpm exec playwright test tests/browser/player-media.spec.ts` exits 0
- [ ] `pnpm verify` exits 0
- [ ] `rg parseBooleanAttribute packages/player` returns no matches
- [ ] `rg renderObjectAsset packages` returns no matches
- [ ] `rg "media.loop = parseBooleanAttribute" packages` returns no matches
- [ ] `packages/player/src/interactions/media-interaction.ts` exists and is under 1000 lines
- [ ] `packages/core/src/media-definition.ts` exists and is under 1000 lines
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 is `DONE`

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts.
- A step’s verification fails twice after a reasonable fix attempt.
- `renderObjectAsset` is imported from somewhere other than the media registry entry.
- Making `loop` + finite `max-plays` deny native `loop` would require changing a documented QTI
  3.0.1 behavior note in-repo that contradicts this plan.
- Pause-timing tests fail unless the play-session machine learns pause-delay _seconds_ (not just
  `pauseState`). If that happens, stop — do not move timers into core.
- The change appears to require editing `packages/writer/src/media.ts` or shared-vocabulary modules.
- `media-interaction.ts` or `media-definition.ts` would exceed 1000 lines.

## Maintenance notes

- Reviewers should check that native `loop` is a projection of `qtiMediaAllowsNativeLoop`, not a
  second policy. If someone later adds custom looping UI, it must still call
  `applyQtiMediaPlaybackEvent`.
- The `0.25s` restart threshold is an empirical native-media heuristic. If a browser starts failing
  the resume-does-not-count test, change the constant in core and cover it with a unit test — do not
  reintroduce a magic number in the player.
- Follow-ups explicitly deferred: upload/drawing file values; select-point coordinate domain;
  custom media control chrome; writer reuse of `QtiMediaDefinition`.
