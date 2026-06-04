export const GAP_MATCH_PLAYER_STYLES = `
.qti3-gap-match-layout,
.qti3-graphic-gap-layout {
  container-type: inline-size;
  max-inline-size: 100%;
}

.qti3-gap-region {
  margin-block-start: 0.5rem;
}

.qti3-gapMatch:not(.qti-gap-placement) .qti3-gap-region:not(.qti3-gap-passage) .qti3-gap-target {
  min-block-size: 2.75rem;
  padding: 0.5rem;
  border: 1px dashed CanvasText;
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

.qti3-gapMatch.qti-gap-placement .qti3-gap-region:not(.qti3-gap-passage) {
  display: block;
  line-height: 2.3;
  max-inline-size: 62rem;
}

.qti3-gapMatch.qti-gap-placement .qti3-gap-region:not(.qti3-gap-passage) .qti3-gap-target {
  display: inline-flex;
  padding: 0;
  border: 0;
  margin-inline: 0.15rem;
  margin-block: 0.2rem;
  vertical-align: baseline;
}

.qti3-gapMatch.qti-gap-placement .qti3-gap-passage .qti3-gap-button,
.qti3-gapMatch.qti-gap-placement .qti3-gap-region:not(.qti3-gap-passage) .qti3-gap-button {
  border: 0;
  border-block-end: 2px solid CanvasText;
  border-radius: 0;
  background: transparent;
  min-block-size: 1.75rem;
  padding-inline: 0.15em;
  min-inline-size: var(--qti3-gap-input-width, 6ch);
  text-align: start;
}

/* Custom widths use ch (character boxes); default fallback uses rem for un-sized gaps. */
.qti3-gap-button {
  min-inline-size: var(--qti3-gap-input-width, 8rem);
  min-block-size: 2.25rem;
  text-align: start;
}

.qti3-gap-source-region.qti3-choices-bank,
.qti3-graphic-gap-source-region.qti3-choices-bank {
  align-content: start;
}
`.trim();
