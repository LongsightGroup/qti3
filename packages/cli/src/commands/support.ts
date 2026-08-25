import {
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "@longsightgroup/qti3-a11y";
import {
  deprecatedInteractionSupport,
  elementSupport,
  interactionSupport,
  isEnforcedSharedVocabularyLevel,
  itemMetadataSupport,
  processingSupport,
  sharedVocabularyClassSupport,
} from "@longsightgroup/qti3-core";
import { runFixture } from "@longsightgroup/qti3-conformance";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";

/** Return the public QTI support matrix exposed by the CLI. */
export function supportMatrixReport(): {
  target: string;
  sharedVocabularyClasses: typeof sharedVocabularyClassSupport;
  elements: typeof elementSupport;
  interactions: typeof elementSupport;
  processing: typeof processingSupport;
  itemMetadata: typeof itemMetadataSupport;
} {
  return {
    target: "QTI 3.0.1 ASI item profile",
    sharedVocabularyClasses: sharedVocabularyClassSupport,
    elements: elementSupport,
    interactions: [...interactionSupport, ...deprecatedInteractionSupport],
    processing: processingSupport,
    itemMetadata: itemMetadataSupport,
  };
}

/** Return the accessibility proof matrix exposed by the CLI. */
export function accessibilityProofReport(): {
  target: string;
  interactions: typeof accessibilityProofMatrix;
  manualAssistiveTechnologyScripts: typeof manualAssistiveTechnologyScripts;
} {
  return {
    target: "QTI 3.0.1 ASI item interaction accessibility proof",
    interactions: accessibilityProofMatrix,
    manualAssistiveTechnologyScripts,
  };
}

/** Check that supported features retain the evidence required for release. */
export function assertSupportMatrix(): {
  checked: number;
  failed: number;
  failures: string[];
} {
  const failures: string[] = [];
  const requiredInteractionTests = [
    "packages/fixtures/src/fixtures.test.ts",
    "packages/conformance/src/conformance.test.ts",
    "packages/a11y/src/a11y.test.ts",
    "tests/browser/player-interaction-sweep.spec.ts",
  ];

  for (const support of interactionSupport) {
    if (support.support !== "supported") {
      failures.push(`${support.qtiName} must be supported.`);
    }
    for (const flag of ["parse", "validate", "render", "process"] as const) {
      if (!support[flag]) failures.push(`${support.qtiName} must have ${flag}=true.`);
    }
    if (support.fixtures.length === 0) {
      failures.push(`${support.qtiName} must have a reference fixture.`);
    }
    for (const test of requiredInteractionTests) {
      if (!support.tests.includes(test)) {
        failures.push(`${support.qtiName} is missing evidence test ${test}.`);
      }
    }
  }

  for (const support of deprecatedInteractionSupport) {
    if (support.support !== "deprecated") {
      failures.push(`${support.qtiName} must remain explicitly deprecated.`);
    }
    if (!support.notes) failures.push(`${support.qtiName} must explain its deprecated status.`);
  }

  for (const support of processingSupport) {
    if (support.support !== "supported") {
      failures.push(`${support.qtiName} processing entry must be supported.`);
    }
    if (!support.parse || !support.validate || !support.process) {
      failures.push(`${support.qtiName} processing entry must parse, validate, and process.`);
    }
    if (support.render) failures.push(`${support.qtiName} processing entry must not render.`);
    if (support.tests.length === 0) {
      failures.push(`${support.qtiName} processing entry must have test evidence.`);
    }
  }

  for (const support of itemMetadataSupport) {
    if (!support.notes) {
      failures.push(`${support.qtiName} item metadata entry must document its support scope.`);
    }
    if (support.tests.length === 0) {
      failures.push(`${support.qtiName} item metadata entry must have test evidence.`);
    }
    if (support.support === "parsed" && (!support.parse || !support.validate)) {
      failures.push(`${support.qtiName} parsed item metadata entry must parse and validate.`);
    }
    if (support.support === "parsed" && (support.render || support.process)) {
      failures.push(`${support.qtiName} parsed item metadata entry must not render or process.`);
    }
    if (support.support === "unsupported" && support.parse) {
      failures.push(
        `${support.qtiName} unsupported item metadata entry must not claim parse support.`,
      );
    }
  }

  for (const support of sharedVocabularyClassSupport) {
    if (isEnforcedSharedVocabularyLevel(support.level) && (support.tests?.length ?? 0) === 0) {
      failures.push(`${support.className} shared vocabulary entry must have test evidence.`);
    }
  }

  return {
    checked: elementSupport.length + sharedVocabularyClassSupport.length,
    failed: failures.length,
    failures,
  };
}

/** Run every canonical conformance fixture and summarize failures. */
export function runCanonicalFixtures(): {
  checked: number;
  failed: number;
  results: ReturnType<typeof runFixture>[];
} {
  const results = canonicalFixtures.map(runFixture);
  return {
    checked: results.length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
