import type { QtiInteractionType } from "./types.js";

const coreProcessingTest = "packages/core/src/core.test.ts";

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
    slider: browserKeyboardA11yTests,
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
  return browserTestsFor(interactionType);
}

function isProcessingBrowserEvidenceName(
  qtiName: string,
): qtiName is ProcessingBrowserEvidenceName {
  return Object.hasOwn(processingBrowserEvidence, qtiName);
}

export function processingSupportTests(qtiName: string): string[] {
  if (!isProcessingBrowserEvidenceName(qtiName)) {
    return [coreProcessingTest];
  }
  return [coreProcessingTest, ...processingBrowserEvidence[qtiName]];
}
