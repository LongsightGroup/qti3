import type { SharedVocabularyAssertion, SharedVocabularyManifestEntry } from "./types.js";

export type {
  SharedVocabularyAssertion,
  SharedVocabularyManifestEntry,
  SharedVocabularySupportLevel,
} from "./types.js";

export const SV_MATRIX_FIXTURE_ROOT = "packages/fixtures/packages/sv-matrix/items";

const itemPath = (id: string): string => `${SV_MATRIX_FIXTURE_ROOT}/${id}.xml`;
const player = "qti-assessment-item-player";
const choice = `${player} .qti3-choice`;
const choiceA = `${choice} .qti3-choice-option[data-choice-identifier="A"]`;
const choiceB = `${choice} .qti3-choice-option[data-choice-identifier="B"]`;
const orderLayout = `${player} .qti3-order-sv-layout`;
const orderBank = `${orderLayout} .qti3-order-choices-bank`;
const orderTargets = `${orderLayout} .qti3-order-target-list`;
const matchLayout = `${player} .qti3-match-selector`;
const matchRoot = `${player} .qti3-match`;
const matchBank = `${matchLayout} .qti3-match-source-bank`;
const matchTargets = `${matchLayout} .qti3-match-target-bank`;
const gapLayout = `${player} .qti3-gap-match-layout`;
const gapRoot = `${player} .qti3-gapMatch`;
const gapBank = `${gapLayout} .qti3-gap-source-region`;
const gapTargets = `${gapLayout} .qti3-gap-region`;

function entry(
  id: string,
  className: string | string[],
  supportLevel: SharedVocabularyManifestEntry["supportLevel"],
  assertions: SharedVocabularyAssertion[],
  options: { forcedColors?: true } = {},
): SharedVocabularyManifestEntry {
  const forcedColorsAssertions: SharedVocabularyAssertion[] = options.forcedColors
    ? [{ type: "forced-colors-active" }]
    : [];
  return {
    id,
    className,
    supportLevel,
    fixturePath: itemPath(id),
    assertions: [...forcedColorsAssertions, ...assertions],
    ...options,
  };
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
  entry("choice-selections-dark", "qti-selections-dark", "stylesheet", [
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
    "qti-selections-light",
    "stylesheet",
    selectionAssertions("qti-selections-light"),
    { forcedColors: true },
  ),
  entry(
    "choice-selections-dark-forced-colors",
    "qti-selections-dark",
    "stylesheet",
    selectionAssertions("qti-selections-dark"),
    { forcedColors: true },
  ),
  entry("choice-unselected-hidden", "qti-unselected-hidden", "stylesheet", [
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
  entry(
    "choice-stacking-vertical",
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
  entry("choice-input-control-hidden", "qti-input-control-hidden", "stylesheet", [
    { type: "class-preserved", selector: choice, className: "qti-input-control-hidden" },
    { type: "hidden-focusable-input", selector: `${choiceA} input` },
  ]),
  entry("order-choices-left-width", "qti-choices-left", "full", [
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
  entry("order-orientation-vertical", "qti-orientation-vertical", "full", [
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
  entry(
    "match-choices-top",
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
  entry("match-tabular-first-column-header", "qti-match-tabular", "full", [
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
  entry(
    "gap-placement-input-width",
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
  entry("content-layout-row-col6", ["qti-layout-row", "qti-layout-col6"], "stylesheet", [
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
  entry("content-visually-hidden", "qti-visually-hidden", "stylesheet", [
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
  entry("content-suppress-tts", "data-qti-suppress-tts", "stylesheet", [
    {
      type: "attribute",
      selector: `${player} #sv-suppress-tts`,
      name: "data-qti-suppress-tts",
      value: "computer-read-aloud",
    },
  ]),
];
