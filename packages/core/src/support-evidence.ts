import { SHUFFLE_INTERACTION_TYPES } from "./presentation-definition.js";
import type { QtiInteractionType } from "./types.js";

export const coreIntegrationTest = "packages/core/src/core.test.ts";
export const coreSessionStateTest = "packages/core/src/core-session-state.test.ts";
export const processingResponseTest = "packages/core/src/processing-response.test.ts";
export const processingTemplateTest = "packages/core/src/processing-template.test.ts";
export const processingOperatorsTest = "packages/core/src/processing-operators.test.ts";
export const processingMappingTest = "packages/core/src/processing-mapping.test.ts";

export const browserProcessingTests = ["tests/browser/player-processing.spec.ts"];
export const browserFeedbackTests = ["tests/browser/player-feedback.spec.ts"];
export const browserAdaptiveTests = ["tests/browser/player-adaptive.spec.ts"];
export const browserBodyContentTests = ["tests/browser/player-body-content.spec.ts"];
export const browserHarnessTests = ["tests/browser/player-harness.spec.ts"];
export const browserMathmlTests = ["tests/browser/player-mathml.spec.ts"];
export const browserKeyboardA11yTests = ["tests/browser/player-keyboard-a11y.spec.ts"];
export const browserLifecycleTests = ["tests/browser/player-lifecycle.spec.ts"];

const templateProcessingBrowserEvidence = [
  ...browserProcessingTests,
  ...browserBodyContentTests,
  ...browserMathmlTests,
];
const responseProcessingBrowserEvidence = [
  ...browserProcessingTests,
  ...browserFeedbackTests,
  ...browserAdaptiveTests,
];
const randomIntegerBrowserEvidence = browserProcessingTests;

/** Browser evidence bundles keyed by parent processing constructs only. */
export const processingBrowserEvidence = {
  "qti-template-processing": templateProcessingBrowserEvidence,
  "qti-response-processing": responseProcessingBrowserEvidence,
  "qti-random-integer": randomIntegerBrowserEvidence,
} as const satisfies Record<string, readonly string[]>;

export const interactionExtraFixtures: Partial<Record<QtiInteractionType, readonly string[]>> = {
  extendedText: [
    "packages/fixtures/packages/sv-matrix/items/extended-text-pattern-mask.xml",
    "packages/fixtures/packages/sv-matrix/items/extended-text-xhtml.xml",
  ],
  textEntry: ["packages/fixtures/packages/sv-matrix/items/text-entry-pattern-mask-inline.xml"],
};

function allInteractionTests(interactionType: QtiInteractionType): string[] {
  const base = [
    "packages/fixtures/src/fixtures.test.ts",
    "packages/conformance/src/conformance.test.ts",
    "packages/a11y/src/a11y.test.ts",
    "tests/browser/player-interaction-sweep.spec.ts",
  ];
  const extras: Partial<Record<QtiInteractionType, string[]>> = {
    associate: [
      ...browserKeyboardA11yTests,
      "packages/core/src/association-contracts.test.ts",
      "tests/browser/player-dom-behavior.spec.ts",
    ],
    choice: ["tests/browser/player-choice.spec.ts", "tests/browser/player-dom-behavior.spec.ts"],
    drawing: ["tests/browser/player-graphic.spec.ts"],
    endAttempt: ["tests/browser/player-dom-behavior.spec.ts", ...browserKeyboardA11yTests],
    extendedText: [
      "packages/core/src/text-response.test.ts",
      "tests/browser/player-dom-behavior.spec.ts",
      "tests/browser/player-extended-text-xhtml.spec.ts",
    ],
    gapMatch: ["tests/browser/player-gap-match.spec.ts"],
    graphicAssociate: ["tests/browser/player-graphic.spec.ts"],
    graphicGapMatch: [
      "packages/core/src/core-session-graphic-gap-state.test.ts",
      "tests/browser/player-graphic-gap-match.spec.ts",
      "tests/browser/player-graphic.spec.ts",
      ...browserLifecycleTests,
    ],
    graphicOrder: [
      "packages/core/src/graphic-image-contracts.test.ts",
      "tests/browser/player-graphic.spec.ts",
    ],
    hotspot: ["tests/browser/player-graphic.spec.ts"],
    hottext: ["tests/browser/player-hottext.spec.ts", "tests/browser/player-dom-behavior.spec.ts"],
    inlineChoice: ["tests/browser/player-inline-choice.spec.ts"],
    match: ["tests/browser/player-match.spec.ts", "tests/browser/player-dom-behavior.spec.ts"],
    media: ["tests/browser/player-media.spec.ts"],
    order: [...browserKeyboardA11yTests, ...browserLifecycleTests],
    portableCustom: ["tests/browser/player-portable-custom.spec.ts"],
    positionObject: ["tests/browser/player-graphic.spec.ts", ...browserKeyboardA11yTests],
    selectPoint: ["tests/browser/player-graphic.spec.ts"],
    slider: [
      "tests/browser/player-dom-behavior.spec.ts",
      "tests/browser/player-slider.spec.ts",
      "tests/browser/player-slider-cross-browser.spec.ts",
      ...browserKeyboardA11yTests,
    ],
    textEntry: [
      "packages/core/src/text-response.test.ts",
      "tests/browser/player-dom-behavior.spec.ts",
    ],
    upload: ["tests/browser/player-dom-behavior.spec.ts"],
  };
  const visibilityEvidence = [
    ...SHUFFLE_INTERACTION_TYPES,
    "hotspot",
    "hottext",
    "graphicOrder",
    "graphicAssociate",
    "graphicGapMatch",
  ].includes(interactionType)
    ? [
        "packages/core/src/presentation-visibility.test.ts",
        "tests/browser/player-template-choice-visibility.spec.ts",
      ]
    : [];
  return [...base, ...(extras[interactionType] ?? []), ...visibilityEvidence];
}

/** Browser evidence contains only executable Playwright suites. */
export function browserTestsFor(interactionType: QtiInteractionType): string[] {
  return allInteractionTests(interactionType).filter((path) => path.startsWith("tests/browser/"));
}

export function interactionSupportFixtures(interactionType: QtiInteractionType): string[] {
  return [
    `packages/fixtures/xml/${interactionType}-reference.xml`,
    ...(interactionExtraFixtures[interactionType] ?? []),
    ...(SHUFFLE_INTERACTION_TYPES.includes(interactionType)
      ? [`packages/fixtures/xml/shuffle/${interactionType}.xml`]
      : []),
  ];
}

export function interactionSupportTests(interactionType: QtiInteractionType): string[] {
  if (interactionType === "extendedText" || interactionType === "textEntry") {
    return [...allInteractionTests(interactionType), "packages/core/src/pattern-mask.test.ts"];
  }
  if (interactionType === "media") {
    return [...allInteractionTests(interactionType), "packages/core/src/media-definition.test.ts"];
  }
  return [
    ...allInteractionTests(interactionType),
    ...(interactionType === "gapMatch" ? ["packages/core/src/gap-target-validation.test.ts"] : []),
    ...(SHUFFLE_INTERACTION_TYPES.includes(interactionType)
      ? [
          "packages/core/src/presentation.test.ts",
          "packages/writer/src/shuffle.test.ts",
          "tests/browser/player-shuffle.spec.ts",
        ]
      : []),
  ];
}
