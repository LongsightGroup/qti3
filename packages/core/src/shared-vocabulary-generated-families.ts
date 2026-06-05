import type { SharedVocabularySupportLevel } from "./shared-vocabulary-levels.js";

export const SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT = 12;
export const SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT = 11;

export const SHARED_VOCABULARY_CONTENT_ALIGNMENTS = ["left", "center", "right"] as const;
export const SHARED_VOCABULARY_CONTENT_VALIGNS = ["top", "middle", "baseline", "bottom"] as const;
export const SHARED_VOCABULARY_CONTENT_WIDTH_ALIASES = ["fullwidth", "width-full"] as const;
export const SHARED_VOCABULARY_CONTENT_WRITING_MODES = [
  "vertical-rl",
  "vertical-lr",
  "vertical-tb",
  "horizontal-tb",
] as const;
export const SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES = [
  "left",
  "right",
  "none",
  "clearfix",
  "clear-left",
  "clear-right",
  "clear-both",
] as const;
export const SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS = [
  "vertical-rl",
  "vertical-lr",
] as const;

export const SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES = [
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

export const SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES = [
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

export interface SharedVocabularyMatrixCoverageFamily {
  id: string;
  levels: readonly SharedVocabularySupportLevel[];
  coveredBy: readonly string[];
  rationale: string;
  matches: (className: string) => boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternationPattern(values: readonly string[]): string {
  return [...values]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
}

function layoutSpanTokens(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

const layoutColumnPattern = new RegExp(
  `^qti-layout-col-?(?:${alternationPattern(layoutSpanTokens(SHARED_VOCABULARY_LAYOUT_COLUMN_SPAN_COUNT))})$`,
);

const layoutOffsetPattern = new RegExp(
  `^qti-layout-offset-?(?:${alternationPattern(layoutSpanTokens(SHARED_VOCABULARY_LAYOUT_OFFSET_COUNT))})$`,
);

const contentAlignmentPattern = new RegExp(
  `^qti-align-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_ALIGNMENTS)})$|^qti-valign-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_VALIGNS)})$`,
);

const contentWidthAliasPattern = new RegExp(
  `^qti-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_WIDTH_ALIASES)})$`,
);

const contentTextIndentPattern = new RegExp(
  `^qti-text-indent-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_TEXT_INDENT_SUFFIXES)})$`,
);

const contentWritingModePattern = new RegExp(
  `^qti-writing-mode-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_WRITING_MODES)})$`,
);

const contentFloatPattern = new RegExp(
  `^qti-float-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_FLOAT_SUFFIXES)})$`,
);

const contentListStylePattern = new RegExp(
  `^qti-list-style-type-(?:${alternationPattern(SHARED_VOCABULARY_CONTENT_LIST_STYLE_TYPES)})$`,
);

const choiceWritingOrientationPattern = new RegExp(
  `^qti-writing-orientation-(?:${alternationPattern(SHARED_VOCABULARY_CHOICE_WRITING_ORIENTATIONS)})$`,
);

export const sharedVocabularyMatrixCoverageFamilies: SharedVocabularyMatrixCoverageFamily[] = [
  {
    id: "content-layout-generated-column-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-layout-col6"],
    rationale:
      "Column width classes are generated from the same twelve-column CSS template; qti-layout-col6 exercises the generated percentage rule and row wrapping behavior.",
    matches: (className) => layoutColumnPattern.test(className),
  },
  {
    id: "content-layout-generated-offset-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-layout-offset-3"],
    rationale:
      "Offset classes are generated from one CSS template; qti-layout-offset-3 exercises the generated margin rule.",
    matches: (className) => layoutOffsetPattern.test(className),
  },
  {
    id: "content-alignment-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-align-center", "qti-valign-middle"],
    rationale:
      "Alignment classes map one vocabulary suffix to the corresponding CSS property value; center and middle cover the text-align and vertical-align families.",
    matches: (className) => contentAlignmentPattern.test(className),
  },
  {
    id: "content-width-aliases",
    levels: ["stylesheet"],
    coveredBy: ["qti-width-full"],
    rationale:
      "Both width aliases share the same CSS declaration block; qti-width-full covers the rendered width behavior.",
    matches: (className) => contentWidthAliasPattern.test(className),
  },
  {
    id: "content-text-indent-generated-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-text-indent-2"],
    rationale:
      "Text-indent classes are generated from the same suffix-to-length table; qti-text-indent-2 covers non-zero indentation.",
    matches: (className) => contentTextIndentPattern.test(className),
  },
  {
    id: "content-writing-mode-generated-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-writing-mode-vertical-rl"],
    rationale:
      "Writing-mode classes are direct CSS value mappings; vertical-rl covers the non-default vertical rendering path.",
    matches: (className) => contentWritingModePattern.test(className),
  },
  {
    id: "content-float-generated-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-float-left"],
    rationale:
      "Float and clear classes are direct CSS value mappings; qti-float-left covers the floated rendering path.",
    matches: (className) => contentFloatPattern.test(className),
  },
  {
    id: "content-list-style-generated-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-list-style-type-square"],
    rationale:
      "List-style classes are generated from the shared vocabulary token table; square covers the generated list-style-type rule.",
    matches: (className) => contentListStylePattern.test(className),
  },
  {
    id: "choice-writing-orientation-generated-variants",
    levels: ["stylesheet"],
    coveredBy: ["qti-writing-orientation-vertical-rl"],
    rationale:
      "Choice writing-orientation classes share the vertical choice layout path; vertical-rl covers the orientation rule and upright labels.",
    matches: (className) => choiceWritingOrientationPattern.test(className),
  },
];

export function matrixCoverageFamilyForClass(
  className: string,
  level: SharedVocabularySupportLevel,
): SharedVocabularyMatrixCoverageFamily | undefined {
  return sharedVocabularyMatrixCoverageFamilies.find(
    (family) => family.levels.includes(level) && family.matches(className),
  );
}
