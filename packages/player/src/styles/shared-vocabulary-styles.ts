const layoutColumnStyles = Array.from({ length: 12 }, (_, index) => {
  const span = index + 1;
  const percent = `${(span / 12) * 100}%`;
  return `.qti3-item-body .qti-layout-row > .qti-layout-col${span},
.qti3-item-body .qti-layout-row > .qti-layout-col-${span} {
  flex-basis: ${percent};
  max-inline-size: ${percent};
}`;
}).join("\n\n");

const layoutOffsetStyles = Array.from({ length: 11 }, (_, index) => {
  const offset = index + 1;
  const percent = `${(offset / 12) * 100}%`;
  return `.qti3-item-body .qti-layout-row > .qti-layout-offset${offset},
.qti3-item-body .qti-layout-row > .qti-layout-offset-${offset} {
  margin-inline-start: ${percent};
}`;
}).join("\n\n");

const listStyleTypes = [
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
]
  .map((styleType) => {
    return `.qti3-player .qti-list-style-type-${styleType} {
  list-style-type: ${styleType};
}`;
  })
  .join("\n\n");

const textIndentStyles = [
  ["0", "0"],
  ["px", "1px"],
  ["0p5", "0.125rem"],
  ["1", "0.25rem"],
  ["1p5", "0.375rem"],
  ["2", "0.5rem"],
  ["2p5", "0.625rem"],
  ["3", "0.75rem"],
  ["3p5", "0.875rem"],
  ["4", "1rem"],
  ["5", "1.25rem"],
  ["6", "1.5rem"],
  ["7", "1.75rem"],
  ["8", "2rem"],
  ["12", "3rem"],
  ["16", "4rem"],
  ["20", "5rem"],
  ["24", "6rem"],
  ["28", "7rem"],
  ["32", "8rem"],
]
  .map(([suffix, value]) => {
    return `.qti3-player .qti-text-indent-${suffix} {
  text-indent: ${value};
}`;
  })
  .join("\n\n");

export const SHARED_VOCABULARY_PLAYER_STYLES = `
.qti3-item-body {
  container-type: inline-size;
}

/* QTI Shared Vocabulary §1.1.3: twelve-column item-body layout rows. */
.qti3-item-body .qti-layout-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  inline-size: 100%;
  max-inline-size: 100%;
}

.qti3-item-body .qti-layout-row > [class*="qti-layout-col"] {
  flex: 0 0 auto;
  inline-size: 100%;
  max-inline-size: 100%;
  min-inline-size: 0;
  box-sizing: border-box;
}

${layoutColumnStyles}

${layoutOffsetStyles}

@container (inline-size < 40rem) {
  .qti3-item-body .qti-layout-row > [class*="qti-layout-col"] {
    flex-basis: 100%;
    max-inline-size: 100%;
    margin-inline-start: 0;
  }
}

.qti3-player[data-keyword-emphasis="true"] .qti-keyword-emphasis {
  font-weight: 700;
  text-decoration-line: underline;
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.14em;
}

.qti3-player .qti-align-left {
  text-align: left;
}

.qti3-player .qti-align-center {
  text-align: center;
}

.qti3-player .qti-align-right {
  text-align: right;
}

.qti3-player .qti-valign-top {
  vertical-align: top;
}

.qti3-player .qti-valign-middle {
  vertical-align: middle;
}

.qti3-player .qti-valign-baseline {
  vertical-align: baseline;
}

.qti3-player .qti-valign-bottom {
  vertical-align: bottom;
}

.qti3-player .qti-fullwidth,
.qti3-player .qti-width-full {
  inline-size: 100%;
  max-inline-size: 100%;
}

${textIndentStyles}

.qti3-player .qti-writing-mode-vertical-rl {
  writing-mode: vertical-rl;
}

.qti3-player .qti-writing-mode-vertical-lr {
  writing-mode: vertical-lr;
}

.qti3-player .qti-writing-mode-vertical-tb {
  writing-mode: vertical-lr;
}

.qti3-player .qti-writing-mode-horizontal-tb {
  writing-mode: horizontal-tb;
}

.qti3-player .qti-text-orientation-upright {
  text-orientation: upright;
}

.qti3-player .qti-text-combine-upright-all {
  text-combine-upright: all;
}

.qti3-player .qti-float-left {
  float: left;
}

.qti3-player .qti-float-right {
  float: right;
}

.qti3-player .qti-float-none {
  float: none;
}

.qti3-player .qti-float-clearfix::after {
  content: "";
  clear: both;
  display: table;
}

.qti3-player .qti-float-clear-left {
  clear: left;
}

.qti3-player .qti-float-clear-right {
  clear: right;
}

.qti3-player .qti-float-clear-both {
  clear: both;
}

.qti3-player .qti-bordered {
  border: 1px solid color-mix(in srgb, CanvasText 55%, Canvas);
  padding: 0.125rem;
}

.qti3-player .qti-well {
  min-block-size: 1.25rem;
  padding: 1.1875rem;
  margin-block-end: 1.25rem;
  border: 1px solid color-mix(in srgb, CanvasText 20%, Canvas);
  border-radius: 0.25rem;
  background: color-mix(in srgb, CanvasText 5%, Canvas);
  color: CanvasText;
  box-shadow: inset 0 1px 1px color-mix(in srgb, CanvasText 8%, transparent);
}

${listStyleTypes}

.qti3-player .qti-underline {
  text-decoration-line: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.14em;
}

.qti3-player .qti-italic {
  font-style: italic;
}

.qti3-player .qti-display-inline-block {
  display: inline-block;
}
`.trim();
