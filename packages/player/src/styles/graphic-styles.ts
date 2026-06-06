export const GRAPHIC_PLAYER_STYLES = `
.qti3-hotspot-overlay {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
  z-index: 2;
}

button.qti3-hotspot-button[data-selected="true"] {
  background: Highlight !important;
  color: HighlightText !important;
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

button.qti3-hotspot-button {
  position: absolute;
  inset-inline-start: var(--qti3-graphic-region-inline-start, 0);
  inset-block-start: var(--qti3-graphic-region-block-start, 0);
  inline-size: var(--qti3-graphic-region-inline-size, auto);
  block-size: var(--qti3-graphic-region-block-size, auto);
  display: grid;
  place-items: start;
  padding: 0.25rem;
  border: 2px solid CanvasText;
  background: color-mix(in srgb, Canvas 65%, transparent);
  color: CanvasText;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

button.qti3-hotspot-button[data-shape="circle"] {
  border-radius: 50%;
}

.qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button {
  cursor: pointer;
  fill: transparent;
  stroke: CanvasText;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: all;
  touch-action: manipulation;
}

.qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button[data-selected="true"] {
  fill: color-mix(in srgb, Highlight 18%, transparent);
  stroke: Highlight;
  stroke-width: 4;
}

.qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button:focus {
  outline: none;
}

.qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button:focus-visible {
  stroke: Highlight;
  stroke-dasharray: 6 3;
  stroke-width: 4;
}

.qti3-graphic-associate-hotspot,
.qti3-graphic-gap-hotspot,
.qti3-graphic-order-hotspot {
  position: absolute;
  inset-inline-start: var(--qti3-graphic-region-inline-start, 0);
  inset-block-start: var(--qti3-graphic-region-block-start, 0);
  inline-size: var(--qti3-graphic-region-inline-size, auto);
  block-size: var(--qti3-graphic-region-block-size, auto);
  z-index: 2;
}

.qti3-graphic-associate-hotspot[data-shape="circle"],
.qti3-graphic-gap-hotspot[data-shape="circle"],
.qti3-graphic-order-hotspot[data-shape="circle"] {
  border-radius: 50%;
}

.qti3-hotspot.qti-selections-light
  .qti3-hotspot-surface
  .qti3-hotspot-overlay
  .qti3-hotspot-button:not([data-selected="true"]) {
  stroke: white;
}

.qti3-hotspot.qti-selections-dark
  .qti3-hotspot-surface
  .qti3-hotspot-overlay
  .qti3-hotspot-button:not([data-selected="true"]) {
  stroke: black;
}

.qti3-hotspot.qti-unselected-hidden
  .qti3-hotspot-surface
  .qti3-hotspot-overlay
  .qti3-hotspot-button:not([data-selected="true"]):not(:focus):not(:focus-visible) {
  opacity: 0;
}

.qti3-graphicGapMatch.qti-selections-light
  .qti3-graphic-gap-hotspot:not([data-selected="true"]) {
  border-color: white;
  color: white;
  background: rgb(0 0 0 / 0.45);
}

.qti3-graphicGapMatch.qti-selections-dark .qti3-graphic-gap-hotspot:not([data-selected="true"]) {
  border-color: black;
  color: black;
  background: rgb(255 255 255 / 0.65);
}

.qti3-graphicGapMatch.qti-unselected-hidden
  .qti3-graphic-gap-hotspot:not([data-selected="true"]):not(:focus):not(:focus-visible) {
  opacity: 0;
}

@supports not (background: color-mix(in srgb, Canvas 65%, transparent)) {
  button.qti3-hotspot-button {
    background: Canvas;
  }
}

@supports not (fill: color-mix(in srgb, Highlight 18%, transparent)) {
  .qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button[data-selected="true"] {
    fill: transparent;
  }
}

@media (forced-colors: active) {
  .qti3-hotspot.qti-selections-light
    .qti3-hotspot-surface
    .qti3-hotspot-overlay
    .qti3-hotspot-button,
  .qti3-hotspot.qti-selections-dark
    .qti3-hotspot-surface
    .qti3-hotspot-overlay
    .qti3-hotspot-button {
    stroke: CanvasText;
  }

  .qti3-graphicGapMatch.qti-selections-light
    .qti3-graphic-gap-hotspot:not([data-selected="true"]),
  .qti3-graphicGapMatch.qti-selections-dark
    .qti3-graphic-gap-hotspot:not([data-selected="true"]) {
    border-color: CanvasText;
    color: CanvasText;
    background: Canvas;
  }

  .qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button[data-selected="true"],
  .qti3-hotspot-surface .qti3-hotspot-overlay .qti3-hotspot-button:focus-visible {
    stroke: Highlight;
    fill: Canvas;
  }
}

.qti3-graphic-surface,
.qti3-hotspot-surface,
.qti3-point-surface,
.qti3-position-object-stage,
.qti3-graphic-associate-surface,
.qti3-graphic-gap-match-surface,
.qti3-graphic-order-surface {
  position: relative;
  border: 1px solid CanvasText;
  background: Canvas;
  overflow: hidden;
  max-inline-size: 100%;
}

.qti3-graphic-associate-surface,
.qti3-graphic-gap-match-surface,
.qti3-graphic-order-surface {
  touch-action: manipulation;
}

.qti3-graphic-associate-lines,
.qti3-graphic-sequence-lines {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
  z-index: 1;
}

.qti3-graphic-associate-lines line,
.qti3-graphic-sequence-lines line {
  stroke: Highlight;
  stroke-width: 4;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.qti3-graphic-sequence-lines marker path {
  fill: Highlight;
}

.qti3-graphic-associate-hotspot,
.qti3-graphic-gap-hotspot,
.qti3-graphic-order-hotspot {
  touch-action: none;
}

.qti3-graphic-gap-match-surface {
  overflow: visible;
  margin-block-end: calc(var(--qti3-graphic-gap-label-block-size, 2rem) + 0.75rem);
}

.qti3-point-surface {
  display: block;
  box-sizing: border-box;
  cursor: crosshair;
  color: CanvasText;
}

.qti3-position-object-stage {
  box-sizing: border-box;
  color: CanvasText;
  touch-action: none;
  overflow: visible;
  margin-block-end: calc(var(--qti3-position-object-marker-block-size, 2rem) + 12px);
}

.qti3-graphic-object-image {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  pointer-events: none;
}

.qti3-position-object-marker {
  position: absolute;
  inline-size: var(--qti3-position-object-marker-inline-size, 2rem);
  block-size: var(--qti3-position-object-marker-block-size, 2rem);
  transform: translate(-50%, -50%);
  border: 2px solid CanvasText;
  background: Canvas;
  color: CanvasText;
  padding: 0;
  cursor: grab;
  touch-action: none;
}

.qti3-position-object-marker[data-placed="true"] {
  inset-inline-start: var(--qti3-position-object-marker-inline-start);
  inset-block-start: var(--qti3-position-object-marker-block-start);
}

.qti3-position-object-marker[data-dragging="true"] {
  cursor: grabbing;
}

.qti3-position-object-marker[data-placed="false"] {
  inset-inline-start: var(--qti3-position-object-unplaced-inline-start, 50%);
  inset-block-start: var(--qti3-position-object-unplaced-block-start, calc(100% + 1rem));
}

.qti3-position-object-marker img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  pointer-events: none;
}

.qti3-point-marker {
  position: absolute;
  inset-inline-start: var(--qti3-point-marker-inline-start);
  inset-block-start: var(--qti3-point-marker-block-start);
  inline-size: 8px;
  block-size: 8px;
  border: 2px solid CanvasText;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.qti3-point-marker[data-active="true"] {
  outline: 2px solid Highlight;
  outline-offset: 1px;
}

.qti3-graphic-gap-hotspot {
  display: grid;
  place-items: center;
  padding: 0;
  overflow: visible;
  border-style: dashed;
  background: rgb(255 255 255 / 0.08);
  color: CanvasText;
}

.qti3-graphic-gap-hotspot[data-selected="true"] {
  border-style: solid;
  background: color-mix(in srgb, Highlight 18%, Canvas);
}

.qti3-graphic-gap-label {
  position: absolute;
  inset-block-start: calc(var(--qti3-graphic-gap-label-block-start, 100%) + 0.2rem);
  inset-inline-start: var(--qti3-graphic-gap-label-inline-start, 50%);
  transform: translateX(-50%);
  box-sizing: border-box;
  z-index: 3;
  inline-size: max-content;
  max-inline-size: min(12rem, calc(100vw - 2rem));
  min-inline-size: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid CanvasText;
  border-radius: 0.25rem;
  background: Canvas;
  color: CanvasText;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
  cursor: grab;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.16);
  text-align: center;
  white-space: normal;
}

.qti3-graphic-gap-label.qti3-graphic-gap-label-in-slot {
  inset-block-start: var(--qti3-graphic-gap-label-block-start, 0);
  inset-inline-start: var(--qti3-graphic-gap-label-inline-start, 0);
  inline-size: var(--qti3-graphic-gap-label-inline-size, auto);
  block-size: var(--qti3-graphic-gap-label-block-size, auto);
  max-inline-size: none;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
  transform: none;
}

.qti3-graphic-gap-label-in-slot .qti3-gap-choice-image {
  max-inline-size: 100%;
  max-block-size: 100%;
  object-fit: contain;
}

@supports not (background: color-mix(in srgb, Highlight 18%, Canvas)) {
  .qti3-graphic-gap-hotspot[data-selected="true"] {
    background: Canvas;
  }
}

.qti3-graphic-order-hotspot {
  display: grid;
  place-items: center;
  gap: 0.15rem;
  text-align: center;
}

.qti3-graphic-order-number {
  display: grid;
  place-items: center;
  min-inline-size: 1.45rem;
  min-block-size: 1.45rem;
  border-radius: 999px;
  background: Highlight;
  color: HighlightText;
  font-weight: 700;
}

.qti3-graphic-order-number:empty {
  display: none;
}

.qti3-graphic-order-list {
  display: grid;
  gap: 0.5rem;
  padding-inline-start: 1.5rem;
  margin-block: 0.5rem 0;
}

.qti3-graphic-order-list[data-qti-order-orientation="horizontal"] {
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  justify-content: start;
  overflow-x: auto;
  padding-inline-start: 0;
}

.qti3-graphic-order-list[data-qti-order-orientation="horizontal"] .qti3-graphic-order-item {
  align-self: start;
}

.qti3-graphic-order-item {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
`.trim();
