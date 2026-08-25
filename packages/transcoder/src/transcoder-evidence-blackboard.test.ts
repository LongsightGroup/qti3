import { describe, it } from "vitest";

import {
  expectTranscodeEvidenceCase,
  transcodeEvidenceInteractionTypes,
} from "./transcoder-evidence.test-helpers.js";

describe("blackboard-question-banks@1 evidence", () => {
  it.each(transcodeEvidenceInteractionTypes)("transcodes %s", (interactionType) => {
    expectTranscodeEvidenceCase("blackboard-question-banks@1", interactionType);
  });
});
