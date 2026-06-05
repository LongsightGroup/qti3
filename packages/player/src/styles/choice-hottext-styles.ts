export const CHOICE_HOTTEXT_PLAYER_STYLES = `
.qti3-choice-group {
  container-type: inline-size;
}

.qti3-choice-list {
  display: grid;
  gap: 0.5rem;
  inline-size: 100%;
  grid-template-columns: minmax(0, 42rem);
}

.qti3-choice-list[data-qti-orientation="horizontal"],
.qti3-choice-list[data-qti-stacking] {
  max-inline-size: 100%;
  grid-template-columns: repeat(var(--qti3-choice-columns), minmax(0, 1fr));
}

.qti3-choice-list[data-qti-orientation="vertical"][data-qti-stacking] {
  grid-auto-flow: column;
  grid-template-rows: repeat(var(--qti3-choice-rows), auto);
}

/* Collapse multi-column choice layouts when the choice group is narrower than ~544px. */
@container (inline-size < 34rem) {
  .qti3-choice-list[data-qti-orientation="horizontal"],
  .qti3-choice-list[data-qti-stacking] {
    grid-auto-flow: row;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
  }
}

.qti3-choice-option {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: center;
  justify-content: start;
  inline-size: 100%;
  box-sizing: border-box;
  min-block-size: 2.75rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid CanvasText;
  background: Canvas;
  color: CanvasText;
  cursor: pointer;
}

.qti3-choice.qti-input-control-hidden .qti3-choice-option {
  grid-template-columns: auto minmax(0, 1fr);
}

.qti3-choice.qti-input-control-hidden .qti3-choice-option input {
  position: absolute;
  overflow: hidden;
  clip: rect(1px, 1px, 1px, 1px);
  clip-path: inset(50%);
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  white-space: nowrap;
}

.qti3-choice.qti-input-control-hidden .qti3-choice-option:has(input:focus) {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

.qti3-choice-option input {
  margin: 0;
  inline-size: 1rem;
  block-size: 1rem;
}

.qti3-choice-label {
  min-inline-size: 1.75rem;
  font-weight: 700;
}

.qti3-choice.qti-writing-orientation-vertical-rl .qti3-choice-list,
.qti3-choice.qti-writing-orientation-vertical-lr .qti3-choice-list {
  writing-mode: vertical-rl;
  align-items: start;
}

.qti3-choice.qti-writing-orientation-vertical-lr .qti3-choice-list {
  writing-mode: vertical-lr;
}

.qti3-choice.qti-writing-orientation-vertical-rl .qti3-choice-label,
.qti3-choice.qti-writing-orientation-vertical-lr .qti3-choice-label {
  text-orientation: upright;
}

.qti3-choice-text {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.qti3-choice-option[data-selected="true"] {
  background: Highlight;
  color: HighlightText;
}

.qti3-choice.qti-selections-light .qti3-choice-option:not([data-selected="true"]) {
  border-color: color-mix(in srgb, Highlight 35%, CanvasText);
  background: color-mix(in srgb, Highlight 12%, Canvas);
}

.qti3-choice.qti-selections-dark .qti3-choice-option:not([data-selected="true"]) {
  border-color: Highlight;
  background: color-mix(in srgb, Highlight 28%, Canvas);
  color: color-mix(in srgb, CanvasText 72%, Highlight);
  opacity: 0.86;
}

.qti3-choice.qti-unselected-hidden
  .qti3-choice-option:not([data-selected="true"]):not(:has(input:focus-visible)) {
  border-color: transparent;
  background: transparent;
  color: inherit;
  opacity: 0.58;
}

.qti3-hottext-group {
  max-inline-size: 58rem;
}

.qti3-hottext-passage {
  margin-block: 0;
  font-size: 1.05rem;
  line-height: 1.75;
}

.qti3-hottext-token {
  display: inline;
  margin-inline: 0.1rem;
  padding: 0.12rem 0.28rem;
  border: 1px solid CanvasText;
  border-radius: 0.2rem;
  background: Canvas;
  color: LinkText;
  font: inherit;
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
  cursor: pointer;
}

.qti3-hottext-token[data-selected="true"] {
  background: Highlight;
  color: HighlightText;
  text-decoration-color: HighlightText;
}

.qti3-hottext.qti-input-control-hidden .qti3-hottext-token {
  border-color: currentColor;
  background: transparent;
}

.qti3-hottext.qti-unselected-hidden
  .qti3-hottext-token:not([data-selected="true"]):not(:focus):not(:focus-visible) {
  border-color: transparent;
  background: transparent;
  color: inherit;
  text-decoration-color: transparent;
}

@media (forced-colors: active) {
  .qti3-choice.qti-selections-light .qti3-choice-option:not([data-selected="true"]),
  .qti3-choice.qti-selections-dark .qti3-choice-option:not([data-selected="true"]),
  .qti3-choice.qti-unselected-hidden
    .qti3-choice-option:not([data-selected="true"]):not(:has(input:focus-visible)),
  .qti3-hottext.qti-input-control-hidden .qti3-hottext-token,
  .qti3-hottext.qti-unselected-hidden
    .qti3-hottext-token:not([data-selected="true"]):not(:focus):not(:focus-visible) {
    border-color: CanvasText;
    background: Canvas;
  }

  .qti3-choice.qti-selections-light .qti3-choice-option:not([data-selected="true"]),
  .qti3-choice.qti-selections-dark .qti3-choice-option:not([data-selected="true"]),
  .qti3-choice.qti-unselected-hidden
    .qti3-choice-option:not([data-selected="true"]):not(:has(input:focus-visible)) {
    color: CanvasText;
  }

  .qti3-hottext.qti-input-control-hidden .qti3-hottext-token,
  .qti3-hottext.qti-unselected-hidden
    .qti3-hottext-token:not([data-selected="true"]):not(:focus):not(:focus-visible) {
    color: LinkText;
    text-decoration-color: LinkText;
  }

  .qti3-choice-option[data-selected="true"],
  .qti3-hottext-token[data-selected="true"] {
    background: Highlight;
    color: HighlightText;
  }

  .qti3-hottext-token[data-selected="true"] {
    text-decoration-color: HighlightText;
  }
}
`.trim();
