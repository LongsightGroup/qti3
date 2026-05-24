export const MATCH_PAIR_PLAYER_STYLES = `
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
`.trim();
