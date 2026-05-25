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
  display: grid;
  gap: 1rem;
}

.qti3-item-body > * {
  margin-block: 0;
}

.qti3-player .qti-hidden {
  display: none !important;
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
