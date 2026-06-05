import type { SharedVocabularyManifestEntry } from "./types.js";
import { itemBody, player } from "./manifest-selectors.js";
import { entry } from "./manifest-helpers.js";

export const contentManifestEntries: SharedVocabularyManifestEntry[] = [
  entry(
    "content-layout-row-col6",
    "content",
    ["qti-layout-row", "qti-layout-col6", "qti-layout-offset-3"],
    "stylesheet",
    [
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
      {
        type: "position",
        firstSelector: `${player} #sv-layout-row`,
        secondSelector: `${player} #sv-offset-column`,
        axis: "x",
        relation: "less-than",
      },
    ],
  ),
  entry(
    "content-stylesheet-generated-reps",
    "content",
    [
      "qti-align-center",
      "qti-width-full",
      "qti-text-indent-2",
      "qti-writing-mode-vertical-rl",
      "qti-float-left",
      "qti-list-style-type-square",
    ],
    "stylesheet",
    [
      {
        type: "layout-width-ratio",
        firstSelector: `${player} #sv-fullwidth`,
        secondSelector: itemBody,
        ratio: 1,
        tolerance: 0.05,
      },
      {
        type: "computed-style",
        selector: `${player} #sv-centered`,
        property: "text-align",
        value: "center",
      },
      {
        type: "computed-style-number",
        selector: `${player} #sv-centered`,
        property: "text-indent",
        comparison: "greater-than",
        value: 0,
      },
      {
        type: "computed-style",
        selector: `${player} #sv-list`,
        property: "list-style-type",
        value: "square",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-writing`,
        property: "writing-mode",
        value: "vertical-rl",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-float`,
        property: "float",
        value: "left",
      },
    ],
  ),
  entry(
    "content-stylesheet-typography",
    "content",
    [
      "qti-underline",
      "qti-italic",
      "qti-text-orientation-upright",
      "qti-text-combine-upright-all",
      "qti-display-inline-block",
      "qti-valign-middle",
    ],
    "stylesheet",
    [
      {
        type: "computed-style",
        selector: `${player} #sv-underlined`,
        property: "text-decoration-line",
        value: "underline",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-inline`,
        property: "font-style",
        value: "italic",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-inline`,
        property: "display",
        value: "inline-block",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-inline`,
        property: "vertical-align",
        value: "middle",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-orientation`,
        property: "text-orientation",
        value: "upright",
      },
      {
        type: "computed-style",
        selector: `${player} #sv-combine`,
        property: "text-combine-upright",
        value: "all",
      },
    ],
  ),
  entry("content-stylesheet-box", "content", ["qti-bordered", "qti-well"], "stylesheet", [
    {
      type: "computed-style",
      selector: `${player} #sv-utility-box`,
      property: "border-top-style",
      value: "solid",
    },
    {
      type: "computed-style-not",
      selector: `${player} #sv-utility-box`,
      property: "background-color",
      value: "rgba(0, 0, 0, 0)",
    },
  ]),
  entry("content-visually-hidden", "content", ["qti-visually-hidden", "qti-hidden"], "stylesheet", [
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
    {
      type: "computed-style",
      selector: `${player} #sv-hidden`,
      property: "display",
      value: "none",
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
