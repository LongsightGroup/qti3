import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";

export type QtiInteractionRegionKind =
  | "interaction"
  | "choice"
  | "control"
  | "source"
  | "target"
  | "surface"
  | "placement";

export interface QtiInteractionRegion {
  kind: QtiInteractionRegionKind;
  interactionType: string;
  responseIdentifier?: string | undefined;
  choiceIdentifier?: string | undefined;
  label?: string | undefined;
  bounds: DOMRectReadOnly;
  element: Element;
}

interface QtiInteractionRegionMarker {
  kind: QtiInteractionRegionKind;
  interactionType?: string | undefined;
  responseIdentifier?: string | undefined;
  choiceIdentifier?: string | undefined;
}

const regionSelector = "[data-qti-player-region]";

export interface QtiInteractionRegionMarkerFactory {
  interaction(element: Element): void;
  choice(element: Element, choice: QtiChoice | string): void;
  control(element: Element): void;
  source(element: Element, choice: QtiChoice): void;
  target(element: Element, choiceIdentifier?: string): void;
  surface(element: Element): void;
  placement(element: Element, choiceIdentifier?: string): void;
}

export function createQtiInteractionRegionMarkers(
  interaction: QtiInteraction,
  options: { responseIdentifier?: string | undefined } = {},
): QtiInteractionRegionMarkerFactory {
  const responseIdentifier = options.responseIdentifier ?? interaction.responseIdentifier;
  const mark = (
    element: Element,
    kind: QtiInteractionRegionKind,
    markerOptions: {
      choiceIdentifier?: string | undefined;
    } = {},
  ): void => {
    markQtiInteractionRegion(element, {
      kind,
      interactionType: interaction.type,
      responseIdentifier,
      ...markerOptions,
    });
  };
  return {
    interaction: (element) => mark(element, "interaction"),
    choice: (element, choice) =>
      mark(element, "choice", {
        choiceIdentifier: typeof choice === "string" ? choice : choice.identifier,
      }),
    control: (element) => mark(element, "control"),
    source: (element, choice) =>
      mark(element, "source", {
        choiceIdentifier: choice.identifier,
      }),
    target: (element, choiceIdentifier) => mark(element, "target", { choiceIdentifier }),
    surface: (element) => mark(element, "surface"),
    placement: (element, choiceIdentifier) => mark(element, "placement", { choiceIdentifier }),
  };
}

function markQtiInteractionRegion(element: Element, marker: QtiInteractionRegionMarker): void {
  setDataAttribute(element, "data-qti-player-region", "");
  setDataAttribute(element, "data-qti-player-region-kind", marker.kind);
  setOptionalDataAttribute(element, "data-qti-player-interaction-type", marker.interactionType);
  setOptionalDataAttribute(
    element,
    "data-qti-player-response-identifier",
    marker.responseIdentifier,
  );
  setOptionalDataAttribute(element, "data-qti-player-choice-identifier", marker.choiceIdentifier);
}

export function getQtiInteractionRegions(root: ParentNode): QtiInteractionRegion[] {
  return Array.from(root.querySelectorAll<Element>(regionSelector))
    .filter(isVisibleRegionElement)
    .map(regionFromElement)
    .filter((region): region is QtiInteractionRegion => region !== undefined);
}

function regionFromElement(element: Element): QtiInteractionRegion | undefined {
  const kind = regionKind(element.getAttribute("data-qti-player-region-kind"));
  const interactionType = element.getAttribute("data-qti-player-interaction-type") ?? undefined;
  if (!kind || !interactionType) return undefined;
  const responseIdentifier =
    element.getAttribute("data-qti-player-response-identifier") ?? undefined;
  const choiceIdentifier = element.getAttribute("data-qti-player-choice-identifier") ?? undefined;
  const label = regionLabel(element);
  return {
    kind,
    interactionType,
    ...(responseIdentifier ? { responseIdentifier } : {}),
    ...(choiceIdentifier ? { choiceIdentifier } : {}),
    ...(label ? { label } : {}),
    bounds: element.getBoundingClientRect(),
    element,
  };
}

function regionKind(value: string | null): QtiInteractionRegionKind | undefined {
  switch (value) {
    case "interaction":
    case "choice":
    case "control":
    case "source":
    case "target":
    case "surface":
    case "placement":
      return value;
    default:
      return undefined;
  }
}

function regionLabel(element: Element): string | undefined {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const title = element.getAttribute("title");
  if (title) return title;
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function isVisibleRegionElement(element: Element): boolean {
  if (element.closest("[hidden]")) return false;
  const rects = element.getClientRects();
  if (rects.length === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function setDataAttribute(element: Element, name: string, value: string): void {
  element.setAttribute(name, value);
}

function setOptionalDataAttribute(element: Element, name: string, value: string | undefined): void {
  if (value === undefined || value === "") {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value);
}
