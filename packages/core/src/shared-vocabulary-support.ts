import {
  SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES,
  SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES,
  SHARED_VOCABULARY_INPUT_WIDTHS,
} from "./shared-vocabulary.js";
import type { QtiInteractionType, SharedVocabularyClassSupport } from "./types.js";

const sharedVocabularyFixture = [
  "packages/fixtures/packages/basic-item-player/valid-item-only/items/shared-vocabulary.xml",
];
const fixtureTests = ["packages/fixtures/src/fixtures.test.ts", "packages/cli/src/index.test.ts"];
const sharedVocabularyMatrixTests = ["tests/browser/player-shared-vocabulary.spec.ts"];
const contentTests = [
  ...fixtureTests,
  "packages/core/src/core.test.ts",
  "tests/browser/player-dom-behavior.spec.ts",
  ...sharedVocabularyMatrixTests,
];
const sharedVocabularyUnitTests = [
  "packages/core/src/shared-vocabulary.test.ts",
  "packages/player/src/interactions/shared-vocabulary.test.ts",
];
const sharedVocabularyValidationTests = [
  "packages/core/src/core.test.ts",
  "packages/core/src/shared-vocabulary-validation.test.ts",
];
const browserBehaviorTests = [
  "tests/browser/player-dom-behavior.spec.ts",
  ...sharedVocabularyMatrixTests,
];
const graphicBrowserTests = ["tests/browser/player-graphic.spec.ts"];
const mediaBrowserTests = ["tests/browser/player.spec.ts", ...sharedVocabularyMatrixTests];
const mediaPlayerFixture =
  "packages/fixtures/packages/sv-matrix/items/media-controls-and-pause.xml";

const contentListStyleTypes = [
  "none",
  "arabic-indic",
  "armenian",
  "bengali",
  "cambodian",
  "circle",
  "cjk-earthly-branch",
  "cjk-heavenly-stem",
  "cjk-ideographic",
  "decimal",
  "decimal-leading-zero",
  "devanagari",
  "disc",
  "ethiopic-halehame",
  "ethiopic-halehame-am",
  "ethiopic-halehame-ti-er",
  "ethiopic-halehame-ti-et",
  "georgian",
  "gujarati",
  "gurmukhi",
  "hangul",
  "hangul-consonant",
  "hebrew",
  "hiragana",
  "hiragana-iroha",
  "kannada",
  "katakana",
  "katakana-iroha",
  "khmer",
  "korean-hangul-formal",
  "korean-hanja-formal",
  "korean-hanja-informal",
  "lao",
  "lower-alpha",
  "lower-armenian",
  "lower-greek",
  "lower-latin",
  "lower-roman",
  "malayalam",
  "mongolian",
  "myanmar",
  "oriya",
  "persian",
  "simp-chinese-formal",
  "simp-chinese-informal",
  "square",
  "telugu",
  "thai",
  "tibetan",
  "trad-chinese-formal",
  "trad-chinese-informal",
  "upper-alpha",
  "upper-armenian",
  "upper-latin",
  "upper-roman",
  "urdu",
] as const;

const contentTextIndentSuffixes = [
  "0",
  "px",
  "0p5",
  "1",
  "1p5",
  "2",
  "2p5",
  "3",
  "3p5",
  "4",
  "5",
  "6",
  "7",
  "8",
  "12",
  "16",
  "20",
  "24",
  "28",
  "32",
] as const;

const choiceAndOrder: QtiInteractionType[] = ["choice", "order"];
const choicesLayoutInteractions: QtiInteractionType[] = [
  "match",
  "gapMatch",
  "graphicGapMatch",
  "order",
];
const selectionPresentationInteractions: QtiInteractionType[] = [
  "choice",
  "hottext",
  "hotspot",
  "graphicGapMatch",
];

function svEntry(
  className: string,
  scope: SharedVocabularyClassSupport["scope"],
  level: SharedVocabularyClassSupport["level"],
  options: Omit<SharedVocabularyClassSupport, "className" | "scope" | "level"> = {},
): SharedVocabularyClassSupport {
  return {
    className,
    scope,
    level,
    ...options,
  };
}

function contentStylesheetEntry(className: string, notes?: string): SharedVocabularyClassSupport {
  return svEntry(className, "content", "stylesheet", {
    fixtures: sharedVocabularyFixture,
    tests: contentTests,
    notes,
  });
}

function interactionFullEntry(
  className: string,
  interactions: QtiInteractionType[],
  tests: string[],
  notes?: string,
): SharedVocabularyClassSupport {
  return svEntry(className, "interaction", "full", {
    interactions,
    fixtures: sharedVocabularyFixture,
    tests,
    notes,
  });
}

function interactionStylesheetEntry(
  className: string,
  interactions: QtiInteractionType[],
  tests: string[],
  notes?: string,
): SharedVocabularyClassSupport {
  return svEntry(className, "interaction", "stylesheet", {
    interactions,
    fixtures: sharedVocabularyFixture,
    tests,
    notes,
  });
}

function mediaPlayerSvEntry(
  className: string,
  notes: string,
  tests: string[] = mediaBrowserTests,
): SharedVocabularyClassSupport {
  return svEntry(className, "interaction", "full", {
    interactions: ["media"],
    fixtures: [mediaPlayerFixture],
    tests,
    notes,
  });
}

export const sharedVocabularyClassSupport: SharedVocabularyClassSupport[] = [
  contentStylesheetEntry(
    "qti-layout-row",
    "Twelve-column content layout row; validated for supported child column spans and offsets.",
  ),
  ...Array.from({ length: 12 }, (_, index) => index + 1).flatMap((span) => [
    contentStylesheetEntry(`qti-layout-col${span}`),
    contentStylesheetEntry(`qti-layout-col-${span}`),
  ]),
  ...Array.from({ length: 11 }, (_, index) => index + 1).flatMap((offset) => [
    contentStylesheetEntry(`qti-layout-offset${offset}`),
    contentStylesheetEntry(`qti-layout-offset-${offset}`),
  ]),
  ...["left", "center", "right"].map((alignment) =>
    contentStylesheetEntry(`qti-align-${alignment}`),
  ),
  ...["top", "middle", "baseline", "bottom"].map((alignment) =>
    contentStylesheetEntry(`qti-valign-${alignment}`),
  ),
  contentStylesheetEntry("qti-fullwidth"),
  contentStylesheetEntry("qti-width-full"),
  contentStylesheetEntry("qti-hidden", "Hides content from visual and assistive output."),
  contentStylesheetEntry(
    "qti-visually-hidden",
    "Keeps content available to assistive technology while removing it from visual flow.",
  ),
  svEntry("qti-keyword-emphasis", "content", "conditional", {
    fixtures: ["packages/fixtures/packages/sv-matrix/items/content-keyword-emphasis.xml"],
    tests: sharedVocabularyMatrixTests,
    notes:
      "Rendered with additional emphasis only when candidate PNP keyword-emphasis support is enabled by the host.",
  }),
  ...contentTextIndentSuffixes.map((suffix) => contentStylesheetEntry(`qti-text-indent-${suffix}`)),
  ...["vertical-rl", "vertical-lr", "vertical-tb", "horizontal-tb"].map((mode) =>
    contentStylesheetEntry(`qti-writing-mode-${mode}`),
  ),
  contentStylesheetEntry("qti-text-orientation-upright"),
  contentStylesheetEntry("qti-text-combine-upright-all"),
  ...["left", "right", "none", "clearfix", "clear-left", "clear-right", "clear-both"].map(
    (floatClass) => contentStylesheetEntry(`qti-float-${floatClass}`),
  ),
  contentStylesheetEntry("qti-bordered"),
  contentStylesheetEntry("qti-well"),
  ...contentListStyleTypes.map((styleType) =>
    contentStylesheetEntry(`qti-list-style-type-${styleType}`),
  ),
  contentStylesheetEntry("qti-underline"),
  contentStylesheetEntry("qti-italic"),
  contentStylesheetEntry("qti-display-inline-block"),

  ...["none", "decimal", "cjk-ideographic", "lower-alpha", "upper-alpha"].map((labelStyle) =>
    interactionFullEntry(`qti-labels-${labelStyle}`, choiceAndOrder, [
      ...sharedVocabularyUnitTests,
      ...browserBehaviorTests,
    ]),
  ),
  ...["none", "period", "parenthesis"].map((suffix) =>
    interactionFullEntry(`qti-labels-suffix-${suffix}`, choiceAndOrder, [
      ...sharedVocabularyUnitTests,
      ...browserBehaviorTests,
    ]),
  ),
  ...["horizontal", "vertical"].map((orientation) =>
    interactionFullEntry(
      `qti-orientation-${orientation}`,
      ["choice", "order"],
      [
        "packages/player/src/interactions/choice-layout.test.ts",
        ...sharedVocabularyUnitTests,
        ...browserBehaviorTests,
      ],
    ),
  ),
  ...Array.from({ length: 5 }, (_, index) => index + 1).map((stacking) =>
    interactionFullEntry(
      `qti-choices-stacking-${stacking}`,
      ["choice"],
      [
        "packages/player/src/interactions/choice-layout.test.ts",
        "packages/core/src/core.test.ts",
        ...browserBehaviorTests,
      ],
    ),
  ),
  interactionStylesheetEntry(
    "qti-input-control-hidden",
    ["choice", "hottext"],
    [...browserBehaviorTests, "tests/browser/player-keyboard-a11y.spec.ts"],
  ),
  ...["vertical-rl", "vertical-lr"].map((orientation) =>
    interactionStylesheetEntry(
      `qti-writing-orientation-${orientation}`,
      ["choice"],
      [...browserBehaviorTests],
    ),
  ),
  ...["light", "dark"].map((tone) =>
    interactionStylesheetEntry(`qti-selections-${tone}`, selectionPresentationInteractions, [
      ...browserBehaviorTests,
      ...graphicBrowserTests,
    ]),
  ),
  interactionStylesheetEntry("qti-unselected-hidden", selectionPresentationInteractions, [
    ...browserBehaviorTests,
    ...graphicBrowserTests,
  ]),
  ...["top", "bottom", "left", "right"].map((position) =>
    interactionFullEntry(`qti-choices-${position}`, choicesLayoutInteractions, [
      ...sharedVocabularyUnitTests,
      ...browserBehaviorTests,
      ...graphicBrowserTests,
    ]),
  ),
  interactionFullEntry(
    "qti-match-tabular",
    ["match"],
    [
      "packages/core/src/core.test.ts",
      ...browserBehaviorTests,
      "tests/browser/player-keyboard-a11y.spec.ts",
    ],
  ),
  svEntry("qti-header-hidden", "interaction", "conditional", {
    interactions: ["match"],
    fixtures: sharedVocabularyFixture,
    tests: ["packages/core/src/core.test.ts", ...browserBehaviorTests],
    notes: "Applied when qti-match-tabular selects the tabular match renderer.",
  }),
  interactionFullEntry(
    "qti-gap-placement",
    ["gapMatch"],
    [...sharedVocabularyUnitTests, "packages/core/src/core.test.ts", ...browserBehaviorTests],
  ),
  ...SHARED_VOCABULARY_INPUT_WIDTHS.map((width) =>
    interactionFullEntry(
      `qti-input-width-${width}`,
      ["textEntry", "inlineChoice"],
      [
        "packages/core/src/shared-vocabulary.test.ts",
        "packages/core/src/core.test.ts",
        ...browserBehaviorTests,
      ],
    ),
  ),
  ...SHARED_VOCABULARY_INPUT_WIDTHS.map((width) =>
    svEntry(`qti-input-width-${width}`, "gap", "full", {
      interactions: ["gapMatch"],
      fixtures: sharedVocabularyFixture,
      tests: [
        "packages/core/src/shared-vocabulary.test.ts",
        "packages/core/src/core.test.ts",
        ...browserBehaviorTests,
      ],
      notes: "Supported on qti-gap targets when gap placement is authored.",
    }),
  ),
  ...SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES.map((lines) =>
    interactionFullEntry(
      `qti-height-lines-${lines}`,
      ["extendedText"],
      [
        ...sharedVocabularyValidationTests,
        "packages/core/src/shared-vocabulary.test.ts",
        ...browserBehaviorTests,
      ],
    ),
  ),
  ...SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES.map((className) =>
    interactionFullEntry(
      className,
      ["extendedText"],
      [
        ...sharedVocabularyValidationTests,
        "packages/core/src/shared-vocabulary.test.ts",
        ...browserBehaviorTests,
      ],
    ),
  ),
  mediaPlayerSvEntry(
    "data-qti-media-player-controls",
    "Supports tokens none, default, play, rewind, captions, and audioDescription on media interactions and rendered media assets.",
    [...mediaBrowserTests, "packages/core/src/shared-vocabulary-validation.test.ts"],
  ),
  mediaPlayerSvEntry(
    "data-qti-media-player-pause-delay",
    "Reflects authored pause-delay values on rendered media assets. Pause timer behavior is covered in tests/browser/player.spec.ts.",
  ),
  mediaPlayerSvEntry(
    "data-qti-media-player-pause-duration",
    "Reflects authored pause-duration values on rendered media assets. Pause timer behavior is covered in tests/browser/player.spec.ts.",
  ),
];
