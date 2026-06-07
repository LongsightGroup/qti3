import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  QTI3_INLINE_VALIDATION_EVENT,
  reportMaximumResponseExceeded,
} from "./inline-validation.js";

describe("inline-validation", () => {
  it("reports maximum response diagnostics through a bubbling custom event", () => {
    const events: CustomEvent[] = [];
    const host = {
      dispatchEvent(event: Event) {
        events.push(event as CustomEvent);
        return true;
      },
    } as HTMLElement;

    reportMaximumResponseExceeded(
      host,
      {
        responseIdentifier: "RESPONSE",
        type: "choice",
        attributes: { "data-max-selections-message": "Too many." },
      } as unknown as QtiInteraction,
      2,
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe(QTI3_INLINE_VALIDATION_EVENT);
    expect(events[0]!.detail).toEqual({
      responseIdentifier: "RESPONSE",
      diagnostic: {
        code: "response.maximum",
        severity: "error",
        message: "Too many.",
        path: "RESPONSE",
      },
    });
  });
});
