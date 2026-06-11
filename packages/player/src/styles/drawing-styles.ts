export const DRAWING_PLAYER_STYLES = `
.qti3-drawing-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-block-end: 0.75rem;
}

.qti3-drawing-color {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color-scheme: light;
}

.qti3-drawing-color-label {
  font: inherit;
}

.qti3-drawing-color-input {
  box-sizing: border-box;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0.125rem;
  border: 1px solid #000;
  border-radius: 0.25rem;
  background: #fff;
  cursor: pointer;
}

.qti3-drawing-color-input:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

.qti3-drawing-surface {
  color-scheme: light;
  box-sizing: border-box;
  border: 1px solid #000;
  background: #fff;
  color: #000;
}

.qti3-drawing-surface .qti3-drawing-stroke {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (forced-colors: active) {
  .qti3-drawing-color-input {
    border-color: CanvasText;
    background: Canvas;
  }

  .qti3-drawing-surface {
    border-color: CanvasText;
    background: Canvas;
    color: CanvasText;
  }
}
`.trim();
