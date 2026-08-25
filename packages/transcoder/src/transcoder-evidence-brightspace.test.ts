import { describe, it } from "vitest";

import {
  expectTranscodeEvidenceCase,
  transcodeEvidenceInteractionTypes,
} from "./transcoder-evidence.test-helpers.js";

describe("brightspace-course-import@1 evidence", () => {
  it.each(transcodeEvidenceInteractionTypes)("transcodes %s", (interactionType) => {
    expectTranscodeEvidenceCase("brightspace-course-import@1", interactionType);
  });
});
