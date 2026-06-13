import {
  SHARED_VOCABULARY_CONTENT_ALIGNMENTS,
  SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES,
  SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES,
  SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES,
  SHARED_VOCABULARY_CONTENT_VALIGNS,
  SHARED_VOCABULARY_CONTENT_WRITING_MODES,
  SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT,
  SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT,
} from "./shared-vocabulary-generated-families.js";
import {
  sharedVocabularyFixedClassName,
  sharedVocabularyInteractionFields,
  type QtiSharedVocabularyField,
} from "./shared-vocabulary-authoring.js";
import {
  SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES,
  SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES,
  SHARED_VOCABULARY_INPUT_WIDTHS,
} from "./shared-vocabulary.js";
import { SHARED_VOCABULARY_CHOICE_AND_ORDER_INTERACTIONS } from "./shared-vocabulary-interaction-sets.js";
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
  "packages/core/src/shared-vocabulary-registry-validation.test.ts",
  "packages/core/src/shared-vocabulary-interaction-validation.test.ts",
];
const choiceLayoutTests = ["packages/player/src/interactions/choice-layout.test.ts"];
const browserBehaviorTests = [
  "tests/browser/player-dom-behavior.spec.ts",
  ...sharedVocabularyMatrixTests,
];
const graphicBrowserTests = [
  "tests/browser/player-graphic.spec.ts",
  "tests/browser/player-graphic-gap-match.spec.ts",
];
const mediaBrowserTests = ["tests/browser/player.spec.ts", ...sharedVocabularyMatrixTests];
const mediaPlayerFixture =
  "packages/fixtures/packages/sv-matrix/items/media-controls-and-pause.xml";
const interactionInputWidthFixtures = [
  "packages/fixtures/packages/sv-matrix/items/interaction-input-width-standalone.xml",
  "packages/fixtures/packages/sv-matrix/items/interaction-input-width-embedded.xml",
];
const orderMinMaxMessagesFixture =
  "packages/fixtures/packages/sv-matrix/items/order-min-max-messages.xml";

const choiceAndOrder = SHARED_VOCABULARY_CHOICE_AND_ORDER_INTERACTIONS;

function registryClassValueSupportProfile(fieldId: string): {
  level: "full" | "stylesheet";
  tests: string[];
} {
  switch (fieldId) {
    case "labels-style":
    case "labels-suffix":
      return { level: "full", tests: [...sharedVocabularyUnitTests, ...browserBehaviorTests] };
    case "orientation":
      return {
        level: "full",
        tests: [...choiceLayoutTests, ...sharedVocabularyUnitTests, ...browserBehaviorTests],
      };
    case "choices-stacking":
      return {
        level: "full",
        tests: [...choiceLayoutTests, "packages/core/src/core.test.ts", ...browserBehaviorTests],
      };
    case "choices-position":
      return {
        level: "full",
        tests: [...sharedVocabularyUnitTests, ...browserBehaviorTests, ...graphicBrowserTests],
      };
    case "selections-tone":
      return { level: "stylesheet", tests: [...browserBehaviorTests, ...graphicBrowserTests] };
    case "writing-orientation":
      return { level: "stylesheet", tests: [...browserBehaviorTests] };
    default:
      return { level: "full", tests: [...sharedVocabularyUnitTests, ...browserBehaviorTests] };
  }
}

function registryClassValueSupportEntries(): SharedVocabularyClassSupport[] {
  return sharedVocabularyInteractionFields.flatMap((field) => {
    if (field.kind !== "class-value") return [];
    const profile = registryClassValueSupportProfile(field.id);
    const createEntry =
      profile.level === "stylesheet" ? interactionStylesheetEntry : interactionFullEntry;
    return field.values.map((value) =>
      createEntry(`${field.classPrefix}${String(value)}`, field.interactions, profile.tests),
    );
  });
}

function registryClassFixedSupportProfile(fieldId: string): {
  level: "full" | "stylesheet";
  tests: string[];
} {
  switch (fieldId) {
    case "input-control-hidden":
      return {
        level: "stylesheet",
        tests: [...browserBehaviorTests, "tests/browser/player-keyboard-a11y.spec.ts"],
      };
    case "unselected-hidden":
      return { level: "stylesheet", tests: [...browserBehaviorTests, ...graphicBrowserTests] };
    case "match-tabular":
      return {
        level: "full",
        tests: [
          "packages/core/src/core.test.ts",
          ...browserBehaviorTests,
          "tests/browser/player-keyboard-a11y.spec.ts",
        ],
      };
    case "gap-placement":
      return {
        level: "full",
        tests: [
          ...sharedVocabularyUnitTests,
          "packages/core/src/core.test.ts",
          ...browserBehaviorTests,
        ],
      };
    default:
      return { level: "full", tests: [...browserBehaviorTests] };
  }
}

const registryClassFixedSupportIds = [
  "input-control-hidden",
  "unselected-hidden",
  "match-tabular",
  "gap-placement",
] as const;

function registryClassFixedSupportEntries(): SharedVocabularyClassSupport[] {
  return registryClassFixedSupportIds.flatMap((fieldId) => {
    const field = sharedVocabularyInteractionFields.find(
      (candidate): candidate is Extract<QtiSharedVocabularyField, { kind: "class-fixed" }> =>
        candidate.kind === "class-fixed" && candidate.id === fieldId,
    );
    if (field === undefined) return [];
    const profile = registryClassFixedSupportProfile(field.id);
    const createEntry =
      profile.level === "stylesheet" ? interactionStylesheetEntry : interactionFullEntry;
    return [createEntry(field.className, field.interactions, profile.tests)];
  });
}

function registryAttributeSupportProfile(fieldId: string): {
  fixtures: string[];
  tests: string[];
  notes?: string;
} {
  switch (fieldId) {
    case "choices-container-width":
      return {
        fixtures: sharedVocabularyFixture,
        tests: [
          "packages/core/src/core.test.ts",
          "packages/player/src/interactions/shared-vocabulary.test.ts",
          ...browserBehaviorTests,
          ...graphicBrowserTests,
        ],
        notes:
          "Sets the authored choices-bank width for interactions that support qti-choices-* layout classes.",
      };
    case "first-column-header":
      return {
        fixtures: sharedVocabularyFixture,
        tests: [
          "packages/core/src/core.test.ts",
          ...browserBehaviorTests,
          "tests/browser/player-keyboard-a11y.spec.ts",
        ],
        notes: "Provides the top-left header text for qti-match-tabular table rendering.",
      };
    case "media-player-controls":
      return {
        fixtures: [mediaPlayerFixture],
        tests: [...mediaBrowserTests, "packages/core/src/shared-vocabulary-validation.test.ts"],
        notes:
          "Supports tokens none, default, play, rewind, captions, and audioDescription on media interactions and rendered media assets.",
      };
    case "media-player-pause-delay":
      return {
        fixtures: [mediaPlayerFixture],
        tests: mediaBrowserTests,
        notes:
          "Reflects authored pause-delay values on rendered media assets. Pause timer behavior is covered in tests/browser/player.spec.ts.",
      };
    case "media-player-pause-duration":
      return {
        fixtures: [mediaPlayerFixture],
        tests: mediaBrowserTests,
        notes:
          "Reflects authored pause-duration values on rendered media assets. Pause timer behavior is covered in tests/browser/player.spec.ts.",
      };
    default:
      return {
        fixtures: sharedVocabularyFixture,
        tests: [...sharedVocabularyUnitTests, ...browserBehaviorTests],
      };
  }
}

function registryAttributeSupportEntries(): SharedVocabularyClassSupport[] {
  return sharedVocabularyInteractionFields.flatMap((field) => {
    if (field.kind !== "attribute") return [];
    const profile = registryAttributeSupportProfile(field.id);
    return [
      svEntry(field.attributeName, "interaction", "full", {
        interactions: [...field.interactions],
        fixtures: profile.fixtures,
        tests: profile.tests,
        ...(profile.notes === undefined ? {} : { notes: profile.notes }),
      }),
    ];
  });
}

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
  interactions: readonly QtiInteractionType[],
  tests: string[],
  notes?: string,
): SharedVocabularyClassSupport {
  return svEntry(className, "interaction", "full", {
    interactions: [...interactions],
    fixtures: sharedVocabularyFixture,
    tests,
    notes,
  });
}

function interactionStylesheetEntry(
  className: string,
  interactions: readonly QtiInteractionType[],
  tests: string[],
  notes?: string,
): SharedVocabularyClassSupport {
  return svEntry(className, "interaction", "stylesheet", {
    interactions: [...interactions],
    fixtures: sharedVocabularyFixture,
    tests,
    notes,
  });
}

export const sharedVocabularyClassSupport: SharedVocabularyClassSupport[] = [
  contentStylesheetEntry(
    "qti-layout-row",
    "Twelve-column content layout row; validated for supported child column spans and offsets.",
  ),
  ...Array.from(
    { length: SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT },
    (_, index) => index + 1,
  ).flatMap((span) => [
    contentStylesheetEntry(`qti-layout-col${span}`),
    contentStylesheetEntry(`qti-layout-col-${span}`),
  ]),
  ...Array.from({ length: SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT }, (_, index) => index + 1).flatMap(
    (offset) => [
      contentStylesheetEntry(`qti-layout-offset${offset}`),
      contentStylesheetEntry(`qti-layout-offset-${offset}`),
    ],
  ),
  ...SHARED_VOCABULARY_CONTENT_ALIGNMENTS.map((alignment) =>
    contentStylesheetEntry(`qti-align-${alignment}`),
  ),
  ...SHARED_VOCABULARY_CONTENT_VALIGNS.map((alignment) =>
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
  ...SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES.map((suffix) =>
    contentStylesheetEntry(`qti-text-indent-${suffix}`),
  ),
  ...SHARED_VOCABULARY_CONTENT_WRITING_MODES.map((mode) =>
    contentStylesheetEntry(`qti-writing-mode-${mode}`),
  ),
  contentStylesheetEntry("qti-text-orientation-upright"),
  contentStylesheetEntry("qti-text-combine-upright-all"),
  ...SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES.map((floatClass) =>
    contentStylesheetEntry(`qti-float-${floatClass}`),
  ),
  contentStylesheetEntry("qti-bordered"),
  contentStylesheetEntry("qti-well"),
  ...SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES.map((styleType) =>
    contentStylesheetEntry(`qti-list-style-type-${styleType}`),
  ),
  contentStylesheetEntry("qti-underline"),
  contentStylesheetEntry("qti-italic"),
  contentStylesheetEntry("qti-display-inline-block"),

  ...registryClassValueSupportEntries(),
  ...registryClassFixedSupportEntries(),
  ...registryAttributeSupportEntries(),
  svEntry("data-min-selections-message", "interaction", "full", {
    interactions: ["order"],
    fixtures: [orderMinMaxMessagesFixture],
    tests: sharedVocabularyMatrixTests,
    notes: "Overrides minimum response validation text for order interactions.",
  }),
  svEntry("data-max-selections-message", "interaction", "full", {
    interactions: [...choiceAndOrder],
    fixtures: [orderMinMaxMessagesFixture],
    tests: ["tests/browser/player-validation.spec.ts", ...sharedVocabularyMatrixTests],
    notes: "Overrides maximum response validation text for choice and order interactions.",
  }),
  svEntry(
    sharedVocabularyFixedClassName("header-hidden") ?? "qti-header-hidden",
    "interaction",
    "conditional",
    {
      interactions: ["match"],
      fixtures: sharedVocabularyFixture,
      tests: ["packages/core/src/core.test.ts", ...browserBehaviorTests],
      notes: "Applied when qti-match-tabular selects the tabular match renderer.",
    },
  ),
  ...SHARED_VOCABULARY_INPUT_WIDTHS.map((width) =>
    svEntry(`qti-input-width-${width}`, "interaction", "full", {
      interactions: ["textEntry", "inlineChoice"],
      fixtures: interactionInputWidthFixtures,
      tests: [
        "packages/core/src/shared-vocabulary.test.ts",
        "packages/core/src/core.test.ts",
        ...sharedVocabularyMatrixTests,
      ],
    }),
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
];
