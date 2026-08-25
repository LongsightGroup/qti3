import { describe, it } from "vitest";

import {
  expectTranscodeEvidenceCase,
  transcodeEvidenceInteractionTypes,
} from "./transcoder-evidence.test-helpers.js";

describe("qti21-standard@1 evidence", () => {
  it.each(transcodeEvidenceInteractionTypes)("transcodes %s", (interactionType) => {
    expectTranscodeEvidenceCase("qti21-standard@1", interactionType);
  });
});
