import { describe, expect, it } from "vitest";
import { createPlayerMessageResolver } from "./player-message-resolver.js";

describe("PlayerMessageResolver.message", () => {
  it("types plain messages as zero-arg calls", () => {
    const messages = createPlayerMessageResolver({ strings: { remove: "Remove" } });
    expect(messages.message("remove")).toBe("Remove");
  });

  it("types templated messages with params", () => {
    const messages = createPlayerMessageResolver({
      strings: { removePair: "Remove {label}" },
    });
    expect(messages.message("removePair", { label: "pair 1" })).toBe("Remove pair 1");
  });
});
