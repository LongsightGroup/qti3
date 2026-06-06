export const TEXT_SLIDER_PLAYER_STYLES = `
.qti3-text-response,
.qti3-slider-response {
  display: grid;
  gap: 0.4rem;
  max-inline-size: 42rem;
}

.qti3-text-input,
.qti3-textarea {
  inline-size: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  border: 1px solid CanvasText;
  background: Canvas;
  color: CanvasText;
}

.qti3-textarea {
  min-block-size: 8rem;
  resize: vertical;
}

.qti3-text-input[data-qti-input-width],
.qti3-inline-select[data-qti-input-width] {
  inline-size: var(--qti3-input-width);
  min-inline-size: var(--qti3-input-width);
  max-inline-size: 100%;
}

.qti3-counter,
.qti3-slider-output,
.qti3-pattern-mask-message {
  margin: 0;
  font-size: 0.9rem;
}

.qti3-pattern-mask-message {
  color: LinkText;
}

.qti3-inline-text-response .qti3-pattern-mask-message {
  display: block;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-rl .qti3-inline-select,
.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-select {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-select {
  writing-mode: vertical-lr;
}

.qti3-slider-response {
  grid-template-columns: minmax(8rem, 1fr) auto;
  align-items: center;
}
`.trim();
