import { describe, it } from "vitest";

import {
  expectTranscodeEvidenceCase,
  transcodeEvidenceInteractionTypes,
} from "./transcoder-evidence.test-helpers.js";

describe("canvas-new-quizzes@1 evidence", () => {
  it.each(transcodeEvidenceInteractionTypes)("transcodes %s", (interactionType) => {
    expectTranscodeEvidenceCase("canvas-new-quizzes@1", interactionType);
  });
});
