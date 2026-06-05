export function mergeTokenAttribute(element: HTMLElement, name: string, token: string): void {
  const tokens = new Set((element.getAttribute(name) ?? "").split(/\s+/).filter(Boolean));
  tokens.add(token);
  element.setAttribute(name, [...tokens].join(" "));
}

export function removeTokenAttribute(element: HTMLElement, name: string, token: string): void {
  const tokens = (element.getAttribute(name) ?? "")
    .split(/\s+/)
    .filter((item) => item && item !== token);
  if (tokens.length > 0) {
    element.setAttribute(name, tokens.join(" "));
  } else {
    element.removeAttribute(name);
  }
}
