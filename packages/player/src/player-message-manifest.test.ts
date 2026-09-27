import { describe, expect, it } from "vitest";
import { PLAYER_MESSAGE_MANIFEST } from "./player-message-manifest.js";
import { PLAYER_MESSAGE_KEYS } from "./player-message-keys.js";

describe("PLAYER_MESSAGE_MANIFEST", () => {
  it("lists every chrome message id once", () => {
    expect(new Set(PLAYER_MESSAGE_KEYS).size).toBe(PLAYER_MESSAGE_MANIFEST.length);
  });
});
