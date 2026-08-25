import { describe, it } from "vitest";

import {
  expectTranscodeEvidenceCase,
  transcodeEvidenceInteractionTypes,
} from "./transcoder-evidence.test-helpers.js";

describe("qti12-standard@1 evidence", () => {
  it.each(transcodeEvidenceInteractionTypes)("transcodes %s", (interactionType) => {
    expectTranscodeEvidenceCase("qti12-standard@1", interactionType);
  });
});
