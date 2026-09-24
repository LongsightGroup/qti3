# Plan 041: Write per-answer modal feedback for single-choice items

> **Executor instructions:** Follow the steps in order. Run each verification gate. Stop on a listed STOP condition rather than broadening the public API by guesswork. Update the plan's status in `plans/README.md` when finished.
>
> **Drift check:** Run `git diff --stat 2214801..HEAD -- packages/writer/src/types.ts packages/writer/src/index.ts packages/writer/src/choice.ts packages/writer/src/shell.ts packages/writer/src/response-processing.ts packages/writer/src/choice.test.ts packages/writer/src/validation.test.ts packages/writer/README.md`. If these files changed, compare the current state below with live code before editing.

## Status

- **Priority:** P1
- **Effort:** M
- **Risk:** MED (public authoring model and response-processing semantics)
- **Depends on:** none
- **Category:** bug / authoring capability
- **Planned at:** commit `2214801`, 2026-09-24
- **Source issue:** [LongsightGroup/qti3#29](https://github.com/LongsightGroup/qti3/issues/29)

## Why this matters

Rebuilding an item with `buildQti3ChoiceItem` currently drops `qti-modal-feedback`, its outcome declaration, and the processing that selects it. The output still parses and scores, so an authoring save can silently remove explanations for individual answers. Add a typed, opt-in choice feedback model that emits all three linked QTI pieces and rejects unsupported combinations. This is semantic feedback support for single-choice items, not a generic lossless XML round-trip API.

## Current state

- `packages/writer/src/types.ts:78-112`: `Qti3AuthoringItemBase` has common content fields; `Qti3ChoiceAuthoringItem` has choices, correct responses, and `scoring`, but no feedback field. `Qti3TrustedXmlFragment` is the established caller trust boundary for rich XML. Choice bodies already use optional `text` plus optional `contentHtml`, with diagnostics rather than a discriminated union. Match that.
- `packages/writer/src/index.ts:58-67`: public types are a named export list, not `export type *`. A new feedback type is invisible to package consumers until it is added beside `Qti3ChoiceAuthoringItem`. `writeQti3AssessmentItemResult` (`index.ts:182-186`) already validates through `validateQti3AuthoringItem` and renders the choice item, so the new field needs no second writer path.
- `packages/writer/src/choice.ts:23-26,35-47,79-84`: the builder validates, writes a response declaration, then calls `assessmentItemShell` with a processing template. It defaults to `match_correct`; `map_response` is also supported. `resolveResponseIdentifier` supplies the response identifier and defaults it to `RESPONSE`. Render-time identifiers go through `assertQtiIdentifier`, which trims.
- `packages/writer/src/shell.ts:5-41`: the shared shell accepts one response processing string, emits only the `SCORE` outcome, and closes immediately after response processing. There is no modal feedback slot. `xmlLines` in `packages/writer/src/xml.ts:25-27` drops `undefined` and `false` entries and keeps empty strings, so a new slot must be omitted with `undefined`, not `""`.
- `packages/writer/src/response-processing.ts:17-59`: template XML sets nothing but the template URI. `mapResponseProcessingXml` and `matchCorrectProcessingXml` are the inline score patterns. Both take the response identifier as an argument. The match helper sets `SCORE` to `1` on a match and does not emit an else; core still scores a non-match as `0` because a single float outcome defaults to `0` (`packages/core/src/session.ts:145-149` and `462-472`). Feedback-enabled match processing must still emit the else that sets `0`, so the XML states the intended rule explicitly. Core's template evaluator (`session.ts:450-472`) hardcodes `RESPONSE`, so a non-default response identifier may score differently on the new inline path; the new path must honor the configured identifier.
- `packages/core/src/parser.ts:160,199`: core parses item-level modal feedback. `packages/core/src/session.ts:83-95` selects visible feedback by outcome value. `qtiValueToString(null)` is `""` (`packages/core/src/value-format.ts:57-58`), which cannot equal a QTI identifier, so a null feedback outcome shows nothing. `packages/core/src/validation.ts:608-636` checks that feedback identifiers are unique per outcome and that the referenced outcome exists. `packages/core/src/validation.ts:127-147` rejects explicit declarations of `completionStatus`, `numAttempts`, `duration`, and `QTI_CONTEXT`.
- `packages/core/src/parser-item-metadata.ts:73-81`: the parsed `QtiModalFeedback` retains visible **text**, identifier, outcome identifier, and show/hide, but not its original XHTML. An authoring app must retain or supply rich feedback content separately. Do not claim a parsed model alone can exactly reproduce rich markup. `packages/player/src/player/feedback-panel.ts:14-19` renders that flattened text; this plan does not change the player.
- `packages/writer/src/choice.test.ts:11-65` tests writer output through `expectValidParsedItem`, which parses and validates the produced XML. `packages/core/src/processing-response.test.ts:265-309` demonstrates feedback outcome scoring and `visibleModalFeedback`. `packages/core/src/processing-operators.test.ts:180-209` shows `<qti-null/>` evaluates to null. Non-adaptive `score()` resets outcomes to those defaults before rules (`session.ts:244-248`), and `booleanValue(null)` is false (`packages/core/src/processing-values.ts:171-176`), so a null response does not enter a `qti-match` branch.
- `packages/writer/README.md:3-7,40-45` documents the trusted-fragment boundary and stable result API. Keep validation failures in `Qti3WriterDiagnostic` for `writeQti3AssessmentItemResult`.
- Issue #29's sample processing is not the target. Its else branch copies `RESPONSE` into `FEEDBACK`, which forces every wrong-answer feedback identifier to equal the choice identifier. Implement the explicit entry mapping below instead.

## Commands

| Purpose                   | Command                                                                                          | Expected result                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Focused tests             | `pnpm exec vitest run packages/writer/src/choice.test.ts packages/writer/src/validation.test.ts` | exit 0, no skipped tests                                                      |
| Full gate                 | `pnpm verify`                                                                                    | exit 0; includes format, typecheck, lint, tests, dependency checks, and build |
| Existing browser feedback | `pnpm exec playwright test tests/browser/player-feedback.spec.ts`                                | exit 0                                                                        |

## Scope

**In scope:** `packages/writer/src/types.ts`, `packages/writer/src/index.ts`, `packages/writer/src/choice.ts`, `packages/writer/src/shell.ts`, `packages/writer/src/response-processing.ts`, `packages/writer/src/choice.test.ts`, `packages/writer/src/validation.test.ts`, `packages/writer/README.md`, and this plan's row in `plans/README.md`.

**Out of scope:** core parser/model changes, player rendering, other interaction builders, generic opaque item-level XML hooks, dependencies, fixtures, and release files. Rich content already held by an editor can be passed as a trusted fragment; extracting rich content from an existing QTI file is a separate parser capability.

## Git workflow

Work on a `codex-` branch if a branch is needed. Do not revert or incorporate unrelated working-tree changes. Use a focused commit after verification; do not push or open a PR without the operator's instruction.

## Steps

### 1. Add a typed feedback option to choice authoring

In `types.ts`, add:

```ts
export interface Qti3ChoiceFeedbackEntry {
  readonly choiceIdentifier: string;
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
}

export interface Qti3ChoiceFeedback {
  /** Defaults to "FEEDBACK" when omitted. */
  readonly outcomeIdentifier?: string | undefined;
  readonly entries: readonly Qti3ChoiceFeedbackEntry[];
}
```

Add optional `readonly feedback?: Qti3ChoiceFeedback | undefined` to `Qti3ChoiceAuthoringItem`. That puts it on both `Qti3ChoiceBuilderInput` and `Qti3AuthoringItem`. Re-export both new interfaces from `packages/writer/src/index.ts` beside `Qti3ChoiceAuthoringItem`. Each entry maps one selected choice to one modal feedback identifier, so correct choice `B` can select feedback `RIGHT` while wrong choice `A` selects feedback `A`. Keep both content fields optional at the type level; step 2 rejects every combination except exactly one nonblank source. Do not attach feedback to `Qti3AuthoringChoice`, because the identifier selected by response processing need not equal the choice identifier.

**Verify:** `rg -n 'Qti3ChoiceFeedback|feedback\?:' packages/writer/src/types.ts packages/writer/src/index.ts` finds the interfaces, the choice property, and both index re-exports. Typecheck after the matching implementation in steps 2-3.

### 2. Validate feedback input before XML generation

Extend `validateQti3ChoiceItem` in `choice.ts`. Run these checks only when `feedback` is present. Trim identifiers the same way `assertQtiIdentifier` and `duplicateDiagnostics` do; do not case-fold. Resolve `outcomeIdentifier` to `FEEDBACK` when omitted, then validate the resolved value.

Reject with these codes:

| Case                                                                                                                                      | Code                       | Path                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `responseCardinality` is not `"single"`                                                                                                   | `feedback_requires_single` | `responseCardinality`                                                                  |
| `entries` is empty                                                                                                                        | `missing_feedback_entries` | `feedback.entries`                                                                     |
| outcome identifier fails `validateQtiIdentifier`                                                                                          | `invalid_identifier`       | `feedback.outcomeIdentifier`                                                           |
| resolved outcome identifier is `SCORE`, the resolved response identifier, `completionStatus`, `numAttempts`, `duration`, or `QTI_CONTEXT` | `invalid_feedback_outcome` | `feedback.outcomeIdentifier`                                                           |
| duplicate trimmed `choiceIdentifier`                                                                                                      | `duplicate_identifier`     | `feedback.entries.choiceIdentifier`                                                    |
| duplicate trimmed feedback `identifier`                                                                                                   | `duplicate_identifier`     | `feedback.entries.identifier`                                                          |
| entry `choiceIdentifier` or feedback `identifier` fails `validateQtiIdentifier`                                                           | `invalid_identifier`       | `feedback.entries.${index}.choiceIdentifier` or `feedback.entries.${index}.identifier` |
| trimmed `choiceIdentifier` is not one of the trimmed choice identifiers                                                                   | `unknown_choice_reference` | `feedback.entries.${index}.choiceIdentifier`                                           |
| not exactly one of trimmed `text` or trimmed `contentHtml`, or rich content has no visible text                                           | `invalid_feedback_content` | `feedback.entries.${index}`                                                            |

Use `duplicateDiagnostics` for the two uniqueness checks. An entry with both sources, neither source, or only whitespace fails `invalid_feedback_content`. Rich content whose parsed modal-feedback text is empty (such as `<p></p>`) also fails; use core's XML parsing and visible-text semantics rather than a regex tag stripper. An accessible image with a nonblank `alt` label remains valid. Sparse feedback stays valid: a choice with no entry shows nothing. Absent `feedback` must not add diagnostics and must not change later XML. Add the negative cases listed in step 4 to `validation.test.ts` at this step.

**Verify:** `pnpm exec vitest run packages/writer/src/validation.test.ts` exits 0 with the new diagnostics cases.

### 3. Emit the linked QTI structures

Extend `AssessmentItemShellInput` with optional `outcomeDeclarationsXml` and optional `modalFeedbackXml`. Render the outcome slot immediately after the `SCORE` declaration and before `companionMaterialsXml`. Render modal feedback immediately after `responseProcessingXml`. Pass `undefined` when a slot is unused. Do not pass `""`, because `xmlLines` would keep a blank line and change existing output.

For feedback-enabled choice items, emit one `single`/`identifier` outcome declaration using the resolved outcome identifier, then one `qti-modal-feedback` per entry in entry order. Every feedback element uses that same outcome identifier and `show-hide="show"`. Escape every attribute. Escape plain `text` with `escapeXmlText` and insert it as a text node; do not wrap it in `<p>` or `<qti-content-body>`. Insert `contentHtml` raw, as choice bodies already insert `choice.contentHtml`.

Replace the template with one inline processing block from a new helper in `response-processing.ts`. Use the resolved response identifier everywhere a response variable appears. Do not hardcode `RESPONSE`, and do not copy issue #29's else branch that assigns `FEEDBACK` from `<qti-variable identifier="RESPONSE"/>`.

`match_correct` sets `SCORE` with this shape, using the resolved response identifier:

```xml
<qti-response-condition>
  <qti-response-if>
    <qti-match>
      <qti-variable identifier="ANSWER"/>
      <qti-correct identifier="ANSWER"/>
    </qti-match>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">1</qti-base-value>
    </qti-set-outcome-value>
  </qti-response-if>
  <qti-response-else>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">0</qti-base-value>
    </qti-set-outcome-value>
  </qti-response-else>
</qti-response-condition>
```

`map_response` keeps the existing `choiceMappingXml` block and sets `SCORE` with `qti-map-response` for that same response identifier. Do not also emit the match `1`/`0` condition. In this codebase `qti-map-response` of a null response is `0`.

After the score rules, set the feedback outcome to `<qti-null/>`, then add one `qti-response-condition` per entry. The condition matches the response variable to that entry's `choiceIdentifier` and sets the feedback outcome to that entry's feedback identifier. Unanswered and unlisted choices stay null because a null match does not enter the branch. Preserve `responseProcessingTemplateXml` when `feedback` is absent. Add the issue's A/B regression test to `choice.test.ts` at this step.

**Verify:** `pnpm exec vitest run packages/writer/src/choice.test.ts` exits 0; the new test must parse and validate all emitted XML.

### 4. Test scoring, visibility, and diagnostics through public seams

In `choice.test.ts`, build the issue's A/B example using `RIGHT` and `A` feedback identifiers, score B and A with `createItemSession`, and assert `SCORE`, the feedback outcome, and `visibleModalFeedback` for each. Check unanswered and a choice without an entry show no feedback. Repeat with `scoring: "map_response"` and assert the mapped scores stay `1` for B and `0` for A; this writer has no per-choice weights beyond that mapping. Assert the `map_response` XML contains `<qti-map-response` and no `<qti-correct`; assert the `match_correct` XML contains `<qti-correct` and no `<qti-map-response`. Test a custom `responseIdentifier` with **both** scoring modes and assert that identifier's response still selects the mapped feedback and score. Include trusted rich XHTML and a plain-text entry containing `<`, and assert the parsed feedback text has the escaped character decoded. Assert the feedback declaration, feedback count/identifiers in entry order, `show-hide="show"`, and absence of `rptemplates/match_correct` and `rptemplates/map_response` when feedback is enabled. Assert the old template remains when feedback is absent.

The `validation.test.ts` negative cases from step 2 must call `writeQti3AssessmentItemResult` and cover unknown choice, duplicate choice mapping, duplicate feedback identifier, invalid outcome identifier, collisions with `SCORE` and the configured response identifier, each reserved built-in name in the step 2 table, blank content, both content sources, empty rich markup such as `<p></p>`, and multiple cardinality. Include a positive accessible-image `alt` case. Assert the codes and paths from the step 2 table, not only thrown message text. For the two `duplicate_identifier` cases, assert the path distinguishes choice mappings from feedback identifiers. Follow existing tests' `expectValidParsedItem` helper and real core session calls; do not use DOM shims.

**Verify:** `pnpm exec vitest run packages/writer/src/choice.test.ts packages/writer/src/validation.test.ts` exits 0 with all added tests passing.

### 5. Document the authoring contract and run the repository gate

Add a compact writer README example using the stable result API. Explain that feedback is currently for single-choice items, `contentHtml` must be trusted, and callers rebuilding from parsed QTI must preserve rich XHTML separately because `QtiModalFeedback` exposes plain text. The current player also displays flattened feedback text, even when rich XHTML is present in the output XML. Explain that unsupported feedback configurations return diagnostics instead of being silently dropped. Do not advertise generic lossless round-tripping.

**Verify:** `pnpm verify` and `pnpm exec playwright test tests/browser/player-feedback.spec.ts` both exit 0. No new browser test is needed because this plan changes XML generation, not DOM behavior.

## Done criteria

- [ ] The issue's A/B example can be represented through `Qti3ChoiceBuilderInput` without XML splicing; the rebuilt XML has two modal feedback elements, the feedback outcome, and inline processing.
- [ ] Scoring B yields `SCORE = 1` and feedback `RIGHT`; scoring A yields `SCORE = 0` and feedback `A`; unanswered input shows none.
- [ ] The same feedback mapping works with `map_response`: B scores `1`, A scores `0`, the mapping block is still present, and tests assert the emitted processing operator for each scoring mode.
- [ ] A non-`RESPONSE` response identifier still drives both `SCORE` and the feedback outcome in both scoring modes.
- [ ] Bad references, response/outcome and reserved built-in collisions, duplicate mappings, blank content, rich markup with no visible text, both content sources, and multiple cardinality produce the codes and paths in step 2.
- [ ] `Qti3ChoiceFeedback` and `Qti3ChoiceFeedbackEntry` are re-exported from `packages/writer/src/index.ts`.
- [ ] Choices without feedback still emit the existing XML shape and processing template.
- [ ] `pnpm verify` passes; only in-scope files and the plan status changed.

## STOP conditions

- The in-scope code has drifted enough to invalidate the described shell, choice-builder, or named type-export seams.
- Core cannot parse or evaluate the inline processing in step 3, or a tested `match_correct` / `map_response` score with the default `RESPONSE` identifier differs from its template behavior. With a custom response identifier, the new inline processing should honor that identifier even though the existing template evaluator does not.
- Implementing this requires core parser changes or a generic XML preservation API. Report that discovery for a separate design decision.
- A verification gate fails twice after a reasonable fix attempt.

## Maintenance notes

Review the semantic coupling among choice IDs, feedback IDs, the feedback outcome, and response processing. A later general feedback feature for other interactions should reuse the validated mapping concept only where response shape and scoring semantics match. The shell slots are shared by every item builder; an empty string in either slot changes every item's XML. This plan does not promise exact reconstruction of arbitrary original XML, issue #29's else-branch processing, or rich feedback from `QtiModalFeedback.text`. The in-repo player will keep showing flattened feedback text until a separate player change renders modal-feedback markup.
