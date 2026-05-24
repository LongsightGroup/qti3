export const CHOICE_HOTTEXT_PLAYER_STYLES = `
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
`.trim();
