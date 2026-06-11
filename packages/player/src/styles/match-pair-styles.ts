export const MATCH_PAIR_PLAYER_STYLES = `
.qti3-pair-selector {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  align-items: start;
}

.qti3-match-selector {
  container-type: inline-size;
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

.qti3-match-table {
  --qti3-match-table-source-column-width: clamp(8rem, 24%, 14rem);
  inline-size: 100%;
  max-inline-size: 72rem;
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid CanvasText;
}

.qti3-match-table th:first-child {
  inline-size: var(--qti3-match-table-source-column-width);
}

.qti3-match-table th,
.qti3-match-table td {
  padding: 0.45rem;
  border: 1px solid CanvasText;
  text-align: center;
  vertical-align: middle;
}

.qti3-match-table th {
  background: ButtonFace;
  color: ButtonText;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.qti3-match-table tbody th {
  text-align: start;
}

.qti3-match-table-cell {
  display: inline-grid;
  place-items: center;
  inline-size: 100%;
  min-block-size: 2.5rem;
  padding: 0.35rem;
  cursor: pointer;
}

.qti3-match-table-check-icon {
  inline-size: 1.35rem;
  block-size: 1.35rem;
  color: currentColor;
}

.qti3-match-table-check-box {
  fill: Canvas;
  stroke: currentColor;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.qti3-match-table-check-mark {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  vector-effect: non-scaling-stroke;
}

.qti3-match-table-cell[aria-pressed="true"] .qti3-match-table-check-box {
  fill: Highlight;
  stroke: Highlight;
}

.qti3-match-table-cell[aria-pressed="true"] .qti3-match-table-check-mark {
  color: HighlightText;
  opacity: 1;
}

@media (forced-colors: active) {
  .qti3-match-table,
  .qti3-match-table th,
  .qti3-match-table td {
    border-color: CanvasText;
  }

  .qti3-match-table th {
    background: ButtonFace;
    color: ButtonText;
  }
}
`.trim();
