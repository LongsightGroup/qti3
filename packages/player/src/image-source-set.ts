/** Transform every URL in an HTML image candidate list, preserving density/width descriptors. */
export function mapImageSourceSet(
  value: string,
  mapUrl: (url: string) => string | undefined,
): string | undefined {
  const candidates: string[] = [];
  let remaining = value.trim();
  while (remaining) {
    const urlToken = /^[^\t\n\f\r ]+/.exec(remaining)?.[0];
    if (!urlToken) return undefined;
    remaining = remaining.slice(urlToken.length).trimStart();
    const url = urlToken.replace(/,+$/, "");
    const hasSeparator = url !== urlToken;
    const separator = remaining.indexOf(",");
    const descriptor = hasSeparator
      ? ""
      : (separator < 0 ? remaining : remaining.slice(0, separator)).trim();
    if (!hasSeparator) remaining = separator < 0 ? "" : remaining.slice(separator + 1).trimStart();
    if (descriptor && !/^(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)x)$/.test(descriptor))
      return undefined;
    const mapped = mapUrl(url);
    if (!mapped) return undefined;
    candidates.push(mapped + (descriptor ? ` ${descriptor}` : ""));
  }
  return candidates.length > 0 ? candidates.join(", ") : undefined;
}
