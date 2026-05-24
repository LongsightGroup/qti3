export function appendInlineControl(
  content: Array<Node | string>,
  control: HTMLElement,
  nextSegment: { kind: string; text?: string } | undefined,
): void {
  const previous = content.at(-1);
  if (previous instanceof Text && !/\s$/.test(previous.data)) {
    content.push(document.createTextNode(" "));
  }
  content.push(control);

  const nextText =
    nextSegment?.kind === "text" ? normalizeInlineSegmentText(nextSegment.text) : undefined;
  if (nextText && !/^\s|^[,.;:!?]/.test(nextText)) {
    content.push(document.createTextNode(" "));
  }
}

export function normalizeInlineSegmentText(value: string | undefined): string {
  return (value ?? "").replace(/\s+([,.;:!?])/g, "$1");
}
