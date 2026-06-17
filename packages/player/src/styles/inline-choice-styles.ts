export const INLINE_CHOICE_PLAYER_STYLES = `
.qti3-inline-choice-control[data-qti-input-width] {
  inline-size: var(--qti3-input-width);
  min-inline-size: var(--qti3-input-width);
  max-inline-size: 100%;
}

.qti3-inline-choice-control {
  position: relative;
  display: inline-grid;
  vertical-align: baseline;
  min-inline-size: 8rem;
  max-inline-size: min(100%, 34rem);
}

.qti3-inline-choice-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  inline-size: 100%;
  min-block-size: 2rem;
  box-sizing: border-box;
  padding: 0.25rem 0.55rem;
  border: 1px solid CanvasText;
  border-radius: 0.25rem;
  background: Canvas;
  color: CanvasText;
  text-align: start;
  cursor: pointer;
}

.qti3-inline-choice-trigger::after {
  content: "";
  flex: 0 0 auto;
  inline-size: 0.45rem;
  block-size: 0.45rem;
  border-inline-end: 1px solid currentColor;
  border-block-end: 1px solid currentColor;
  transform: rotate(45deg) translateY(-0.1rem);
}

.qti3-inline-choice-trigger[aria-expanded="true"]::after {
  transform: rotate(225deg) translateY(-0.1rem);
}

.qti3-inline-choice-trigger:focus-visible,
.qti3-inline-choice-option:focus-visible {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

.qti3-inline-choice-selected {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.qti3-inline-choice-selected,
.qti3-inline-choice-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.qti3-inline-choice-listbox {
  position: absolute;
  z-index: 20;
  inset-block-start: calc(100% + 0.2rem);
  inset-inline-start: 0;
  display: grid;
  gap: 0.15rem;
  inline-size: max(100%, max-content);
  min-inline-size: 100%;
  max-inline-size: min(32rem, 90vw);
  max-block-size: min(20rem, 60vh);
  overflow: auto;
  box-sizing: border-box;
  padding: 0.25rem;
  border: 1px solid CanvasText;
  border-radius: 0.25rem;
  background: Canvas;
  color: CanvasText;
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.18);
}

.qti3-inline-choice-listbox[hidden] {
  display: none;
}

.qti3-inline-choice-option {
  min-block-size: 2rem;
  box-sizing: border-box;
  padding: 0.35rem 0.5rem;
  border-radius: 0.2rem;
  color: CanvasText;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.qti3-inline-choice-option:hover,
.qti3-inline-choice-option:focus-visible {
  background: color-mix(in srgb, Highlight 14%, Canvas);
}

.qti3-inline-choice-option[data-selected="true"] {
  background: Highlight;
  color: HighlightText;
}

.qti3-inline-choice-option img,
.qti3-inline-choice-selected img {
  max-inline-size: min(12rem, 100%);
  max-block-size: 8rem;
  object-fit: contain;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-rl .qti3-inline-choice-control,
.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-choice-control {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  inline-size: max-content;
  min-inline-size: max-content;
  max-inline-size: 34rem;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-choice-control {
  writing-mode: vertical-lr;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-rl .qti3-inline-choice-trigger,
.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-choice-trigger {
  inline-size: max-content;
  min-inline-size: max-content;
  block-size: 100%;
}

.qti3-inlineChoice.qti-writing-orientation-vertical-rl .qti3-inline-choice-listbox,
.qti3-inlineChoice.qti-writing-orientation-vertical-lr .qti3-inline-choice-listbox {
  inset-block-start: auto;
  inset-inline-start: auto;
  top: 0;
  left: calc(100% + 0.2rem);
}

.qti3-inlineChoice.qti-writing-orientation-vertical-rl
  .qti3-inline-choice-control[data-qti-input-width],
.qti3-inlineChoice.qti-writing-orientation-vertical-lr
  .qti3-inline-choice-control[data-qti-input-width] {
  block-size: var(--qti3-input-width);
  min-block-size: var(--qti3-input-width);
  max-block-size: min(100%, 34rem);
}
`.trim();
