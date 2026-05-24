export type IconPath = string | { d: string; fill?: string; stroke?: string };

export function inlineIcon(className: string, paths: IconPath[]): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", className);

  for (const entry of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (typeof entry === "string") {
      path.setAttribute("d", entry);
    } else {
      path.setAttribute("d", entry.d);
      if (entry.stroke) {
        path.setAttribute("stroke", entry.stroke);
        path.style.stroke = entry.stroke;
      }
      if (entry.fill) {
        path.setAttribute("fill", entry.fill);
        path.style.fill = entry.fill;
      }
    }
    svg.append(path);
  }
  return svg;
}

export function trashIcon(): SVGSVGElement {
  return inlineIcon("qti3-trash-icon", [
    { d: "M0 0h24v24H0z", stroke: "none", fill: "none" },
    "M4 7l16 0",
    "M10 11l0 6",
    "M14 11l0 6",
    "M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12",
    "M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3",
  ]);
}
