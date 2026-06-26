export const CONTROL_PLAYER_STYLES = `
.qti3-player {
  --qti3-control-border-color: color-mix(in srgb, CanvasText 34%, Canvas);
  --qti3-control-surface: Canvas;
  --qti3-control-surface-hover: color-mix(in srgb, CanvasText 5%, Canvas);
}

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

/* Keep vertical order rows tall enough for block MathML in choice handles. */
.qti3-reorder-list > .qti3-reorder-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  min-block-size: 4rem;
}

.qti3-reorder-list[data-qti-order-orientation="horizontal"],
.qti3-order-sv-layout[data-qti-order-orientation="horizontal"] .qti3-order-target-list {
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  justify-content: start;
  overflow-x: auto;
}

.qti3-reorder-list[data-qti-order-orientation="horizontal"] .qti3-reorder-item {
  display: flex;
  align-self: start;
  min-block-size: 0;
}

.qti3-choices-layout {
  --qti3-choices-container-width: 14rem;
  display: grid;
  gap: 0.75rem;
  align-items: start;
  inline-size: 100%;
  max-inline-size: 100%;
}

.qti3-choices-layout[data-qti-choices-position="top"],
.qti3-choices-layout[data-qti-choices-position="bottom"] {
  grid-template-columns: minmax(0, 1fr);
}

.qti3-choices-layout[data-qti-choices-position="left"],
.qti3-choices-layout[data-qti-choices-position="right"] {
  overflow-x: auto;
}

.qti3-choices-layout[data-qti-choices-position="left"] {
  grid-template-columns: auto minmax(0, 1fr);
}

.qti3-choices-layout[data-qti-choices-position="right"] {
  grid-template-columns: minmax(0, 1fr) auto;
}

.qti3-choices-layout[data-qti-choices-position="top"] .qti3-choices-bank,
.qti3-choices-layout[data-qti-choices-position="bottom"] .qti3-choices-bank {
  inline-size: 100%;
  max-inline-size: var(--qti3-choices-container-width);
}

.qti3-choices-layout[data-qti-choices-position="top"]
  .qti3-choices-bank:not([data-qti-choices-container-width]),
.qti3-choices-layout[data-qti-choices-position="bottom"]
  .qti3-choices-bank:not([data-qti-choices-container-width]) {
  max-inline-size: none;
}

.qti3-choices-layout[data-qti-choices-position="left"] .qti3-choices-bank,
.qti3-choices-layout[data-qti-choices-position="right"] .qti3-choices-bank {
  inline-size: max-content;
  max-inline-size: var(--qti3-choices-container-width);
  justify-self: start;
}

.qti3-choices-main {
  min-inline-size: 0;
}

.qti3-order-sv-group {
  container-type: inline-size;
}

.qti3-order-sv-layout {
  --qti3-order-choices-container-width: 14rem;
  display: grid;
  gap: 0.75rem;
  align-items: start;
}

.qti3-order-sv-layout[data-qti-choices-position="top"],
.qti3-order-sv-layout[data-qti-choices-position="bottom"] {
  grid-template-columns: minmax(0, 1fr);
}

.qti3-order-sv-layout[data-qti-choices-position="left"],
.qti3-order-sv-layout[data-qti-choices-position="right"] {
  overflow-x: auto;
}

.qti3-order-sv-layout[data-qti-choices-position="left"] {
  grid-template-columns: auto minmax(0, 1fr);
}

.qti3-order-sv-layout[data-qti-choices-position="right"] {
  grid-template-columns: minmax(0, 1fr) auto;
}

.qti3-order-choices-bank {
  align-content: start;
  max-inline-size: var(--qti3-order-choices-container-width);
}

.qti3-order-sv-layout[data-qti-choices-position="left"] .qti3-order-choices-bank,
.qti3-order-sv-layout[data-qti-choices-position="right"] .qti3-order-choices-bank {
  inline-size: max-content;
  justify-self: start;
}

.qti3-order-sv-layout .qti3-order-choices-bank[data-qti-choices-container-width] {
  inline-size: var(--qti3-order-choices-container-width);
}

.qti3-order-sv-layout[data-qti-choices-position="top"] .qti3-order-choices-bank,
.qti3-order-sv-layout[data-qti-choices-position="bottom"] .qti3-order-choices-bank {
  inline-size: 100%;
}

.qti3-order-sv-layout[data-qti-choices-position="top"]
  .qti3-order-choices-bank:not([data-qti-choices-container-width]),
.qti3-order-sv-layout[data-qti-choices-position="bottom"]
  .qti3-order-choices-bank:not([data-qti-choices-container-width]) {
  max-inline-size: none;
}

.qti3-order-target-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.qti3-order-target-slot {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
  min-block-size: 3rem;
  padding: 0.5rem;
  border: 1px dashed CanvasText;
  background: Canvas;
  color: CanvasText;
}

.qti3-order-target-slot[data-empty="false"] {
  border-style: solid;
}

.qti3-order-target-label {
  min-inline-size: 1.75rem;
  font-weight: 700;
}

.qti3-order-target-empty {
  color: color-mix(in srgb, CanvasText 70%, Canvas);
}

.qti3-order-target-item {
  margin: 0;
}

.qti3-order-sv-layout[data-qti-order-orientation="vertical"] .qti3-order-choices-bank,
.qti3-order-sv-layout[data-qti-order-orientation="vertical"] .qti3-order-target-list {
  align-content: start;
}

.qti3-order-sv-layout[data-qti-order-orientation="vertical"] .qti3-order-choices-bank {
  flex-direction: column;
  align-items: stretch;
}

.qti3-reorder-item {
  padding: 0.5rem;
  border: 0;
  background: transparent;
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

.qti3-reorder-handle {
  inline-size: 100%;
  justify-content: flex-start;
  text-align: start;
  min-inline-size: 0;
  min-block-size: 4rem;
  border-color: var(--qti3-order-row-border-color, var(--qti3-control-border-color));
  background: var(--qti3-order-row-background, var(--qti3-control-surface));
}

.qti3-reorder-handle:hover {
  background: var(--qti3-order-row-background-hover, var(--qti3-control-surface-hover));
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  padding: 0.35rem 0.5rem;
}

.qti3-pair-chip-label {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.qti3-point-controls,
.qti3-drawing-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block-start: 0.5rem;
}
`.trim();
