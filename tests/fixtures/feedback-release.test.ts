import { createItemSession, visibleModalFeedback } from "../../packages/core/src/index.js";
import { describe, expect, it } from "vitest";
import { feedbackReleaseItemXml } from "./feedback-release-item.js";
import { validQtiDocument } from "./valid-qti-document.js";

// Artifact integrity: official-schema gate checks these exact synthetic browser fixture bytes.
// This does not prove the player release gate; the real DOM/state browser matrix owns that proof.
describe("feedback-release browser fixture schema contracts", () => {
  it.each([false, true])(
    "validates the exact scored feedback artifact (adaptive=%s)",
    (adaptive) => {
      const document = validQtiDocument(feedbackReleaseItemXml(adaptive));
      const session = createItemSession(document);
      expect(session.serialize().outcomes.FEEDBACK).toBe("INITIAL");
      session.respond("RESPONSE", "A");
      const outcomes = session.score().outcomes;
      expect(outcomes.SCORE).toBe(2.5);
      expect(outcomes.FEEDBACK).toBe("RIGHT");
      expect(visibleModalFeedback(document.item, outcomes)).toMatchObject([
        { identifier: "RIGHT", text: "Modal explanation. Answer link" },
      ]);
    },
  );
});
