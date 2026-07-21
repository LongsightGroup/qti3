export const BASE_PLAYER_STYLES = `
.qti3-embedded-interaction-unsupported {
  color: CanvasText;
}

.qti3-portable-custom-host {
  border: 1px solid CanvasText;
  padding: 0.5rem;
  margin-block-end: 0.5rem;
}

.qti3-player {
  --qti3-match-accent: #2f6fca;
  --qti3-match-target-bg: #f5f6f7;
  --qti3-match-target-border: #6f7782;

  display: grid;
  gap: 1rem;
  max-inline-size: 72rem;
  font: 16px/1.45 system-ui, sans-serif;
}

@supports (color: light-dark(#000, #fff)) {
  .qti3-player {
    --qti3-match-accent: light-dark(#2f6fca, #8ab4f8);
    --qti3-match-target-bg: light-dark(#f5f6f7, #202124);
    --qti3-match-target-border: light-dark(#6f7782, #9aa0a6);
  }
}

.qti3-interaction {
  display: grid;
  gap: 0.75rem;
  min-inline-size: 0;
  max-inline-size: 100%;
}

.qti3-item-body {
  display: block;
}

.qti3-catalog-request {
  display: inline-flex;
  align-items: center;
  min-block-size: 2.75rem;
  margin-inline: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid currentColor;
  border-radius: 0.25rem;
  background: Canvas;
  color: CanvasText;
  cursor: pointer;
}

.qti3-catalog-request:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.qti3-item-body > * {
  margin-block: 0 1rem;
}

.qti3-item-body > :last-child {
  margin-block-end: 0;
}

.qti3-item-body :where(p, ul, ol, dl, blockquote, figure, table, pre) {
  margin-block-start: 0;
  margin-block-end: 1rem;
  font-size: inherit;
  line-height: inherit;
}

.qti3-item-body :where(h1, h2, h3, h4, h5, h6) {
  margin-block-start: 0;
  margin-block-end: 1rem;
  line-height: 1.2;
  text-wrap: balance;
}

.qti3-player .qti-hidden {
  display: none !important;
}

.qti3-player .qti3-validation-message[hidden] {
  display: none !important;
}

.qti3-player .qti3-validation-message {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  max-inline-size: min(100%, 42rem);
  margin: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid #b42318;
  border-inline-start-width: 4px;
  border-radius: 0.375rem;
  background: #fff3f0;
  color: #7a271a;
  font-weight: 650;
}

.qti3-player .qti3-validation-message::before {
  content: "!";
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  margin-block-start: 0.05rem;
  border-radius: 999px;
  background: #b42318;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1;
}

.qti3-player .qti3-validation-message-inline {
  display: inline-flex;
  max-inline-size: 24rem;
  margin-inline: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-inline-start-width: 3px;
  vertical-align: baseline;
  font-size: 0.9375rem;
}

.qti3-player .qti3-validation-message-inline::before {
  inline-size: 1rem;
  block-size: 1rem;
  font-size: 0.75rem;
}

@supports (color: light-dark(#000, #fff)) {
  .qti3-player .qti3-validation-message {
    border-color: light-dark(#b42318, #ffb4a8);
    background: light-dark(#fff3f0, #3a1410);
    color: light-dark(#7a271a, #ffd8d2);
  }

  .qti3-player .qti3-validation-message::before {
    background: light-dark(#b42318, #ffb4a8);
    color: light-dark(#fff, #2b0b07);
  }
}

@media (forced-colors: active) {
  .qti3-player .qti3-validation-message {
    border-color: Highlight;
    background: Canvas;
    color: CanvasText;
  }

  .qti3-player .qti3-validation-message::before {
    border: 1px solid CanvasText;
    background: CanvasText;
    color: Canvas;
  }
}

.qti3-player .qti-visually-hidden,
.qti3-player .qti3-selection-summary,
.qti3-player .qti3-coordinate-output {
  position: absolute !important;
  overflow: hidden !important;
  clip: rect(1px, 1px, 1px, 1px) !important;
  clip-path: inset(50%) !important;
  inline-size: 1px !important;
  block-size: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  border: 0 !important;
  white-space: nowrap !important;
}

qti-assessment-item-player[data-show-live-regions] .qti3-selection-summary,
qti-assessment-item-player[data-show-live-regions] .qti3-coordinate-output {
  position: static !important;
  overflow: visible !important;
  clip: auto !important;
  clip-path: none !important;
  inline-size: auto !important;
  block-size: auto !important;
  margin: 0 0 0.5rem !important;
  padding: 0 !important;
  border: 0 !important;
  white-space: normal !important;
  font-size: 0.875rem;
  color: light-dark(#5f6368, #bdc1c6);
  font-style: italic;
}

.qti3-embedded-interaction {
  display: inline-flex;
  gap: 0.35rem;
  margin-inline: 0.18rem;
  align-items: baseline;
  vertical-align: baseline;
}

.qti3-inline-text-input {
  inline-size: auto;
  min-inline-size: 8ch;
  max-inline-size: 18ch;
  margin-inline: 0.25rem;
}

.qti3-printed-variable {
  font-weight: 700;
}

.qti3-feedback-block {
  padding: 0.75rem;
  border-inline-start: 4px solid Highlight;
  background: Canvas;
  color: CanvasText;
}

.qti3-feedback {
  margin-block-start: 1rem;
  padding: 0.75rem 1rem;
  border-inline-start: 4px solid Highlight;
  background: light-dark(#f8fafc, #1f2937);
  color: CanvasText;
}

.qti3-feedback > :last-child {
  margin-block-end: 0;
}

.qti3-response-group {
  min-inline-size: 0;
}

.qti3-response-group > * + * {
  margin-block-start: 0.75rem;
}

.qti3-token:focus,
.qti3-hotspot-button:focus,
.qti3-player button:focus-visible,
.qti3-player select:focus-visible,
.qti3-player input:focus-visible,
.qti3-player textarea:focus-visible {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .qti3-player * {
    scroll-behavior: auto;
  }
}
`.trim();
