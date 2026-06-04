export const CONTROL_PLAYER_STYLES = `
.qti3-reorder-item,
.qti3-token-region,
.qti3-pair-chip,
.qti3-gap-region,
.qti3-gap-target {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.qti3-reorder-list {
  display: grid;
  gap: 0.5rem;
  padding-inline-start: 1.5rem;
}

.qti3-reorder-item {
  padding: 0.5rem;
  border: 1px solid CanvasText;
  background: Canvas;
  color: CanvasText;
}

.qti3-drop-target {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

.qti3-token,
.qti3-icon-button,
.qti3-player button,
.qti3-player select,
.qti3-player input,
.qti3-player textarea {
  font: inherit;
}

.qti3-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 2.5rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid CanvasText;
  background: Canvas;
  color: CanvasText;
  cursor: grab;
}

.qti3-gap-choice-image {
  display: block;
  max-inline-size: 100%;
  block-size: auto;
  pointer-events: none;
}

.qti3-icon-button {
  display: inline-grid;
  place-items: center;
  inline-size: 2.25rem;
  block-size: 2.25rem;
  padding: 0;
  line-height: 1;
}

.qti3-remove-button {
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.qti3-remove-button:hover {
  background: color-mix(in srgb, currentColor 14%, transparent);
}

.qti3-trash-icon {
  inline-size: 1.125rem;
  block-size: 1.125rem;
}

.qti3-movement-icon {
  inline-size: 1rem;
  block-size: 1rem;
}

.qti3-trash-icon path,
.qti3-movement-icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.qti3-token[aria-pressed="true"],
.qti3-pair-chip {
  background: Highlight;
  color: HighlightText;
}

.qti3-pair-list {
  display: grid;
  gap: 0.5rem;
  padding-inline-start: 1.5rem;
}

.qti3-pair-chip {
  width: fit-content;
  padding: 0.35rem 0.5rem;
}

.qti3-point-controls,
.qti3-drawing-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block-start: 0.5rem;
}
`.trim();
