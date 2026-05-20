import type {
  QtiElementSupport,
  QtiInteractionElementSupport,
  QtiInteractionType,
  QtiProcessingElementSupport,
} from "./types.js";

export const interactionSupport: QtiInteractionElementSupport[] = [
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

export const deprecatedInteractionSupport: QtiInteractionElementSupport[] = [
  {
    qtiName: "qti-custom-interaction",
    interactionType: "custom",
    category: "interaction",
    support: "deprecated",
    specReference: "QTI 3.0.1 ASI Q-31",
    parse: true,
    validate: false,
    render: false,
    process: false,
    fixtures: [],
    tests: ["packages/core/src/core.test.ts"],
    notes: "Deprecated in favor of qti-portable-custom-interaction.",
  },
];

export const processingSupport: QtiProcessingElementSupport[] = [
  processingEntry("qti-template-processing", "packages/core/src/core.test.ts"),
  processingEntry("qti-response-processing", "packages/core/src/core.test.ts"),
  processingEntry("qti-set-template-value", "packages/core/src/core.test.ts"),
  processingEntry("qti-set-correct-response", "packages/core/src/core.test.ts"),
  processingEntry("qti-response-condition", "packages/core/src/core.test.ts"),
  processingEntry("qti-response-if", "packages/core/src/core.test.ts"),
  processingEntry("qti-response-else-if", "packages/core/src/core.test.ts"),
  processingEntry("qti-response-else", "packages/core/src/core.test.ts"),
  processingEntry("qti-set-outcome-value", "packages/core/src/core.test.ts"),
  processingEntry("qti-base-value", "packages/core/src/core.test.ts"),
  processingEntry("qti-is-null", "packages/core/src/core.test.ts"),
  processingEntry("qti-match", "packages/core/src/core.test.ts"),
  processingEntry("qti-correct", "packages/core/src/core.test.ts"),
  processingEntry("qti-default", "packages/core/src/core.test.ts"),
  processingEntry("qti-map-response", "packages/core/src/core.test.ts"),
  processingEntry("qti-map-response-point", "packages/core/src/core.test.ts"),
  processingEntry("qti-variable", "packages/core/src/core.test.ts"),
  processingEntry("qti-random-integer", "packages/core/src/core.test.ts"),
  processingEntry("qti-random-float", "packages/core/src/core.test.ts"),
  processingEntry("qti-random", "packages/core/src/core.test.ts"),
  processingEntry("qti-multiple", "packages/core/src/core.test.ts"),
  processingEntry("qti-ordered", "packages/core/src/core.test.ts"),
  processingEntry("qti-index", "packages/core/src/core.test.ts"),
  processingEntry("qti-contains", "packages/core/src/core.test.ts"),
  processingEntry("qti-sum", "packages/core/src/core.test.ts"),
  processingEntry("qti-product", "packages/core/src/core.test.ts"),
  processingEntry("qti-min", "packages/core/src/core.test.ts"),
  processingEntry("qti-max", "packages/core/src/core.test.ts"),
  processingEntry("qti-subtract", "packages/core/src/core.test.ts"),
  processingEntry("qti-divide", "packages/core/src/core.test.ts"),
  processingEntry("qti-power", "packages/core/src/core.test.ts"),
  processingEntry("qti-integer-divide", "packages/core/src/core.test.ts"),
  processingEntry("qti-integer-modulus", "packages/core/src/core.test.ts"),
  processingEntry("qti-round", "packages/core/src/core.test.ts"),
  processingEntry("qti-round-to", "packages/core/src/core.test.ts"),
  processingEntry("qti-truncate", "packages/core/src/core.test.ts"),
  processingEntry("qti-integer-to-float", "packages/core/src/core.test.ts"),
  processingEntry("qti-and", "packages/core/src/core.test.ts"),
  processingEntry("qti-or", "packages/core/src/core.test.ts"),
  processingEntry("qti-not", "packages/core/src/core.test.ts"),
  processingEntry("qti-equal", "packages/core/src/core.test.ts"),
  processingEntry("qti-lt", "packages/core/src/core.test.ts"),
  processingEntry("qti-lte", "packages/core/src/core.test.ts"),
  processingEntry("qti-gt", "packages/core/src/core.test.ts"),
  processingEntry("qti-gte", "packages/core/src/core.test.ts"),
  processingEntry("qti-string-match", "packages/core/src/core.test.ts"),
  processingEntry("qti-substring", "packages/core/src/core.test.ts"),
  processingEntry("qti-member", "packages/core/src/core.test.ts"),
];

export const elementSupport: QtiElementSupport[] = [
  ...interactionSupport,
  ...deprecatedInteractionSupport,
  ...processingSupport,
];

const allInteractionSupport = [...interactionSupport, ...deprecatedInteractionSupport];

export const interactionNameToType = new Map<string, QtiInteractionType>(
  allInteractionSupport.map((item) => [item.qtiName, item.interactionType]),
);

export function getInteractionSupport(qtiName: string): QtiElementSupport | undefined {
  return allInteractionSupport.find((item) => item.qtiName === qtiName);
}

function entry(qtiName: string, interactionType: QtiInteractionType): QtiInteractionElementSupport {
  return {
    qtiName,
    interactionType,
    category: "interaction",
    support: "supported",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: true,
    process: true,
    fixtures: [`packages/fixtures/xml/${interactionType}-reference.xml`],
    tests: [
      "packages/fixtures/src/fixtures.test.ts",
      "packages/conformance/src/conformance.test.ts",
      "packages/a11y/src/a11y.test.ts",
      "tests/browser/player.spec.ts",
    ],
  };
}

function processingEntry(qtiName: string, test: string): QtiProcessingElementSupport {
  return {
    qtiName,
    category: "processing",
    support: "supported",
    specReference: "QTI 3.0.1 ASI processing",
    parse: true,
    validate: true,
    render: false,
    process: true,
    fixtures: [],
    tests: [test],
  };
}
