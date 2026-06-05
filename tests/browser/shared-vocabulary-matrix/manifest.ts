import type {
  SharedVocabularyAssertion,
  SharedVocabularyInteractionType,
  SharedVocabularyManifestEntry,
} from "./types.js";

export type {
  SharedVocabularyAssertion,
  SharedVocabularyInteractionType,
  SharedVocabularyManifestEntry,
  SharedVocabularySupportLevel,
} from "./types.js";

export const SV_MATRIX_FIXTURE_ROOT = "packages/fixtures/packages/sv-matrix/items";

const itemPath = (id: string): string => `${SV_MATRIX_FIXTURE_ROOT}/${id}.xml`;
const player = "qti-assessment-item-player";
const choice = `${player} .qti3-choice`;
const choiceA = `${choice} .qti3-choice-option[data-choice-identifier="A"]`;
const choiceB = `${choice} .qti3-choice-option[data-choice-identifier="B"]`;
const choiceLabels = `${choice} .qti3-choice-label`;
const orderLayout = `${player} .qti3-order-sv-layout`;
const orderBank = `${orderLayout} .qti3-order-choices-bank`;
const orderTargets = `${orderLayout} .qti3-order-target-list`;
const orderRoot = `${player} .qti3-order`;
const orderLabels = `${orderTargets} .qti3-order-target-label`;
const extendedText = `${player} .qti3-extendedText`;
const matchLayout = `${player} .qti3-match-selector`;
const matchRoot = `${player} .qti3-match`;
const matchBank = `${matchLayout} .qti3-match-source-bank`;
const matchTargets = `${matchLayout} .qti3-match-target-bank`;
const gapLayout = `${player} .qti3-gap-match-layout`;
const gapRoot = `${player} .qti3-gapMatch`;
const gapBank = `${gapLayout} .qti3-gap-source-region`;
const gapTargets = `${gapLayout} .qti3-gap-region`;
const graphicGapRoot = `${player} .qti3-graphicGapMatch`;
const graphicGapLayout = `${player} .qti3-graphic-gap-layout`;
const graphicGapBank = `${graphicGapLayout} .qti3-graphic-gap-source-region`;
const graphicGapSurface = `${graphicGapLayout} .qti3-graphic-gap-match-surface`;
const graphicGapHotspotT1 = `${graphicGapRoot} .qti3-graphic-gap-hotspot[data-gap-identifier="T1"]`;
const graphicGapHotspotT2 = `${graphicGapRoot} .qti3-graphic-gap-hotspot[data-gap-identifier="T2"]`;
const graphicGapSourceA = `${graphicGapBank} button[data-choice-identifier="A"]`;
const hottextRoot = `${player} .qti3-hottext`;
const hottextA = `${hottextRoot} .qti3-hottext-token[data-choice-identifier="A"]`;
const hottextB = `${hottextRoot} .qti3-hottext-token[data-choice-identifier="B"]`;
const inputWidths = [1, 2, 3, 4, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 72] as const;

interface EntryOptions {
  forcedColors?: true;
}

function entry(
  id: string,
  interactionType: SharedVocabularyInteractionType,
  className: string | string[],
  supportLevel: SharedVocabularyManifestEntry["supportLevel"],
  assertions: SharedVocabularyAssertion[],
  options: EntryOptions = {},
): SharedVocabularyManifestEntry {
  const { forcedColors } = options;
  const forcedColorsAssertions: SharedVocabularyAssertion[] = forcedColors
    ? [{ type: "forced-colors-active" }]
    : [];
  return {
    id,
    className,
    interactionType,
    supportLevel,
    fixturePath: itemPath(id),
    ...(forcedColors ? { forcedColors } : {}),
    assertions: [...forcedColorsAssertions, ...assertions],
  };
}

function graphicGapSelectionAssertions(className: string): SharedVocabularyAssertion[] {
  return [
    { type: "class-preserved", selector: graphicGapRoot, className },
    {
      type: "computed-style-not",
      selector: graphicGapHotspotT2,
      property: "background-color",
      value: "rgba(0, 0, 0, 0)",
    },
    { type: "click", selector: graphicGapSourceA },
    { type: "click", selector: graphicGapHotspotT1 },
    {
      type: "computed-style-differs",
      firstSelector: graphicGapHotspotT1,
      secondSelector: graphicGapHotspotT2,
      property: "background-color",
    },
    {
      type: "computed-style-differs",
      firstSelector: graphicGapHotspotT1,
      secondSelector: graphicGapHotspotT2,
      property: "border-top-style",
    },
  ];
}

function selectionAssertions(className: string): SharedVocabularyAssertion[] {
  return [
    { type: "class-preserved", selector: choice, className },
    { type: "click", selector: `${choiceA} input` },
    {
      type: "computed-style-differs",
      firstSelector: choiceA,
      secondSelector: choiceB,
      property: "background-color",
    },
    {
      type: "computed-style-differs",
      firstSelector: choiceA,
      secondSelector: choiceB,
      property: "color",
    },
  ];
}

function choiceStackingAssertions(
  className: string | string[],
  stacking: number,
  orientation = "vertical",
): SharedVocabularyAssertion[] {
  return [
    ...classNames(className).map(
      (name): SharedVocabularyAssertion => ({
        type: "class-preserved",
        selector: choice,
        className: name,
      }),
    ),
    {
      type: "attribute",
      selector: `${choice} .qti3-choice-list`,
      name: "data-qti-orientation",
      value: orientation,
    },
    {
      type: "attribute",
      selector: `${choice} .qti3-choice-list`,
      name: "data-qti-stacking",
      value: String(stacking),
    },
  ];
}

interface LabelCase {
  id: string;
  className: string | string[];
  expected: string[];
}

const labelStyleCases: LabelCase[] = [
  { id: "labels-none", className: "qti-labels-none", expected: [] },
  { id: "labels-decimal", className: "qti-labels-decimal", expected: ["1.", "2.", "3."] },
  {
    id: "labels-cjk-ideographic",
    className: "qti-labels-cjk-ideographic",
    expected: ["一.", "二.", "三."],
  },
  {
    id: "labels-lower-alpha",
    className: "qti-labels-lower-alpha",
    expected: ["a.", "b.", "c."],
  },
  {
    id: "labels-upper-alpha",
    className: "qti-labels-upper-alpha",
    expected: ["A.", "B.", "C."],
  },
];

const labelSuffixCases: LabelCase[] = [
  {
    id: "labels-lower-alpha-suffix-none",
    className: ["qti-labels-lower-alpha", "qti-labels-suffix-none"],
    expected: ["a", "b", "c"],
  },
  {
    id: "labels-lower-alpha-suffix-period",
    className: ["qti-labels-lower-alpha", "qti-labels-suffix-period"],
    expected: ["a.", "b.", "c."],
  },
  {
    id: "labels-lower-alpha-suffix-parenthesis",
    className: ["qti-labels-lower-alpha", "qti-labels-suffix-parenthesis"],
    expected: ["a)", "b)", "c)"],
  },
];

function labelAssertions(
  rootSelector: string,
  labelSelector: string,
  labelSelectors: string[],
  className: string | string[],
  expected: string[],
): SharedVocabularyAssertion[] {
  return [
    ...classNames(className).map(
      (name): SharedVocabularyAssertion => ({
        type: "class-preserved",
        selector: rootSelector,
        className: name,
      }),
    ),
    { type: "element-count", selector: labelSelector, count: expected.length },
    ...expected.map(
      (value, index): SharedVocabularyAssertion => ({
        type: "text",
        selector: labelSelectors[index] ?? labelSelector,
        value,
      }),
    ),
  ];
}

function classNames(className: string | string[]): string[] {
  return Array.isArray(className) ? className : [className];
}

interface ChoicesPositionOptions {
  interactionRoot: string;
  layoutSelector: string;
  bankSelector: string;
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
  className: string;
}

function choicesPositionAssertions(options: ChoicesPositionOptions): SharedVocabularyAssertion[] {
  const { interactionRoot, layoutSelector, bankSelector, targetSelector, position, className } =
    options;
  const bankBeforeTargets = position === "top" || position === "left";
  const axis = position === "left" || position === "right" ? "x" : "y";
  const bankPrecedes = position === "top" || position === "left";
  return [
    { type: "class-preserved", selector: interactionRoot, className },
    {
      type: "attribute",
      selector: layoutSelector,
      name: "data-qti-choices-position",
      value: position,
    },
    {
      type: "dom-order",
      firstSelector: bankBeforeTargets ? bankSelector : targetSelector,
      secondSelector: bankBeforeTargets ? targetSelector : bankSelector,
      order: "before",
    },
    {
      type: "position",
      firstSelector: bankSelector,
      secondSelector: targetSelector,
      axis,
      relation: bankPrecedes ? "less-than" : "greater-than",
    },
  ];
}

export const sharedVocabularyManifest: SharedVocabularyManifestEntry[] = [
  entry("choice-selections-dark", "choice", "qti-selections-dark", "stylesheet", [
    { type: "class-preserved", selector: choice, className: "qti-selections-dark" },
    {
      type: "computed-style-not",
      selector: choiceB,
      property: "background-color",
      value: "rgba(0, 0, 0, 0)",
    },
    { type: "click", selector: `${choiceA} input` },
    {
      type: "computed-style-differs",
      firstSelector: choiceA,
      secondSelector: choiceB,
      property: "background-color",
    },
    {
      type: "computed-style-differs",
      firstSelector: choiceA,
      secondSelector: choiceB,
      property: "color",
    },
    {
      type: "computed-style-differs",
      firstSelector: choiceA,
      secondSelector: choiceB,
      property: "opacity",
    },
  ]),
  entry(
    "choice-selections-light-forced-colors",
    "choice",
    "qti-selections-light",
    "stylesheet",
    selectionAssertions("qti-selections-light"),
    { forcedColors: true },
  ),
  entry(
    "choice-selections-dark-forced-colors",
    "choice",
    "qti-selections-dark",
    "stylesheet",
    selectionAssertions("qti-selections-dark"),
    { forcedColors: true },
  ),
  entry("choice-unselected-hidden", "choice", "qti-unselected-hidden", "stylesheet", [
    { type: "class-preserved", selector: choice, className: "qti-unselected-hidden" },
    {
      type: "computed-style-number",
      selector: choiceA,
      property: "opacity",
      comparison: "less-than",
      value: 1,
    },
    { type: "focus", selector: `${choiceA} input` },
    { type: "key", key: "Tab" },
    {
      type: "computed-style-number",
      selector: choiceB,
      property: "opacity",
      comparison: "greater-than-or-equal",
      value: 1,
    },
    { type: "key", key: "Space" },
    { type: "attribute", selector: choiceB, name: "data-selected", value: "true" },
    {
      type: "computed-style-number",
      selector: choiceB,
      property: "opacity",
      comparison: "greater-than-or-equal",
      value: 1,
    },
  ]),
  entry("hottext-unselected-hidden", "hottext", "qti-unselected-hidden", "stylesheet", [
    { type: "class-preserved", selector: hottextRoot, className: "qti-unselected-hidden" },
    {
      type: "computed-style",
      selector: hottextA,
      property: "border-top-color",
      value: "rgba(0, 0, 0, 0)",
    },
    {
      type: "computed-style",
      selector: hottextA,
      property: "text-decoration-color",
      value: "rgba(0, 0, 0, 0)",
    },
    { type: "focus", selector: hottextA },
    {
      type: "computed-style-not",
      selector: hottextA,
      property: "border-top-color",
      value: "rgba(0, 0, 0, 0)",
    },
    { type: "key", key: "Tab" },
    {
      type: "computed-style-not",
      selector: hottextB,
      property: "border-top-color",
      value: "rgba(0, 0, 0, 0)",
    },
    { type: "key", key: "Space" },
    { type: "attribute", selector: hottextB, name: "data-selected", value: "true" },
  ]),
  entry(
    "choice-stacking-vertical",
    "choice",
    ["qti-choices-stacking-3", "qti-orientation-vertical"],
    "full",
    [
      { type: "class-preserved", selector: choice, className: "qti-choices-stacking-3" },
      { type: "class-preserved", selector: choice, className: "qti-orientation-vertical" },
      {
        type: "attribute",
        selector: `${choice} .qti3-choice-list`,
        name: "data-qti-orientation",
        value: "vertical",
      },
      {
        type: "attribute",
        selector: `${choice} .qti3-choice-list`,
        name: "data-qti-stacking",
        value: "3",
      },
      {
        type: "computed-style",
        selector: `${choice} .qti3-choice-list`,
        property: "grid-auto-flow",
        value: "column",
      },
    ],
  ),
  entry(
    "choice-stacking-1-horizontal",
    "choice",
    ["qti-choices-stacking-1", "qti-orientation-horizontal"],
    "full",
    choiceStackingAssertions(
      ["qti-choices-stacking-1", "qti-orientation-horizontal"],
      1,
      "horizontal",
    ),
  ),
  entry(
    "choice-stacking-2",
    "choice",
    "qti-choices-stacking-2",
    "full",
    choiceStackingAssertions("qti-choices-stacking-2", 2),
  ),
  entry(
    "choice-stacking-4",
    "choice",
    "qti-choices-stacking-4",
    "full",
    choiceStackingAssertions("qti-choices-stacking-4", 4),
  ),
  entry(
    "choice-stacking-5",
    "choice",
    "qti-choices-stacking-5",
    "full",
    choiceStackingAssertions("qti-choices-stacking-5", 5),
  ),
  entry("choice-input-control-hidden", "choice", "qti-input-control-hidden", "stylesheet", [
    { type: "class-preserved", selector: choice, className: "qti-input-control-hidden" },
    { type: "hidden-focusable-input", selector: `${choiceA} input` },
  ]),
  ...[...labelStyleCases, ...labelSuffixCases].map((item) =>
    entry(
      `choice-${item.id}`,
      "choice",
      item.className,
      "full",
      labelAssertions(
        choice,
        choiceLabels,
        [1, 2, 3].map(
          (index) => `${choice} .qti3-choice-option:nth-child(${index}) .qti3-choice-label`,
        ),
        item.className,
        item.expected,
      ),
    ),
  ),
  entry("order-choices-left-width", "order", "qti-choices-left", "full", [
    { type: "class-preserved", selector: `${player} .qti3-order`, className: "qti-choices-left" },
    { type: "attribute", selector: orderLayout, name: "data-qti-choices-position", value: "left" },
    { type: "dom-order", firstSelector: orderBank, secondSelector: orderTargets, order: "before" },
    { type: "layout-width", selector: orderBank, expected: 180, tolerance: 4 },
    {
      type: "position",
      firstSelector: orderBank,
      secondSelector: orderTargets,
      axis: "x",
      relation: "less-than",
    },
  ]),
  entry("order-orientation-vertical", "order", "qti-orientation-vertical", "full", [
    {
      type: "class-preserved",
      selector: `${player} .qti3-order`,
      className: "qti-orientation-vertical",
    },
    {
      type: "attribute",
      selector: orderLayout,
      name: "data-qti-order-orientation",
      value: "vertical",
    },
    { type: "computed-style", selector: orderBank, property: "flex-direction", value: "column" },
  ]),
  ...[...labelStyleCases, ...labelSuffixCases].map((item) => {
    const orderClasses = [...classNames(item.className), "qti-choices-top"];
    return entry(
      `order-${item.id}`,
      "order",
      orderClasses,
      "full",
      labelAssertions(
        orderRoot,
        orderLabels,
        [1, 2, 3].map(
          (index) =>
            `${orderTargets} .qti3-order-target-slot:nth-child(${index}) .qti3-order-target-label`,
        ),
        orderClasses,
        item.expected,
      ),
    );
  }),
  entry(
    "gap-input-width-variants",
    "gapMatch",
    inputWidths.map((width) => `qti-input-width-${width}`),
    "full",
    inputWidths.map(
      (width): SharedVocabularyAssertion => ({
        type: "attribute",
        selector: `${player} [data-gap-identifier="G${width}"]`,
        name: "data-qti-gap-input-width",
        value: String(width),
      }),
    ),
  ),
  entry(
    "extendedtext-height-counter-variants",
    "extendedText",
    [
      "qti-height-lines-3",
      "qti-height-lines-6",
      "qti-height-lines-15",
      "qti-counter-up",
      "qti-counter-down",
    ],
    "full",
    [
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="LINES3"]`,
        className: "qti-height-lines-3",
      },
      {
        type: "attribute",
        selector: `${extendedText}[data-response-identifier="LINES3"] textarea`,
        name: "rows",
        value: "3",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="LINES6"]`,
        className: "qti-height-lines-6",
      },
      {
        type: "attribute",
        selector: `${extendedText}[data-response-identifier="LINES6"] textarea`,
        name: "rows",
        value: "6",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="LINES15"]`,
        className: "qti-height-lines-15",
      },
      {
        type: "attribute",
        selector: `${extendedText}[data-response-identifier="LINES15"] textarea`,
        name: "rows",
        value: "15",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="COUNTER_UP"]`,
        className: "qti-counter-up",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="COUNTER_UP"] .qti3-text-response > :first-child`,
        className: "qti3-counter",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="COUNTER_DOWN"]`,
        className: "qti-counter-down",
      },
      {
        type: "class-preserved",
        selector: `${extendedText}[data-response-identifier="COUNTER_DOWN"] .qti3-text-response > :last-child`,
        className: "qti3-counter",
      },
    ],
  ),
  entry(
    "media-controls-and-pause",
    "media",
    [
      "data-qti-media-player-controls",
      "data-qti-media-player-pause-delay",
      "data-qti-media-player-pause-duration",
    ],
    "full",
    [
      {
        type: "attribute",
        selector: `${player} audio[data-qti-media-player-controls="none"]`,
        name: "data-qti-media-player-controls",
        value: "none",
      },
      {
        type: "attribute-absent",
        selector: `${player} audio[data-qti-media-player-controls="none"]`,
        name: "controls",
      },
      {
        type: "attribute",
        selector: `${player} audio[data-qti-media-player-controls="default"]`,
        name: "data-qti-media-player-controls",
        value: "default",
      },
      {
        type: "attribute",
        selector: `${player} audio[data-qti-media-player-controls="default"]`,
        name: "controls",
        value: "",
      },
      {
        type: "attribute",
        selector: `${player} audio[data-qti-media-player-pause-delay="0.02"]`,
        name: "data-qti-media-player-pause-delay",
        value: "0.02",
      },
      {
        type: "attribute",
        selector: `${player} audio[data-qti-media-player-pause-duration="0.03"]`,
        name: "data-qti-media-player-pause-duration",
        value: "0.03",
      },
    ],
  ),
  entry(
    "match-choices-top",
    "match",
    "qti-choices-top",
    "full",
    choicesPositionAssertions({
      interactionRoot: matchRoot,
      layoutSelector: matchLayout,
      bankSelector: matchBank,
      targetSelector: matchTargets,
      position: "top",
      className: "qti-choices-top",
    }),
  ),
  entry(
    "match-choices-bottom",
    "match",
    "qti-choices-bottom",
    "full",
    choicesPositionAssertions({
      interactionRoot: matchRoot,
      layoutSelector: matchLayout,
      bankSelector: matchBank,
      targetSelector: matchTargets,
      position: "bottom",
      className: "qti-choices-bottom",
    }),
  ),
  entry(
    "match-choices-left",
    "match",
    "qti-choices-left",
    "full",
    choicesPositionAssertions({
      interactionRoot: matchRoot,
      layoutSelector: matchLayout,
      bankSelector: matchBank,
      targetSelector: matchTargets,
      position: "left",
      className: "qti-choices-left",
    }),
  ),
  entry(
    "match-choices-right",
    "match",
    "qti-choices-right",
    "full",
    choicesPositionAssertions({
      interactionRoot: matchRoot,
      layoutSelector: matchLayout,
      bankSelector: matchBank,
      targetSelector: matchTargets,
      position: "right",
      className: "qti-choices-right",
    }),
  ),
  entry("match-tabular-first-column-header", "match", "qti-match-tabular", "full", [
    { type: "class-preserved", selector: matchRoot, className: "qti-match-tabular" },
    {
      type: "text",
      selector: `${player} .qti3-match-table thead th:first-child`,
      value: "Characters",
    },
    {
      type: "text",
      selector: `${player} .qti3-match-table tbody tr:first-child th`,
      value: "Capulet.",
    },
  ]),
  entry(
    "gap-choices-top",
    "gapMatch",
    "qti-choices-top",
    "full",
    choicesPositionAssertions({
      interactionRoot: gapRoot,
      layoutSelector: gapLayout,
      bankSelector: gapBank,
      targetSelector: gapTargets,
      position: "top",
      className: "qti-choices-top",
    }),
  ),
  entry(
    "gap-choices-bottom",
    "gapMatch",
    "qti-choices-bottom",
    "full",
    choicesPositionAssertions({
      interactionRoot: gapRoot,
      layoutSelector: gapLayout,
      bankSelector: gapBank,
      targetSelector: gapTargets,
      position: "bottom",
      className: "qti-choices-bottom",
    }),
  ),
  entry(
    "gap-choices-left",
    "gapMatch",
    "qti-choices-left",
    "full",
    choicesPositionAssertions({
      interactionRoot: gapRoot,
      layoutSelector: gapLayout,
      bankSelector: gapBank,
      targetSelector: gapTargets,
      position: "left",
      className: "qti-choices-left",
    }),
  ),
  entry(
    "gap-choices-right",
    "gapMatch",
    "qti-choices-right",
    "full",
    choicesPositionAssertions({
      interactionRoot: gapRoot,
      layoutSelector: gapLayout,
      bankSelector: gapBank,
      targetSelector: gapTargets,
      position: "right",
      className: "qti-choices-right",
    }),
  ),
  // Graphic gap matrix entries cover interaction-specific deltas; gap/match already
  // exercise all four qti-choices-* positions with the shared layout helper.
  entry(
    "graphic-gap-selections-dark",
    "graphicGapMatch",
    "qti-selections-dark",
    "stylesheet",
    graphicGapSelectionAssertions("qti-selections-dark"),
  ),
  entry(
    "graphic-gap-choices-bottom",
    "graphicGapMatch",
    "qti-choices-bottom",
    "full",
    choicesPositionAssertions({
      interactionRoot: graphicGapRoot,
      layoutSelector: graphicGapLayout,
      bankSelector: graphicGapBank,
      targetSelector: graphicGapSurface,
      position: "bottom",
      className: "qti-choices-bottom",
    }),
  ),
  entry(
    "gap-placement-input-width",
    "gapMatch",
    ["qti-gap-placement", "qti-choices-left", "qti-input-width-10"],
    "full",
    [
      { type: "class-preserved", selector: gapRoot, className: "qti-gap-placement" },
      { type: "class-preserved", selector: gapRoot, className: "qti-choices-left" },
      { type: "class-preserved", selector: gapLayout, className: "qti3-gap-placement" },
      {
        type: "class-preserved",
        selector: `${gapLayout} .qti3-gap-passage`,
        className: "qti3-gap-placement",
      },
      {
        type: "attribute",
        selector: `${player} [data-gap-identifier="G2"]`,
        name: "data-qti-gap-input-width",
        value: "10",
      },
      {
        type: "computed-style-differs",
        firstSelector: `${player} [data-gap-identifier="G1"] button`,
        secondSelector: `${player} [data-gap-identifier="G2"] button`,
        property: "min-inline-size",
      },
    ],
  ),
  entry("content-layout-row-col6", "content", ["qti-layout-row", "qti-layout-col6"], "stylesheet", [
    {
      type: "layout-width-ratio",
      firstSelector: `${player} #sv-layout-left`,
      secondSelector: `${player} #sv-layout-row`,
      ratio: 0.5,
      tolerance: 0.03,
    },
    {
      type: "layout-width-ratio",
      firstSelector: `${player} #sv-layout-right`,
      secondSelector: `${player} #sv-layout-row`,
      ratio: 0.5,
      tolerance: 0.03,
    },
    {
      type: "layout-same-row",
      firstSelector: `${player} #sv-layout-left`,
      secondSelector: `${player} #sv-layout-right`,
      tolerance: 2,
    },
  ]),
  entry("content-visually-hidden", "content", "qti-visually-hidden", "stylesheet", [
    {
      type: "class-preserved",
      selector: `${player} #sv-visually-hidden`,
      className: "qti-visually-hidden",
    },
    {
      type: "computed-style",
      selector: `${player} #sv-visually-hidden`,
      property: "position",
      value: "absolute",
    },
    {
      type: "computed-style",
      selector: `${player} #sv-visually-hidden`,
      property: "clip-path",
      value: "inset(50%)",
    },
    {
      type: "computed-style-number",
      selector: `${player} #sv-visually-hidden`,
      property: "width",
      comparison: "less-than-or-equal",
      value: 1,
    },
    {
      type: "computed-style-number",
      selector: `${player} #sv-visually-hidden`,
      property: "height",
      comparison: "less-than-or-equal",
      value: 1,
    },
    {
      type: "aria-snapshot-contains",
      selector: `${player} .qti3-item-body`,
      text: "Screen reader vocabulary note",
    },
  ]),
  entry("content-keyword-emphasis", "content", "qti-keyword-emphasis", "conditional", [
    {
      type: "class-preserved",
      selector: `${player} #sv-keyword`,
      className: "qti-keyword-emphasis",
    },
    {
      type: "computed-style-same",
      firstSelector: `${player} #sv-keyword`,
      secondSelector: `${player} #sv-keyword-control`,
      property: "font-weight",
    },
    {
      type: "computed-style-same",
      firstSelector: `${player} #sv-keyword`,
      secondSelector: `${player} #sv-keyword-control`,
      property: "text-decoration-line",
    },
    {
      type: "set-attribute",
      selector: player,
      name: "data-keyword-emphasis",
      value: "true",
    },
    {
      type: "attribute",
      selector: `${player} .qti3-player`,
      name: "data-keyword-emphasis",
      value: "true",
    },
    {
      type: "computed-style-differs",
      firstSelector: `${player} #sv-keyword`,
      secondSelector: `${player} #sv-keyword-control`,
      property: "font-weight",
    },
    {
      type: "computed-style",
      selector: `${player} #sv-keyword`,
      property: "text-decoration-line",
      value: "underline",
    },
  ]),
  entry("content-suppress-tts", "content", "data-qti-suppress-tts", "stylesheet", [
    {
      type: "attribute",
      selector: `${player} #sv-suppress-tts`,
      name: "data-qti-suppress-tts",
      value: "computer-read-aloud",
    },
  ]),
];
