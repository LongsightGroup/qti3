import {
  assertionLabel,
  isGalleryRunnable,
  runAssertionInRoot,
} from "./assertion-core.js";
import type { SharedVocabularyAssertion } from "./types.js";

export { assertionLabel, isGalleryRunnable } from "./assertion-core.js";

export type SharedVocabularyProbeStatus = "pass" | "fail" | "skip";

export interface SharedVocabularyProbeResult {
  assertion: SharedVocabularyAssertion;
  status: SharedVocabularyProbeStatus;
  message: string;
}

export async function assertSvCaseInDocument(
  assertions: SharedVocabularyAssertion[],
  root: ParentNode = document,
): Promise<SharedVocabularyProbeResult[]> {
  const results: SharedVocabularyProbeResult[] = [];
  for (const assertion of assertions) {
    results.push(await probeAssertion(root, assertion));
  }
  return results;
}

async function probeAssertion(
  root: ParentNode,
  assertion: SharedVocabularyAssertion,
): Promise<SharedVocabularyProbeResult> {
  if (!isGalleryRunnable(assertion)) {
    return {
      assertion,
      status: "skip",
      message: `${assertionLabel(assertion)}: skipped in gallery (run matrix Playwright test)`,
    };
  }

  try {
    await runAssertionInRoot(root, assertion);
    return { assertion, status: "pass", message: assertionLabel(assertion) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      assertion,
      status: "fail",
      message: `${assertionLabel(assertion)}: ${reason}`,
    };
  }
}
