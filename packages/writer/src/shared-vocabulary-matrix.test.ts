import type { QtiInteractionType, QtiSharedVocabularyState } from "@longsightgroup/qti3-core";
import { isEnforcedSharedVocabularyLevel } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  type Qti3AuthoringChoice,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";
import {
  sharedVocabularyManifest,
  type SharedVocabularyManifestEntry,
} from "../../../tests/browser/shared-vocabulary-matrix/manifest.js";

const writerMatrixEntries = sharedVocabularyManifest
  .filter((entry) => isEnforcedSharedVocabularyLevel(entry.supportLevel))
  .filter(isWriterMatrixEntry);

describe("qti3-writer shared vocabulary matrix", () => {
  it("covers the enforced player shared-vocabulary manifest entries that the writer can author", () => {
    expect(writerMatrixEntries.map((entry) => entry.id).toSorted()).toMatchInlineSnapshot(`
      [
        "choice-input-control-hidden",
        "choice-labels-cjk-ideographic",
        "choice-labels-decimal",
        "choice-labels-lower-alpha",
        "choice-labels-lower-alpha-suffix-none",
        "choice-labels-lower-alpha-suffix-parenthesis",
        "choice-labels-lower-alpha-suffix-period",
        "choice-labels-none",
        "choice-labels-upper-alpha",
        "choice-selections-dark",
        "choice-selections-dark-forced-colors",
        "choice-selections-light-forced-colors",
        "choice-stacking-1-horizontal",
        "choice-stacking-2",
        "choice-stacking-4",
        "choice-stacking-5",
        "choice-stacking-vertical",
        "choice-unselected-hidden",
        "choice-writing-orientation-vertical-rl",
        "content-keyword-emphasis",
        "content-layout-row-col6",
        "content-stylesheet-box",
        "content-stylesheet-generated-reps",
        "content-stylesheet-typography",
        "content-suppress-tts",
        "content-visually-hidden",
        "extended-text-pattern-mask",
        "extended-text-xhtml",
        "extendedtext-height-counter-variants",
        "gap-choices-bottom",
        "gap-choices-left",
        "gap-choices-right",
        "gap-choices-top",
        "gap-input-width-variants",
        "gap-placement-input-width",
        "graphic-gap-choices-bottom",
        "graphic-gap-selections-dark",
        "graphic-gap-selections-light",
        "hottext-input-control-hidden",
        "hottext-input-control-unselected-hidden",
        "hottext-unselected-hidden",
        "inline-choice-writing-orientation-vertical-rl",
        "interaction-input-width-embedded",
        "interaction-input-width-standalone",
        "japanese-vertical-haiku",
        "match-choices-bottom",
        "match-choices-left",
        "match-choices-right",
        "match-choices-top",
        "match-tabular-first-column-header",
        "match-tabular-header-hidden",
        "media-controls-and-pause",
        "order-choices-left-width",
        "order-labels-cjk-ideographic",
        "order-labels-decimal",
        "order-labels-lower-alpha",
        "order-labels-lower-alpha-suffix-none",
        "order-labels-lower-alpha-suffix-parenthesis",
        "order-labels-lower-alpha-suffix-period",
        "order-labels-none",
        "order-labels-upper-alpha",
        "order-min-max-messages",
        "order-orientation-vertical",
        "text-entry-pattern-mask-inline",
      ]
    `);
  });

  for (const entry of writerMatrixEntries) {
    it(`writes ${entry.id}`, () => {
      for (const scenario of authoringScenariosForEntry(entry)) {
        const xml = writeQti3AssessmentItem(scenario.item);
        const parsed = expectValidParsedItem(xml);

        expect(xml).not.toContain("undefined");
        for (const token of scenario.tokens) assertTokenAuthored(xml, token);
        if (entry.interactionType !== "content") {
          expect(
            parsed.interactions.some((interaction) => interaction.type === entry.interactionType),
          ).toBe(true);
        }
      }
    });
  }
});

interface WriterMatrixScenario {
  readonly item: Qti3AuthoringItem;
  readonly tokens: readonly string[];
}

function isWriterMatrixEntry(entry: SharedVocabularyManifestEntry): boolean {
  return (
    entry.interactionType === "content" ||
    entry.interactionType === "choice" ||
    entry.interactionType === "extendedText" ||
    entry.interactionType === "gapMatch" ||
    entry.interactionType === "graphicGapMatch" ||
    entry.interactionType === "hottext" ||
    entry.interactionType === "inlineChoice" ||
    entry.interactionType === "match" ||
    entry.interactionType === "media" ||
    entry.interactionType === "order" ||
    entry.interactionType === "textEntry"
  );
}

function authoringScenariosForEntry(entry: SharedVocabularyManifestEntry): WriterMatrixScenario[] {
  const tokens = entryTokens(entry);
  if (entry.id === "extendedtext-height-counter-variants") {
    return tokens.map((token) => ({
      item: authoringItemForEntry(entry, [token]),
      tokens: [token],
    }));
  }
  return [{ item: authoringItemForEntry(entry, tokens), tokens }];
}

function authoringItemForEntry(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  if (entry.interactionType === "content") return contentItem(entry, tokens);
  if (entry.interactionType === "choice") return choiceItem(entry, tokens);
  if (entry.interactionType === "extendedText") return extendedTextItem(entry, tokens);
  if (entry.interactionType === "gapMatch") return gapMatchItem(entry, tokens);
  if (entry.interactionType === "graphicGapMatch") return graphicGapMatchItem(entry, tokens);
  if (entry.interactionType === "hottext") return hottextItem(entry, tokens);
  if (entry.interactionType === "inlineChoice") return inlineChoiceItem(entry, tokens);
  if (entry.interactionType === "match") return matchItem(entry, tokens);
  if (entry.interactionType === "media") return mediaItem(entry, tokens);
  if (entry.interactionType === "order") return orderItem(entry, tokens);
  return textEntryItem(entry, tokens);
}

function contentItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "choice",
    identifier: itemIdentifier(entry),
    title: entry.id,
    bodyHtml: qti3TrustedXmlFragment(`<div ${contentVocabularyAttributes(tokens)}>Content</div>`),
    responseCardinality: "single",
    maxChoices: 1,
    choices: simpleChoices(),
    correctResponse: ["A"],
  };
}

function choiceItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "choice",
    identifier: itemIdentifier(entry),
    title: entry.id,
    responseCardinality: "single",
    maxChoices: 1,
    choices: simpleChoices(),
    correctResponse: ["A"],
    sharedVocabulary: sharedVocabularyState("choice", tokens),
  };
}

function orderItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "order",
    identifier: itemIdentifier(entry),
    title: entry.id,
    choices: simpleChoices(),
    correctOrder: ["A", "B", "C"],
    minChoices: tokenSet(tokens).has("data-min-selections-message") ? 2 : undefined,
    maxChoices: tokenSet(tokens).has("data-max-selections-message") ? 2 : undefined,
    minChoicesMessage: tokenSet(tokens).has("data-min-selections-message")
      ? "Place at least two steps"
      : undefined,
    maxChoicesMessage: tokenSet(tokens).has("data-max-selections-message")
      ? "Place no more than two steps"
      : undefined,
    sharedVocabulary: sharedVocabularyState("order", tokens),
  };
}

function matchItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "match",
    identifier: itemIdentifier(entry),
    title: entry.id,
    sources: [{ identifier: "A", text: "Capulet", matchMax: 1 }],
    targets: [{ identifier: "T1", text: "Romeo and Juliet", matchMax: 1 }],
    correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
    sharedVocabulary: sharedVocabularyState("match", tokens),
  };
}

function gapMatchItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  const widths = inputWidthTokens(tokens);
  const targetIdentifiers = widths.length ? widths.map((width) => `G${width}`) : ["G1"];
  const bodyHtml = targetIdentifiers
    .map((identifier) => {
      const width = identifier.slice(1);
      const classAttr = widths.includes(width) ? ` class="qti-input-width-${width}"` : "";
      return `<qti-gap identifier="${identifier}"${classAttr}/>`;
    })
    .join(" ");

  return {
    interactionType: "gapMatch",
    identifier: itemIdentifier(entry),
    title: entry.id,
    bodyHtml: qti3TrustedXmlFragment(`<p>${bodyHtml}</p>`),
    choices: targetIdentifiers.map((identifier, index) => ({
      identifier: `C${index + 1}`,
      kind: "text",
      text: `Choice ${index + 1}`,
      matchMax: 1,
    })),
    targets: targetIdentifiers.map((identifier) => ({ identifier })),
    correctResponse: targetIdentifiers.map((identifier, index) => ({
      sourceIdentifier: `C${index + 1}`,
      targetIdentifier: identifier,
    })),
    sharedVocabulary: sharedVocabularyState("gapMatch", tokens),
  };
}

function graphicGapMatchItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "graphicGapMatch",
    identifier: itemIdentifier(entry),
    title: entry.id,
    object: { data: "target.png", alt: "Graphic gap target", width: 100, height: 100 },
    choices: [{ identifier: "A", kind: "text", text: "Choice", matchMax: 1 }],
    targets: [{ targetType: "hotspot", identifier: "T1", shape: "rect", coords: "0,0,50,50" }],
    correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
    sharedVocabulary: sharedVocabularyState("graphicGapMatch", tokens),
  };
}

function hottextItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "hottext",
    identifier: itemIdentifier(entry),
    title: entry.id,
    bodyHtml: qti3TrustedXmlFragment(
      '<p><qti-hottext identifier="H1"/> <qti-hottext identifier="H2"/></p>',
    ),
    choices: [
      { identifier: "H1", text: "First" },
      { identifier: "H2", text: "Second" },
    ],
    correctResponse: ["H1"],
    maxChoices: 1,
    sharedVocabulary: sharedVocabularyState("hottext", tokens),
  };
}

function inlineChoiceItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "inlineChoice",
    identifier: itemIdentifier(entry),
    title: entry.id,
    bodyHtml: qti3TrustedXmlFragment(
      '<p>Inline <qti-inline-choice-interaction response-identifier="RESPONSE"/>.</p>',
    ),
    slots: [
      {
        responseIdentifier: "RESPONSE",
        options: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: "A",
        classNames: inputWidthTokens(tokens).map((width) => `qti-input-width-${width}`),
        sharedVocabulary: sharedVocabularyState("inlineChoice", tokens),
      },
    ],
  };
}

function textEntryItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  const widthClasses = inputWidthTokens(tokens).map((width) => `qti-input-width-${width}`);
  const responseIdentifiers = widthClasses.length
    ? widthClasses.map((_, index) => `RESPONSE_${index + 1}`)
    : ["RESPONSE"];
  const interactions = responseIdentifiers
    .map((responseIdentifier, index) => {
      const className = widthClasses[index];
      const classAttr = className ? ` class="${className}"` : "";
      const patternAttributes = tokenSet(tokens).has("pattern-mask")
        ? ' pattern-mask="[0-9]+" data-patternmask-message="Maximum of 3 digits permitted"'
        : "";
      return `<qti-text-entry-interaction response-identifier="${responseIdentifier}"${classAttr}${patternAttributes}/>`;
    })
    .join(" ");
  return {
    interactionType: "textEntry",
    identifier: itemIdentifier(entry),
    title: entry.id,
    bodyHtml: qti3TrustedXmlFragment(`<p>${interactions}</p>`),
    responses: responseIdentifiers.map((responseIdentifier) => ({
      responseIdentifier,
      answers: [{ value: "123", score: 1 }],
    })),
  };
}

function extendedTextItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  const classNames = tokens.filter(
    (token) => token.startsWith("qti-height-lines-") || token.startsWith("qti-counter-"),
  );
  return {
    interactionType: "extendedText",
    identifier: itemIdentifier(entry),
    title: entry.id,
    classNames,
    expectedLength: classNames.some((className) => className.startsWith("qti-counter-"))
      ? 120
      : undefined,
    format: entry.id === "extended-text-xhtml" ? "xhtml" : "plain",
    patternMask: tokenSet(tokens).has("pattern-mask") ? "[0-9.]+" : undefined,
    patternMessage: tokenSet(tokens).has("data-patternmask-message")
      ? "Maximum of 6 digits or decimal points permitted"
      : undefined,
  };
}

function mediaItem(
  entry: SharedVocabularyManifestEntry,
  tokens: readonly string[],
): Qti3AuthoringItem {
  return {
    interactionType: "media",
    identifier: itemIdentifier(entry),
    title: entry.id,
    kind: "video",
    sources: [{ src: "movie.mp4", type: "video/mp4" }],
    width: 320,
    height: 180,
    sharedVocabulary: sharedVocabularyState("media", tokens),
  };
}

function entryTokens(entry: SharedVocabularyManifestEntry): string[] {
  return Array.isArray(entry.className) ? entry.className : [entry.className];
}

function sharedVocabularyState(
  interaction: QtiInteractionType,
  tokens: readonly string[],
): QtiSharedVocabularyState {
  const state: QtiSharedVocabularyState = {};
  for (const token of tokens) {
    const update = sharedVocabularyStateUpdate(interaction, token);
    if (update === undefined) continue;
    state[update.id] = update.value;
  }
  return state;
}

function sharedVocabularyStateUpdate(
  interaction: QtiInteractionType,
  token: string,
): { readonly id: string; readonly value: QtiSharedVocabularyState[string] } | undefined {
  if (token.startsWith("qti-labels-suffix-")) {
    return { id: "labels-suffix", value: token.slice("qti-labels-suffix-".length) };
  }
  if (token.startsWith("qti-labels-")) {
    return { id: "labels-style", value: token.slice("qti-labels-".length) };
  }
  if (token.startsWith("qti-orientation-")) {
    return { id: "orientation", value: token.slice("qti-orientation-".length) };
  }
  if (token.startsWith("qti-choices-stacking-")) {
    return { id: "choices-stacking", value: Number(token.slice("qti-choices-stacking-".length)) };
  }
  if (token.startsWith("qti-choices-")) {
    return { id: "choices-position", value: token.slice("qti-choices-".length) };
  }
  if (token.startsWith("qti-selections-")) {
    return { id: "selections-tone", value: token.slice("qti-selections-".length) };
  }
  if (token.startsWith("qti-writing-orientation-")) {
    return { id: "writing-orientation", value: token.slice("qti-writing-orientation-".length) };
  }
  if (token === "qti-input-control-hidden") return { id: "input-control-hidden", value: true };
  if (token === "qti-unselected-hidden") return { id: "unselected-hidden", value: true };
  if (token === "qti-match-tabular") return { id: "match-tabular", value: true };
  if (token === "qti-header-hidden") return { id: "header-hidden", value: true };
  if (token === "qti-gap-placement") return { id: "gap-placement", value: true };
  if (token === "data-choices-container-width") {
    return { id: "choices-container-width", value: 120 };
  }
  if (token === "data-first-column-header")
    return { id: "first-column-header", value: "Characters" };
  if (interaction === "media" && token === "data-qti-media-player-controls") {
    return { id: "media-player-controls", value: ["play", "captions"] };
  }
  if (interaction === "media" && token === "data-qti-media-player-pause-delay") {
    return { id: "media-player-pause-delay", value: 0.02 };
  }
  if (interaction === "media" && token === "data-qti-media-player-pause-duration") {
    return { id: "media-player-pause-duration", value: 0.03 };
  }
  return undefined;
}

function contentVocabularyAttributes(tokens: readonly string[]): string {
  const classes = tokens.filter((token) => token.startsWith("qti-")).join(" ");
  const attributes = [
    classes ? `class="${classes}"` : "",
    tokenSet(tokens).has("data-qti-suppress-tts")
      ? 'data-qti-suppress-tts="computer-read-aloud"'
      : "",
  ].filter(Boolean);
  return attributes.join(" ");
}

function assertTokenAuthored(xml: string, token: string): void {
  if (token.startsWith("qti-")) {
    expect(xml, `generated XML should author ${token}`).toContain(token);
    return;
  }
  if (token === "pattern-mask") {
    expect(xml).toContain('pattern-mask="');
    return;
  }
  expect(xml, `generated XML should author ${token}`).toContain(`${token}=`);
}

function inputWidthTokens(tokens: readonly string[]): string[] {
  return tokens.flatMap((token) => {
    if (!token.startsWith("qti-input-width-")) return [];
    return [token.slice("qti-input-width-".length)];
  });
}

function tokenSet(tokens: readonly string[]): ReadonlySet<string> {
  return new Set(tokens);
}

function simpleChoices(): Qti3AuthoringChoice[] {
  return [
    { identifier: "A", text: "A" },
    { identifier: "B", text: "B" },
    { identifier: "C", text: "C" },
  ];
}

function itemIdentifier(entry: SharedVocabularyManifestEntry): string {
  return `writer-${entry.id}`.replaceAll(/[^A-Za-z0-9_-]/g, "-");
}
