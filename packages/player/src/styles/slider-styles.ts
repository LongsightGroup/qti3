export const SLIDER_PLAYER_STYLES = `
.qti3-slider-response {
  --qti3-slider-hit-size: 2.75rem;
  --qti3-slider-inline-padding: 0.5rem;
  --qti3-slider-thumb-size: 1.25rem;
  --qti3-slider-track-size: 0.375rem;
  --qti3-slider-ratio: 0%;

  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(6rem, auto);
  gap: 0.5rem 0.75rem;
  align-items: start;
  max-inline-size: 42rem;
  color: CanvasText;
}

.qti3-slider-response[data-orientation="vertical"] {
  grid-template-columns: auto;
  inline-size: fit-content;
}

.qti3-slider-control {
  position: relative;
  min-inline-size: 0;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-control {
  inline-size: 100%;
  min-inline-size: 12rem;
  block-size: 4.25rem;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-control {
  inline-size: 8rem;
  block-size: 14rem;
}

.qti3-slider-visual {
  position: absolute;
  inset: 0;
  direction: ltr;
  pointer-events: none;
}

.qti3-slider-track {
  position: absolute;
  scale: 1 1;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-track {
  inset-block-start: calc(var(--qti3-slider-hit-size) / 2);
  inset-inline: calc(
    var(--qti3-slider-inline-padding) + var(--qti3-slider-thumb-size) / 2
  );
  block-size: 0;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-track {
  inset-block: calc(var(--qti3-slider-thumb-size) / 2);
  inset-inline-start: calc(var(--qti3-slider-hit-size) / 2);
  inline-size: 0;
}

.qti3-slider-response[data-orientation="horizontal"][data-reverse="true"] .qti3-slider-track {
  scale: -1 1;
}

.qti3-slider-response[data-orientation="vertical"][data-reverse="false"] .qti3-slider-track {
  scale: 1 -1;
}

.qti3-slider-rail,
.qti3-slider-fill,
.qti3-slider-thumb,
.qti3-slider-tick,
.qti3-slider-tick-mark,
.qti3-slider-tick-label {
  position: absolute;
  box-sizing: border-box;
}

.qti3-slider-rail {
  border: 1px solid light-dark(#667085, #d0d5dd);
  border-radius: 999px;
  background: light-dark(#e4e7ec, #344054);
}

.qti3-slider-fill {
  border-radius: 999px;
  background: Highlight;
}

.qti3-slider-thumb {
  z-index: 3;
  inline-size: var(--qti3-slider-thumb-size);
  block-size: var(--qti3-slider-thumb-size);
  border: 2px solid Canvas;
  border-radius: 50%;
  background: Highlight;
  box-shadow: 0 0 0 2px Highlight;
  translate: -50% -50%;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-rail {
  inset: calc(var(--qti3-slider-track-size) / -2) 0 auto;
  block-size: var(--qti3-slider-track-size);
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-fill {
  inset-block-start: calc(var(--qti3-slider-track-size) / -2);
  inset-inline-start: 0;
  inline-size: var(--qti3-slider-ratio);
  block-size: var(--qti3-slider-track-size);
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-thumb {
  inset-block-start: 0;
  inset-inline-start: var(--qti3-slider-ratio);
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-rail {
  inset: 0 auto 0 calc(var(--qti3-slider-track-size) / -2);
  inline-size: var(--qti3-slider-track-size);
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-fill {
  inset-block-start: 0;
  inset-inline-start: calc(var(--qti3-slider-track-size) / -2);
  inline-size: var(--qti3-slider-track-size);
  block-size: var(--qti3-slider-ratio);
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-thumb {
  inset-block-start: var(--qti3-slider-ratio);
  inset-inline-start: 0;
}

.qti3-slider-response[data-response-state="unset"] :is(.qti3-slider-fill, .qti3-slider-thumb) {
  visibility: hidden;
}

.qti3-slider-input {
  z-index: 4;
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  appearance: none;
  background: transparent;
  opacity: 0;
  cursor: pointer;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-input {
  inset-block: 0 auto;
  inset-inline: var(--qti3-slider-inline-padding);
  block-size: var(--qti3-slider-hit-size);
  direction: ltr;
}

.qti3-slider-response[data-orientation="horizontal"][data-reverse="true"] .qti3-slider-input {
  direction: rtl;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-input {
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: var(--qti3-slider-hit-size);
  block-size: 100%;
  direction: rtl;
  writing-mode: vertical-lr;
}

.qti3-slider-response[data-orientation="vertical"][data-reverse="true"] .qti3-slider-input {
  direction: ltr;
}

.qti3-slider-input::-webkit-slider-runnable-track {
  border: 0;
  background: transparent;
}

.qti3-slider-input::-webkit-slider-thumb {
  inline-size: var(--qti3-slider-thumb-size);
  block-size: var(--qti3-slider-thumb-size);
  border: 0;
  appearance: none;
  background: transparent;
}

.qti3-slider-input::-moz-range-track {
  border: 0;
  background: transparent;
}

.qti3-slider-input::-moz-range-thumb {
  inline-size: var(--qti3-slider-thumb-size);
  block-size: var(--qti3-slider-thumb-size);
  border: 0;
  background: transparent;
}

.qti3-slider-input:disabled {
  cursor: not-allowed;
}

.qti3-slider-control:has(.qti3-slider-input:focus-visible) .qti3-slider-visual {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

.qti3-slider-control:has(.qti3-slider-input:disabled) {
  opacity: 0.65;
}

.qti3-slider-tick {
  z-index: 2;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-tick {
  inset-block-start: 0;
  inset-inline-start: var(--qti3-slider-tick-ratio);
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-tick-mark {
  inset-block-start: -0.375rem;
  inset-inline-start: -0.5px;
  inline-size: 1px;
  block-size: 0.75rem;
  background: CanvasText;
}

.qti3-slider-response[data-orientation="horizontal"] .qti3-slider-tick-label {
  inset-block-start: 0.55rem;
  inset-inline-start: 0;
  translate: -50% 0;
  scale: 1 1;
}

.qti3-slider-response[data-orientation="horizontal"][data-reverse="true"] .qti3-slider-tick-label {
  scale: -1 1;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-tick {
  inset-block-start: var(--qti3-slider-tick-ratio);
  inset-inline-start: 0;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-tick-mark {
  inset-block-start: -0.5px;
  inset-inline-start: -0.375rem;
  inline-size: 0.75rem;
  block-size: 1px;
  background: CanvasText;
}

.qti3-slider-response[data-orientation="vertical"] .qti3-slider-tick-label {
  inset-block-start: 0;
  inset-inline-start: 0.65rem;
  translate: 0 -50%;
  scale: 1 1;
}

.qti3-slider-response[data-orientation="vertical"][data-reverse="false"] .qti3-slider-tick-label {
  scale: 1 -1;
}

.qti3-slider-tick-label {
  color: CanvasText;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.qti3-slider-output {
  min-block-size: 1.45rem;
  margin: 0;
  padding-block: 0.15rem;
  color: CanvasText;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}

.qti3-slider-output[data-response-state="unset"] {
  font-style: italic;
}

@media (max-width: 30rem) {
  .qti3-slider-response[data-orientation="horizontal"] {
    grid-template-columns: minmax(0, 1fr);
  }

  .qti3-slider-response[data-orientation="horizontal"] .qti3-slider-control {
    min-inline-size: 0;
  }
}

@media (forced-colors: active) {
  .qti3-slider-rail {
    border-color: CanvasText;
    background: Canvas;
  }

  .qti3-slider-fill {
    background: Highlight;
  }

  .qti3-slider-thumb {
    border-color: Canvas;
    background: Highlight;
    box-shadow: 0 0 0 2px Highlight;
    forced-color-adjust: none;
  }

  .qti3-slider-tick-mark {
    background: CanvasText;
  }
}
`.trim();
