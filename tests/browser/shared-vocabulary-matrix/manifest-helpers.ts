import type { PlayerMessageCatalog } from "../../../packages/player/src/player-message-catalog.js";
import type {
  SharedVocabularyAssertion,
  SharedVocabularyInteractionType,
  SharedVocabularyManifestEntry,
} from "./types.js";
import {
  choice,
  choiceA,
  choiceB,
  choiceList,
  graphicGapHotspotT1,
  graphicGapHotspotT2,
  graphicGapRoot,
  graphicGapSourceA,
  itemPath,
} from "./manifest-selectors.js";

interface EntryOptions {
  forcedColors?: true;
  messageCatalog?: PlayerMessageCatalog;
}

export function entry(
  id: string,
  interactionType: SharedVocabularyInteractionType,
  className: string | string[],
  supportLevel: SharedVocabularyManifestEntry["supportLevel"],
  assertions: SharedVocabularyAssertion[],
  options: EntryOptions = {},
): SharedVocabularyManifestEntry {
  const { forcedColors, messageCatalog } = options;
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
    ...(messageCatalog ? { messageCatalog } : {}),
    assertions: [...forcedColorsAssertions, ...assertions],
  };
}

export function graphicGapSelectionAssertions(className: string): SharedVocabularyAssertion[] {
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
      property: "outline-style",
    },
  ];
}

export function choiceVerticalRlStylesheetAssertions(
  className: string | string[] = "qti-writing-orientation-vertical-rl",
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
      type: "computed-style",
      selector: choiceList,
      property: "writing-mode",
      value: "vertical-rl",
    },
    {
      type: "computed-style",
      selector: `${choice} .qti3-choice-label`,
      property: "text-orientation",
      value: "upright",
    },
  ];
}

export function selectionAssertions(className: string): SharedVocabularyAssertion[] {
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

export function choiceStackingAssertions(
  className: string | string[],
  stacking: number,
  orientation = "horizontal",
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

export const labelStyleCases: LabelCase[] = [
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

export const labelSuffixCases: LabelCase[] = [
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

export function labelAssertions(
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

export function classNames(className: string | string[]): string[] {
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

export function interactionInputWidthPairAssertions(
  narrowSelector: string,
  wideSelector: string,
): SharedVocabularyAssertion[] {
  const controls = [
    { selector: narrowSelector, width: "4" },
    { selector: wideSelector, width: "20" },
  ] as const;
  return [
    ...controls.flatMap(({ selector, width }) => [
      {
        type: "attribute",
        selector,
        name: "data-qti-input-width",
        value: width,
      } satisfies SharedVocabularyAssertion,
      {
        type: "inline-style",
        selector,
        property: "inline-size",
        value: "",
      } satisfies SharedVocabularyAssertion,
      {
        type: "inline-style",
        selector,
        property: "--qti3-input-width",
        value: `${width}ch`,
      } satisfies SharedVocabularyAssertion,
    ]),
    {
      type: "computed-style-differs",
      firstSelector: narrowSelector,
      secondSelector: wideSelector,
      property: "inline-size",
    },
  ];
}

export function choicesPositionAssertions(
  options: ChoicesPositionOptions,
): SharedVocabularyAssertion[] {
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
