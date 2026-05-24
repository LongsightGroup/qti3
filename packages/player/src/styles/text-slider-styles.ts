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

.qti3-counter,
.qti3-slider-output {
  margin: 0;
  font-size: 0.9rem;
}

.qti3-slider-response {
  grid-template-columns: minmax(8rem, 1fr) auto;
  align-items: center;
}
`.trim();
