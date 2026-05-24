export const PLAYER_STYLES = `    .qti3-player {
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

    .qti3-player .qti-visually-hidden {
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

    .qti3-pair-selector {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      align-items: start;
    }

    .qti3-match-selector {
      display: grid;
      gap: 1.5rem;
      inline-size: 100%;
      max-inline-size: 72rem;
      box-sizing: border-box;
    }

    .qti3-match-source-bank,
    .qti3-match-target-bank {
      align-items: stretch;
    }

    .qti3-token.qti3-match-source {
      border-color: var(--qti3-match-accent);
      background: Canvas;
      color: var(--qti3-match-accent);
    }

    .qti3-token.qti3-match-target {
      flex: 1 1 9rem;
      min-inline-size: 0;
      max-inline-size: 100%;
      min-block-size: 5rem;
      box-sizing: border-box;
      border-color: var(--qti3-match-target-border);
      background: var(--qti3-match-target-bg);
      color: CanvasText;
      font-weight: 700;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: center;
    }

    @media (forced-colors: active) {
      .qti3-token.qti3-match-source {
        border-color: LinkText;
        color: LinkText;
      }

      .qti3-token.qti3-match-target {
        border-color: GrayText;
        background: ButtonFace;
        color: ButtonText;
      }
    }

    .qti3-region-label {
      flex-basis: 100%;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .qti3-choice-list {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: minmax(0, 42rem);
    }

    .qti3-choice-option {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 0.65rem;
      align-items: center;
      justify-content: start;
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 2.75rem;
      padding: 0.65rem 0.8rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
      cursor: pointer;
    }

    .qti3-choice-option input {
      margin: 0;
      inline-size: 1rem;
      block-size: 1rem;
    }

    .qti3-choice-label {
      min-inline-size: 1.75rem;
      font-weight: 700;
    }

    .qti3-choice-text {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }

    .qti3-choice-option[data-selected="true"] {
      background: Highlight;
      color: HighlightText;
    }

    .qti3-hottext-group {
      max-inline-size: 58rem;
    }

    .qti3-hottext-passage {
      margin-block: 0;
      font-size: 1.05rem;
      line-height: 1.75;
    }

    .qti3-hottext-token {
      display: inline;
      margin-inline: 0.1rem;
      padding: 0.12rem 0.28rem;
      border: 1px solid CanvasText;
      border-radius: 0.2rem;
      background: Canvas;
      color: LinkText;
      font: inherit;
      text-decoration: underline;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.16em;
      cursor: pointer;
    }

    .qti3-hottext-token[data-selected="true"] {
      background: Highlight;
      color: HighlightText;
      text-decoration-color: HighlightText;
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
      min-inline-size: 2.5rem;
      padding: 0.35rem 0.65rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
      cursor: grab;
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

    .qti3-gap-target {
      min-block-size: 2.75rem;
      padding: 0.5rem;
      border: 1px dashed CanvasText;
    }

    .qti3-gap-region {
      margin-block-start: 0.5rem;
    }

    .qti3-gap-passage {
      display: block;
      max-inline-size: 62rem;
      line-height: 2.3;
    }

    .qti3-gap-passage .qti3-gap-target {
      display: inline-flex;
      padding: 0;
      border: 0;
      margin-inline: 0.15rem;
      margin-block: 0.2rem;
      vertical-align: middle;
    }

    .qti3-gap-button {
      min-inline-size: 8rem;
      min-block-size: 2.25rem;
      text-align: start;
    }

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

    .qti3-point-controls,
    .qti3-drawing-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
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

    .qti3-coordinate-output {
      display: block;
      margin-block-start: 0.4rem;
      font-size: 0.9rem;
    }

    .qti3-hotspot-button[data-selected="true"] {
      background: Highlight !important;
      color: HighlightText !important;
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }

    .qti3-hotspot-button {
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

    .qti3-hotspot.qti-selections-light .qti3-hotspot-button {
      border-color: white;
      color: white;
      background: rgb(0 0 0 / 0.45);
    }

    .qti3-hotspot.qti-selections-dark .qti3-hotspot-button {
      border-color: black;
      color: black;
      background: rgb(255 255 255 / 0.65);
    }

    .qti3-hotspot.qti-unselected-hidden
      .qti3-hotspot-button:not([data-selected="true"]):not(:focus):not(:focus-visible) {
      opacity: 0;
    }

    @supports not (background: color-mix(in srgb, Canvas 65%, transparent)) {
      .qti3-hotspot-button {
        background: Canvas;
      }
    }

    @media (forced-colors: active) {
      .qti3-hotspot.qti-selections-light .qti3-hotspot-button,
      .qti3-hotspot.qti-selections-dark .qti3-hotspot-button {
        border-color: CanvasText;
        color: CanvasText;
        background: Canvas;
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
      z-index: 2;
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
      inset-block-start: calc(100% + 0.2rem);
      inset-inline-start: 50%;
      transform: translateX(-50%);
      box-sizing: border-box;
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
      pointer-events: none;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.16);
      text-align: center;
      white-space: normal;
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

    .qti3-graphic-order-item {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }

    .qti3-selection-summary {
      margin: 0;
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
    }` as const;

export function playerStyleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = PLAYER_STYLES;
  return style;
}
