export const EXTENDED_TEXT_XHTML_PLAYER_STYLES = `
.qti3-rich-text-editor {
  inline-size: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  border: 1px solid CanvasText;
  background: Canvas;
  color: CanvasText;
  min-block-size: calc(var(--qti3-extended-text-rows, 6) * 1.5em + 1.1rem);
  overflow: auto;
  line-height: 1.5;
  overflow-wrap: break-word;
}

.qti3-rich-text-editor:focus-visible,
.qti3-rich-text-toolbar-button:focus-visible {
  outline: 3px solid Highlight;
  outline-offset: 2px;
}

.qti3-rich-text-editor > :first-child {
  margin-block-start: 0;
}

.qti3-rich-text-editor > :last-child {
  margin-block-end: 0;
}

.qti3-rich-text-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.qti3-rich-text-toolbar-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.qti3-rich-text-toolbar-group + .qti3-rich-text-toolbar-group {
  border-inline-start: 1px solid CanvasText;
  padding-inline-start: 0.25rem;
  margin-inline-start: 0.25rem;
}

.qti3-rich-text-toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 2.25rem;
  min-block-size: 2.25rem;
  padding: 0.35rem;
  border: 1px solid CanvasText;
  background: ButtonFace;
  color: ButtonText;
  font: inherit;
  cursor: pointer;
}

.qti3-rich-text-toolbar-icon {
  display: block;
  inline-size: 1.125rem;
  block-size: 1.125rem;
}

.qti3-rich-text-toolbar-button:hover {
  background: color-mix(in srgb, ButtonText 12%, ButtonFace);
}
`.trim();
