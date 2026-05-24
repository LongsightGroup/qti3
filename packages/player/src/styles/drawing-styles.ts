export const DRAWING_PLAYER_STYLES = `
.qti3-drawing-surface {
  color-scheme: light;
  box-sizing: border-box;
  border: 1px solid #000;
  background: #fff;
  color: #000;
}

.qti3-drawing-surface .qti3-drawing-stroke {
  fill: none;
  stroke: #000;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (forced-colors: active) {
  .qti3-drawing-surface {
    border-color: CanvasText;
    background: Canvas;
    color: #000;
  }

  .qti3-drawing-surface .qti3-drawing-stroke {
    stroke: #000;
  }
}
`.trim();
