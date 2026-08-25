import type {
  QtiDiagnostic,
  QtiElementSupport,
  QtiInteractionElementSupport,
  QtiInteractionRegistryStatus,
  QtiInteractionType,
  QtiItemMetadataElementSupport,
  QtiProcessingElementSupport,
  QtiSourceLocation,
} from "./types.js";
import {
  browserFeedbackTests,
  browserHarnessTests,
  coreIntegrationTest,
  interactionSupportFixtures,
  interactionSupportTests,
  processingBrowserEvidence,
  processingMappingTest,
  processingOperatorsTest,
  processingResponseTest,
  processingTemplateTest,
} from "./support-evidence.js";

export const interactionSupport: QtiInteractionElementSupport[] = [
  entry("qti-associate-interaction", "associate"),
  entry("qti-choice-interaction", "choice"),
  entry("qti-drawing-interaction", "drawing"),
  entry("qti-end-attempt-interaction", "endAttempt"),
  extendedTextInteractionEntry(),
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
  pciEntry(),
  entry("qti-select-point-interaction", "selectPoint"),
  entry("qti-slider-interaction", "slider"),
  textEntryInteractionEntry(),
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
    tests: [coreIntegrationTest],
    notes: "Deprecated in favor of qti-portable-custom-interaction.",
  },
];

const templateProcessingEntry = processingEntryFor(processingTemplateTest);
const responseProcessingEntry = processingEntryFor(processingResponseTest);
const mappingProcessingEntry = processingEntryFor(processingMappingTest);
const operatorProcessingEntry = processingEntryFor(processingOperatorsTest);

export const processingSupport: QtiProcessingElementSupport[] = [
  templateProcessingEntry(
    "qti-template-processing",
    [
      "packages/fixtures/xml/template-processing-reference.xml",
      "packages/fixtures/xml/random-integer-template-reference.xml",
      "packages/fixtures/xml/template-content-reference.xml",
    ],
    [...processingBrowserEvidence["qti-template-processing"]],
  ),
  responseProcessingEntry(
    "qti-response-processing",
    [
      "packages/fixtures/xml/mapping-processing-reference.xml",
      "packages/fixtures/xml/generic-match-processing-reference.xml",
      "packages/fixtures/xml/advanced-processing-reference.xml",
      "packages/fixtures/xml/adaptive-feedback-reference.xml",
    ],
    [...processingBrowserEvidence["qti-response-processing"]],
  ),
  templateProcessingEntry("qti-set-template-value", [
    "packages/fixtures/xml/template-processing-reference.xml",
    "packages/fixtures/xml/random-integer-template-reference.xml",
    "packages/fixtures/xml/template-content-reference.xml",
  ]),
  templateProcessingEntry("qti-set-default-value"),
  templateProcessingEntry("qti-set-correct-response", [
    "packages/fixtures/xml/template-processing-reference.xml",
    "packages/fixtures/xml/random-integer-template-reference.xml",
  ]),
  templateProcessingEntry("qti-template-condition"),
  templateProcessingEntry("qti-template-if"),
  templateProcessingEntry("qti-template-else-if"),
  templateProcessingEntry("qti-template-else"),
  templateProcessingEntry("qti-template-constraint"),
  responseProcessingEntry("qti-response-condition", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
    "packages/fixtures/xml/adaptive-feedback-reference.xml",
  ]),
  responseProcessingEntry("qti-response-if", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
    "packages/fixtures/xml/adaptive-feedback-reference.xml",
  ]),
  responseProcessingEntry("qti-response-else-if"),
  responseProcessingEntry("qti-response-else", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
  ]),
  responseProcessingEntry("qti-set-outcome-value", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
    "packages/fixtures/xml/adaptive-feedback-reference.xml",
  ]),
  mappingProcessingEntry("qti-lookup-outcome-value"),
  responseProcessingEntry("qti-exit-response"),
  templateProcessingEntry("qti-exit-template"),
  responseProcessingEntry("qti-response-processing-fragment"),
  operatorProcessingEntry("qti-base-value", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/template-processing-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-null"),
  mappingProcessingEntry("qti-match-table"),
  mappingProcessingEntry("qti-match-table-entry"),
  mappingProcessingEntry("qti-interpolation-table"),
  mappingProcessingEntry("qti-interpolation-table-entry"),
  operatorProcessingEntry("qti-is-null"),
  mappingProcessingEntry("qti-match", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  mappingProcessingEntry("qti-correct"),
  mappingProcessingEntry("qti-default"),
  mappingProcessingEntry("qti-map-response"),
  mappingProcessingEntry("qti-map-response-point"),
  responseProcessingEntry("qti-variable", [
    "packages/fixtures/xml/generic-match-processing-reference.xml",
    "packages/fixtures/xml/template-processing-reference.xml",
    "packages/fixtures/xml/random-integer-template-reference.xml",
    "packages/fixtures/xml/template-content-reference.xml",
    "packages/fixtures/xml/advanced-processing-reference.xml",
    "packages/fixtures/xml/adaptive-feedback-reference.xml",
  ]),
  templateProcessingEntry(
    "qti-random-integer",
    ["packages/fixtures/xml/random-integer-template-reference.xml"],
    [...processingBrowserEvidence["qti-random-integer"]],
  ),
  operatorProcessingEntry("qti-random-float"),
  operatorProcessingEntry("qti-random"),
  operatorProcessingEntry("qti-multiple", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-ordered", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-index"),
  operatorProcessingEntry("qti-contains"),
  operatorProcessingEntry("qti-container-size", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-sum", [
    "packages/fixtures/xml/template-processing-reference.xml",
    "packages/fixtures/xml/random-integer-template-reference.xml",
  ]),
  operatorProcessingEntry("qti-product", [
    "packages/fixtures/xml/random-integer-template-reference.xml",
  ]),
  operatorProcessingEntry("qti-min"),
  operatorProcessingEntry("qti-max"),
  operatorProcessingEntry("qti-subtract"),
  operatorProcessingEntry("qti-divide"),
  operatorProcessingEntry("qti-power"),
  operatorProcessingEntry("qti-integer-divide"),
  operatorProcessingEntry("qti-integer-modulus"),
  operatorProcessingEntry("qti-round"),
  operatorProcessingEntry("qti-round-to"),
  operatorProcessingEntry("qti-truncate"),
  operatorProcessingEntry("qti-integer-to-float"),
  operatorProcessingEntry("qti-and"),
  operatorProcessingEntry("qti-any-n"),
  operatorProcessingEntry("qti-or"),
  operatorProcessingEntry("qti-not"),
  operatorProcessingEntry("qti-equal"),
  operatorProcessingEntry("qti-equal-rounded", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  mappingProcessingEntry("qti-field-value"),
  operatorProcessingEntry("qti-lt"),
  operatorProcessingEntry("qti-lte"),
  operatorProcessingEntry("qti-gt"),
  operatorProcessingEntry("qti-gte"),
  operatorProcessingEntry("qti-string-match"),
  operatorProcessingEntry("qti-substring"),
  operatorProcessingEntry("qti-pattern-match"),
  operatorProcessingEntry("qti-member"),
  operatorProcessingEntry("qti-delete"),
  operatorProcessingEntry("qti-duration-gte"),
  operatorProcessingEntry("qti-duration-lt"),
  operatorProcessingEntry("qti-gcd", ["packages/fixtures/xml/advanced-processing-reference.xml"]),
  mappingProcessingEntry("qti-inside", ["packages/fixtures/xml/advanced-processing-reference.xml"]),
  operatorProcessingEntry("qti-lcm", ["packages/fixtures/xml/advanced-processing-reference.xml"]),
  operatorProcessingEntry("qti-math-constant"),
  operatorProcessingEntry("qti-math-operator"),
  operatorProcessingEntry("qti-repeat", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-stats-operator", [
    "packages/fixtures/xml/advanced-processing-reference.xml",
  ]),
  operatorProcessingEntry("qti-custom-operator"),
];

export const itemMetadataSupport: QtiItemMetadataElementSupport[] = [
  {
    qtiName: "qti-catalog-info",
    category: "itemMetadata",
    support: "parsed",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: false,
    process: false,
    fixtures: [
      "packages/fixtures/packages/basic-item-player/valid-item-only/items/tolerance-extra-features.xml",
    ],
    tests: ["packages/core/src/parser-item-metadata.test.ts", ...browserHarnessTests],
    notes:
      "Parsed by parser-item-metadata.ts and validated by validateCatalogInfo. Duplicate containers emit item.child.duplicate. Manual harness debugger coverage is in player-harness.spec.ts.",
  },
  {
    qtiName: "qti-stylesheet",
    category: "itemMetadata",
    support: "rendered",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: true,
    process: false,
    fixtures: [
      "packages/fixtures/packages/basic-item-player/valid-item-only/items/tolerance-extra-features.xml",
    ],
    tests: [
      "packages/core/src/parser-item-metadata.test.ts",
      "tests/browser/player-package.spec.ts",
      ...browserHarnessTests,
    ],
    notes:
      "Parsed by parser-item-metadata.ts, validated by validateStylesheets, and delivered by the player only when a host resolveStylesheet hook returns a safe resolved stylesheet URL.",
  },
  {
    qtiName: "qti-modal-feedback",
    category: "itemMetadata",
    support: "rendered",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: true,
    process: true,
    fixtures: ["packages/fixtures/src/index.ts"],
    tests: [
      processingResponseTest,
      "packages/core/src/parser-item-metadata.test.ts",
      ...browserFeedbackTests,
    ],
    notes:
      "Parsed by parser-item-metadata.ts and validated by validateModalFeedback. Response processing supplies the outcome value used for visibility, and the player renders the matching feedback in player-feedback.spec.ts.",
  },
  {
    qtiName: "qti-companion-materials-info",
    category: "itemMetadata",
    support: "parsed",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: false,
    process: false,
    fixtures: [
      "packages/fixtures/packages/basic-item-player/valid-item-only/items/tolerance-extra-features.xml",
    ],
    tests: [
      "packages/core/src/parser-companion-materials.test.ts",
      "packages/core/src/parser-item-metadata.test.ts",
      ...browserHarnessTests,
    ],
    notes:
      "Parses qti-physical-material text and qti-digital-material file references. Digital materials require non-empty qti-file-href text and may include label, mime-type, and qti-resource-icon metadata. Hosts read resolved materials through createCompanionMaterialsResolution() or player.getCompanionMaterialsResolution().",
  },
  {
    qtiName: "qti-physical-material",
    category: "itemMetadata",
    support: "parsed",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: false,
    process: false,
    fixtures: ["packages/core/src/parser-companion-materials.test.ts"],
    tests: [
      "packages/core/src/parser-companion-materials.test.ts",
      "packages/core/src/parser-item-metadata.test.ts",
    ],
    notes:
      "Child of qti-companion-materials-info. Empty XML text emits companionMaterials.physicalMaterial.empty at parse time; invalid model entries emit companionMaterials.physicalMaterial.empty.model at validation time.",
  },
  {
    qtiName: "qti-digital-material",
    category: "itemMetadata",
    support: "parsed",
    specReference: "QTI 3.0.1 ASI",
    parse: true,
    validate: true,
    render: false,
    process: false,
    fixtures: [
      "packages/fixtures/packages/basic-item-player/valid-item-only/items/tolerance-extra-features.xml",
    ],
    tests: [
      "packages/core/src/parser-companion-materials.test.ts",
      "packages/core/src/parser-item-metadata.test.ts",
    ],
    notes:
      "Child of qti-companion-materials-info. Parsed from qti-file-href with optional label, mime-type, and qti-resource-icon metadata. Element attributes are preserved on the parsed model. Missing or empty qti-file-href emits companionMaterials.digitalMaterial.fileHref.* diagnostics.",
  },
];

export const elementSupport: QtiElementSupport[] = [
  ...interactionSupport,
  ...deprecatedInteractionSupport,
  ...processingSupport,
  ...itemMetadataSupport,
];

const allInteractionSupport = [...interactionSupport, ...deprecatedInteractionSupport];

export const interactionNameToType = new Map<string, QtiInteractionType>(
  allInteractionSupport.map((item) => [item.qtiName, item.interactionType]),
);

export function getInteractionSupport(qtiName: string): QtiElementSupport | undefined {
  return allInteractionSupport.find((item) => item.qtiName === qtiName);
}

export function interactionRegistryStatus(qtiName: string): QtiInteractionRegistryStatus {
  const support = getInteractionSupport(qtiName);
  if (!support) return "unsupported";
  return support.support === "deprecated" ? "deprecated" : "supported";
}

export function interactionRegistryDiagnostics(
  qtiName: string,
  source: QtiSourceLocation,
): QtiDiagnostic[] {
  const support = getInteractionSupport(qtiName);
  if (!support) {
    return [
      {
        code: "interaction.unsupported",
        severity: "warning",
        message: `${qtiName} is not currently in the support registry.`,
        path: source.path,
        source,
      },
    ];
  }
  if (support.support === "deprecated") {
    return [
      {
        code: "interaction.deprecated",
        severity: "warning",
        message: `${qtiName} is deprecated. ${support.notes ?? ""}`.trim(),
        path: source.path,
        source,
      },
    ];
  }
  return [];
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
    fixtures: interactionSupportFixtures(interactionType),
    tests: interactionSupportTests(interactionType),
  };
}

function extendedTextInteractionEntry(): QtiInteractionElementSupport {
  return {
    ...entry("qti-extended-text-interaction", "extendedText"),
    notes: "Supports plain and format=xhtml extended text.",
  };
}

function textEntryInteractionEntry(): QtiInteractionElementSupport {
  return {
    ...entry("qti-text-entry-interaction", "textEntry"),
    notes: "Supports placeholder-text and pattern-mask on text-entry controls.",
  };
}

function pciEntry(): QtiInteractionElementSupport {
  return {
    ...entry("qti-portable-custom-interaction", "portableCustom"),
    notes:
      "Parses and validates PCI metadata, exposes a browser host contract, scores captured responses, and preserves opaque interaction state. Production module execution policy belongs to the host delivery runtime.",
  };
}

function processingEntryFor(coreTest: string) {
  return (
    qtiName: string,
    fixtures: string[] = [],
    extraTests: string[] = [],
  ): QtiProcessingElementSupport => processingEntry(coreTest, qtiName, fixtures, extraTests);
}

function processingEntry(
  coreTest: string,
  qtiName: string,
  fixtures: string[] = [],
  extraTests: string[] = [],
): QtiProcessingElementSupport {
  return {
    qtiName,
    category: "processing",
    support: "supported",
    specReference: "QTI 3.0.1 ASI processing",
    parse: true,
    validate: true,
    render: false,
    process: true,
    fixtures,
    tests: [coreTest, ...extraTests],
  };
}
