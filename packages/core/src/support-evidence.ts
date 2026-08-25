import type { QtiInteractionType } from "./types.js";

export const coreIntegrationTest = "packages/core/src/core.test.ts";
export const coreParsingTest = "packages/core/src/core-parsing.test.ts";
export const coreSessionStateTest = "packages/core/src/core-session-state.test.ts";
export const processingResponseTest = "packages/core/src/processing-response.test.ts";
export const processingTemplateTest = "packages/core/src/processing-template.test.ts";
export const processingOperatorsTest = "packages/core/src/processing-operators.test.ts";
export const processingMappingTest = "packages/core/src/processing-mapping.test.ts";

const templateProcessingNames = new Set([
  "qti-template-processing",
  "qti-set-template-value",
  "qti-set-default-value",
  "qti-set-correct-response",
  "qti-template-condition",
  "qti-template-if",
  "qti-template-else-if",
  "qti-template-else",
  "qti-template-constraint",
  "qti-exit-template",
  "qti-random-integer",
]);
const responseProcessingNames = new Set([
  "qti-response-processing",
  "qti-response-condition",
  "qti-response-if",
  "qti-response-else-if",
  "qti-response-else",
  "qti-set-outcome-value",
  "qti-exit-response",
  "qti-response-processing-fragment",
  "qti-variable",
]);
const mappingProcessingNames = new Set([
  "qti-lookup-outcome-value",
  "qti-match-table",
  "qti-match-table-entry",
  "qti-interpolation-table",
  "qti-interpolation-table-entry",
  "qti-match",
  "qti-correct",
  "qti-default",
  "qti-map-response",
  "qti-map-response-point",
  "qti-field-value",
  "qti-inside",
]);

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

export type ProcessingBrowserEvidenceName = keyof typeof processingBrowserEvidence;

export const interactionExtraFixtures: Partial<Record<QtiInteractionType, readonly string[]>> = {
  extendedText: [
    "packages/fixtures/packages/sv-matrix/items/extended-text-pattern-mask.xml",
    "packages/fixtures/packages/sv-matrix/items/extended-text-xhtml.xml",
  ],
  textEntry: ["packages/fixtures/packages/sv-matrix/items/text-entry-pattern-mask-inline.xml"],
};

export function browserTestsFor(interactionType: QtiInteractionType): string[] {
  const base = [
    "packages/fixtures/src/fixtures.test.ts",
    "packages/conformance/src/conformance.test.ts",
    "packages/a11y/src/a11y.test.ts",
    "tests/browser/player-interaction-sweep.spec.ts",
  ];
  const extras: Partial<Record<QtiInteractionType, string[]>> = {
    associate: browserKeyboardA11yTests,
    choice: ["tests/browser/player-choice.spec.ts", "tests/browser/player-dom-behavior.spec.ts"],
    drawing: ["tests/browser/player-graphic.spec.ts"],
    endAttempt: ["tests/browser/player-dom-behavior.spec.ts", ...browserKeyboardA11yTests],
    extendedText: [
      "tests/browser/player-dom-behavior.spec.ts",
      "tests/browser/player-extended-text-xhtml.spec.ts",
    ],
    gapMatch: ["tests/browser/player-gap-match.spec.ts"],
    graphicAssociate: ["tests/browser/player-graphic.spec.ts"],
    graphicGapMatch: [
      "tests/browser/player-graphic-gap-match.spec.ts",
      "tests/browser/player-graphic.spec.ts",
    ],
    graphicOrder: ["tests/browser/player-graphic.spec.ts"],
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
    textEntry: ["tests/browser/player-dom-behavior.spec.ts"],
    upload: ["tests/browser/player-dom-behavior.spec.ts"],
  };
  return [...base, ...(extras[interactionType] ?? [])];
}

export function interactionSupportFixtures(interactionType: QtiInteractionType): string[] {
  return [
    `packages/fixtures/xml/${interactionType}-reference.xml`,
    ...(interactionExtraFixtures[interactionType] ?? []),
  ];
}

export function interactionSupportTests(interactionType: QtiInteractionType): string[] {
  if (interactionType === "extendedText" || interactionType === "textEntry") {
    return [...browserTestsFor(interactionType), "packages/core/src/pattern-mask.test.ts"];
  }
  if (interactionType === "media") {
    return [...browserTestsFor(interactionType), "packages/core/src/media-definition.test.ts"];
  }
  return browserTestsFor(interactionType);
}

function isProcessingBrowserEvidenceName(
  qtiName: string,
): qtiName is ProcessingBrowserEvidenceName {
  return Object.hasOwn(processingBrowserEvidence, qtiName);
}

export function processingSupportTests(qtiName: string): string[] {
  const coreTest = processingCoreTestFor(qtiName);
  if (!isProcessingBrowserEvidenceName(qtiName)) {
    return [coreTest];
  }
  return [coreTest, ...processingBrowserEvidence[qtiName]];
}

export function processingCoreTestFor(qtiName: string): string {
  if (templateProcessingNames.has(qtiName)) return processingTemplateTest;
  if (responseProcessingNames.has(qtiName)) return processingResponseTest;
  if (mappingProcessingNames.has(qtiName)) return processingMappingTest;
  return processingOperatorsTest;
}
