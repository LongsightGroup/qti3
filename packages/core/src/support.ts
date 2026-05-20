import type { QtiElementSupport, QtiInteractionType } from "./types.js";

export const interactionSupport: QtiElementSupport[] = [
  entry("qti-associate-interaction", "associate"),
  entry("qti-choice-interaction", "choice"),
  entry("qti-drawing-interaction", "drawing"),
  entry("qti-end-attempt-interaction", "endAttempt"),
  entry("qti-extended-text-interaction", "extendedText"),
  entry("qti-gap-match-interaction", "gapMatch"),
  entry("qti-graphic-associate-interaction", "graphicAssociate"),
  entry("qti-graphic-gap-match-interaction", "graphicGapMatch"),
  entry("qti-graphic-order-interaction", "graphicOrder"),
  entry("qti-hotspot-interaction", "hotspot"),
  entry("qti-hottext-interaction", "hottext"),
  entry("qti-inline-choice-interaction", "inlineChoice"),
  entry("qti-match-interaction", "match"),
  entry("qti-media-interaction", "media"),
  entry("qti-order-interaction", "order"),
  entry("qti-position-object-interaction", "positionObject"),
  entry("qti-portable-custom-interaction", "portableCustom"),
  entry("qti-select-point-interaction", "selectPoint"),
  entry("qti-slider-interaction", "slider"),
  entry("qti-text-entry-interaction", "textEntry"),
  entry("qti-upload-interaction", "upload"),
];

export const deprecatedInteractionSupport: QtiElementSupport[] = [
  {
    qtiName: "qti-custom-interaction",
    interactionType: "custom",
    category: "interaction",
    support: "deprecated",
    specReference: "QTI 3.0.1 ASI Q-31",
    notes: "Deprecated in favor of qti-portable-custom-interaction.",
  },
];

const allInteractionSupport = [...interactionSupport, ...deprecatedInteractionSupport];

export const interactionNameToType = new Map<string, QtiInteractionType>(
  allInteractionSupport.map((item) => [item.qtiName, item.interactionType]),
);

export function getInteractionSupport(qtiName: string): QtiElementSupport | undefined {
  return allInteractionSupport.find((item) => item.qtiName === qtiName);
}

function entry(qtiName: string, interactionType: QtiInteractionType): QtiElementSupport {
  return {
    qtiName,
    interactionType,
    category: "interaction",
    support: "supported",
    specReference: "QTI 3.0.1 ASI",
  };
}
